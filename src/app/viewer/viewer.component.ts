import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { untilComponentDestroyed } from '@w11k/ngx-componentdestroyed';
import { Observable, Subject, concat, from, fromEvent, interval, merge, timer, Subscription } from 'rxjs';
import { filter, exhaustMap, map, switchMap, take } from 'rxjs/operators';

import { BrowserParamsService } from '../browser-params.service';
import { Store, select } from '@ngrx/store';
import { State } from '../reducers';
import * as ViewerActions from './viewer.actions';
import { VideoService } from '../video.service';

declare type MediaRecorder = any;
declare var MediaRecorder: any;

type UserAction = 'more' | 'less' | 'stopRecord' | 'foregrounded';

interface PauseAction {
  kind: 'Pause';
}
interface PlayAction {
  kind: 'Play';
}
interface StopRecordAction {
  kind: 'StopRecord';
}
interface SetLiveAction {
  kind: 'SetLive';
}
interface SetTimeAction {
  kind: 'SetTime';
  timeS: number;
}
interface SetWaitingAction {
  kind: 'SetWaiting';
  timeS: number;
}

type PlayerAction = PauseAction | PlayAction | StopRecordAction |
  SetTimeAction | SetLiveAction | SetWaitingAction;

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css'],
  animations: [trigger(
    'preview',
    [
      state('hide', style({ opacity: 0, transform: 'scale(0)' })),
      transition('hide <=> show', [animate(100)])
    ])]
})
export class ViewerComponent implements OnInit, OnDestroy {
  targetMs = 0;
  private adjustIntervalId: number | null;
  private lastReceived: Date | null = null;
  isEnded = false;
  isStopped = false;
  isLive = true;
  isInitialized = false;
  isUnsupportedBrowser = false;
  isPermissionDeniedError = false;
  isNotFoundError = false;
  isUnknownError = false;
  currentTime = 0;
  totalTime = 0;
  displayedDelay = 0;
  waitTime = 0;

  showPreview$: Observable<boolean>;
  showWizard$: Observable<boolean>;

  private userActions = new Subject<UserAction>();
  private playerActions: Observable<PlayerAction>;

  constructor(
    @Inject(BrowserParamsService) private browserParams: BrowserParamsService,
    private videoService: VideoService,
    private store: Store<State>,
  ) {
    this.targetMs = 0;
    this.videoService.mediaStream = null;
    this.adjustIntervalId = null;

    this.showPreview$ = store.pipe(select('viewer', 'showPreview'));
    this.showWizard$ = store.pipe(select('viewer', 'showWizard'));

    this.showPreview$
      .pipe(untilComponentDestroyed(this))
      .subscribe(value => {
        if (this.videoService.preview) {
          if (value) {
            this.videoService.preview.play();
          } else {
            this.videoService.preview.pause();
          }
        }
      });

    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
  }

  ngOnInit() {
    if (this.isUnsupportedBrowser) { return; }
    this.videoService.video = document.querySelector('#video') as HTMLVideoElement;
    this.videoService.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.videoService.preview = document.querySelector('#preview') as HTMLVideoElement;
    this.start();

    fromEvent(document, 'visibilitychange').pipe(
      untilComponentDestroyed(this),
      filter(() => document.visibilityState === 'visible'),
    ).subscribe(() => this.userActions.next('foregrounded'));

    this.playerActions = this.userActions.pipe(
      switchMap((userAction) => this.executeUserAction(userAction)));
    this.playerActions
      .pipe(untilComponentDestroyed(this))
      .subscribe(
        (action) => { this.executePlayerAction(action); });
  }

  ngOnDestroy() {
  }

  start() {
    const mimeType = this.browserParams.mimeType;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then((mediaStream) => {
        this.videoService.mediaStream = mediaStream;
        this.videoService.mediaRecorder =
          new MediaRecorder(mediaStream, { mimeType });
        this.videoService.bufferSource.addEventListener('sourceopen', () => {
          this.videoService.sourceBuffer = this.videoService.bufferSource.addSourceBuffer(mimeType);

          this.videoService.mediaRecorder.ondataavailable = (e) => {
            if (this.isEnded) {
              return;
            }
            this.showDelay();
            this.lastReceived = new Date();
            const fileReader = new FileReader();
            fileReader.onload = (f) => {
              this.videoService.sourceBuffer.appendBuffer((f.target as any).result);
            };
            fileReader.readAsArrayBuffer(e.data);
          };
          this.videoService.mediaRecorder.start();
          this.videoService.mediaRecorder.requestData();
          interval(1000).subscribe(() => {
            if (!this.isEnded) {
              this.videoService.mediaRecorder.requestData();
            }
          });
          this.isInitialized = true;
        });
        this.isLive = true;
        this.videoService.video.src = window.URL.createObjectURL(this.videoService.bufferSource);
        this.videoService.video.pause();
        bindStream(this.videoService.liveVideo, this.videoService.mediaStream);
        this.videoService.liveVideo.play();
        bindStream(this.videoService.preview, this.videoService.mediaStream);
        this.videoService.preview.pause();
      })
      .catch((e) => {
        if (e.name === 'PermissionDeniedError' ||  // Chrome
          e.name === 'NotAllowedError') {        // Firefox
          this.isPermissionDeniedError = true;
        } else if (e.name === 'NotFoundError') {
          this.isNotFoundError = true;
        } else {
          this.isUnknownError = true;
          console.log('Unknown error:', e);
        }
      });
  }

  less() { this.userActions.next('less'); }

  more() {
    this.store.dispatch(ViewerActions.more());
    this.userActions.next('more');
  }

  stopRecord() {
    this.store.dispatch(ViewerActions.stopRecord());
    this.userActions.next('stopRecord');
  }

  dismissWizard() {
    this.store.dispatch(ViewerActions.dismissWizard());
  }

  togglePreview() {
    this.store.dispatch(ViewerActions.togglePreview());
  }

  stopped() {
    console.log('stopped');
    this.isStopped = true;
  }

  get isError() {
    return this.isNotFoundError || this.isPermissionDeniedError ||
      this.isUnsupportedBrowser;
  }

  executeUserAction(action: UserAction): Observable<PlayerAction> {
    switch (action) {
      case 'less':
        return this.changeDelay(-5000);
      case 'more':
        return this.changeDelay(5000);
      case 'stopRecord':
        return concat(
          from([{ kind: 'StopRecord' as 'StopRecord' }]),
          this.changeDelay(0, true));
      case 'foregrounded':
        return this.changeDelay(0);

      default:
        const checkExhaustive: never = action;
    }
  }

  changeDelay(ms: number, noWait = false): Observable<PlayerAction> {
    this.targetMs = this.isEnded ?
      Math.max(this.delayMs + ms, this.timeSinceLastReceivedMs) :
      Math.max(this.targetMs + ms, 0);
    if (noWait || this.isEnded) {
      // Don't allow the currentTime to be before the start.
      this.targetMs = Math.min(this.targetMs, this.absoluteEndMs);
    }
    const headroom = this.absoluteEndMs - this.targetMs;
    if (headroom < 0) {
      const periods = Math.floor(-headroom / 1000) + 1;
      return concat(
        from([
          { kind: 'Pause' as 'Pause' },
          { kind: ('SetTime' as 'SetTime'), timeS: 0 },
          { kind: ('SetWaiting' as 'SetWaiting'), timeS: periods },
        ]),
        timer((-headroom) % 1000, 1000).pipe(
          take(periods),
          switchMap((i: number): Observable<PlayerAction> => {
            if (i < periods - 1) {
              return from([{
                kind: ('SetWaiting' as 'SetWaiting'),
                timeS: periods - 1 - i
              }]);
            } else {
              return from([{ kind: ('Play' as 'Play') }]);
            }
          })));
    } else {
      if (this.targetMs <= this.timeSinceLastReceivedMs && !this.isEnded) {
        return from([{ kind: ('SetLive' as 'SetLive') }]);
      }
      const actions: PlayerAction[] = [{
        kind: 'SetTime' as 'SetTime',
        timeS: (this.absoluteEndMs - this.targetMs) / 1000
      }];
      if (this.targetMs > this.timeSinceLastReceivedMs) {
        actions.push({ kind: ('Play' as 'Play') });
      }
      return from(actions);
    }
  }

  executePlayerAction(action: PlayerAction) {
    switch (action.kind) {
      case 'SetLive':
        console.log('set live');
        if (!this.isLive) {
          this.videoService.liveVideo.play();
          this.videoService.video.pause();
          this.waitTime = 0;
          this.isLive = true;
        }
        break;
      case 'Play':
        console.log('playing');
        this.switchToDelayed();
        this.videoService.video.play();
        this.waitTime = 0;
        this.isStopped = false;
        break;
      case 'Pause':
        console.log('pausing');
        this.switchToDelayed();
        this.videoService.video.pause();
        break;
      case 'SetTime':
        console.log('setting time', action);
        this.videoService.video.currentTime = action.timeS;
        break;
      case 'SetWaiting':
        console.log('setting waiting', action);
        this.videoService.video.currentTime = 0;
        this.waitTime = action.timeS;
        break;
      case 'StopRecord':
        console.log('stop recording');
        this.isEnded = true;
        this.switchToDelayed();
        if (this.videoService.mediaStream) {
          for (const mediaStreamTrack of this.videoService.mediaStream.getTracks()) {
            mediaStreamTrack.stop();
          }
        }
        this.videoService.bufferSource.endOfStream();
        if (this.videoService.mediaRecorder) {
          this.videoService.mediaRecorder.stop();
        }
        if (this.adjustIntervalId) {
          window.clearInterval(this.adjustIntervalId);
        }
        break;
      default:
        const checkExhaustive: never = action;
    }
  }

  switchToDelayed() {
    if (this.isLive) {
      this.videoService.liveVideo.pause();
      this.videoService.video.play();
      this.isLive = false;
    }
  }

  get isAtEnd() { return this.isLive || this.isStopped; }

  get timeSinceLastReceivedMs() {
    if (!this.lastReceived) { return 0; }
    const now = new Date().getTime();
    return now - this.lastReceived.getTime();
  }

  get absoluteEndMs() {
    if (!this.lastReceived || this.videoService.sourceBuffer.buffered.length === 0) {
      return 0;
    }
    const result = 1000 * this.videoService.sourceBuffer.buffered.end(0);
    return result + this.timeSinceLastReceivedMs;
  }

  get delayMs() {
    if (this.isLive) {
      return 0;
    } else {
      return this.absoluteEndMs - this.videoService.video.currentTime * 1000;
    }
  }

  get isWaiting() { return this.waitTime <= 0; }

  showDelay() {
    this.totalTime = this.videoService.sourceBuffer.buffered.length ?
      this.videoService.sourceBuffer.buffered.end(0) :
      0;
    if (!this.isEnded) {
      this.totalTime += this.timeSinceLastReceivedMs / 1000;
    }
    this.currentTime = this.isLive ? this.totalTime : this.videoService.video.currentTime;
    this.displayedDelay = this.delayMs / 1000;
  }
}

// Sets the srcObject on an element with fallback to src.
function bindStream(element: HTMLMediaElement, stream: MediaStream) {
  if ('srcObject' in element) {
    element.srcObject = stream;
  } else {
    // Avoid using this in new browsers, as it is going away.
    (element as HTMLMediaElement).src = window.URL.createObjectURL(stream);
  }
}
