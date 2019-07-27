import { animate, state, style, transition, trigger } from '@angular/animations';
import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { Observable, Subject, concat, from, fromEvent, interval, merge, timer, Subscription } from 'rxjs';
import { filter, exhaustMap, map, switchMap, take } from 'rxjs/operators';

import { BrowserParamsService } from '../browser-params.service';
import { Store, select } from '@ngrx/store';
import { State } from '../reducers';
import * as ViewerActions from './viewer.actions';
import { showPreviewSelector } from './viewer.selectors';

declare type MediaRecorder = any;
declare var MediaRecorder: any;

type UserAction = 'more' | 'less' | 'stopRecord';

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
  private skip = false;
  private mediaStream: MediaStream | null;
  private mediaRecorder: MediaRecorder | null;
  private adjustIntervalId: number | null;
  private video: HTMLVideoElement;
  private liveVideo: HTMLVideoElement;
  private preview: HTMLVideoElement;
  private lastReceived: Date | null = null;
  private bufferSource = new MediaSource();
  private sourceBuffer: SourceBuffer | null;
  private isPreviewDismissed = false;
  isWizardShown = true;
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

  private userActions = new Subject<UserAction>();
  private playerActions: Observable<PlayerAction>;
  private showPreview$sub: Subscription;

  constructor(
    @Inject(BrowserParamsService) private browserParams: BrowserParamsService,
    private store: Store<State>,
  ) {
    this.targetMs = 0;
    this.skip = false;
    this.mediaStream = null;
    this.adjustIntervalId = null;

    this.showPreview$ = store.pipe(select(showPreviewSelector));

    this.showPreview$sub = this.showPreview$.subscribe(value => {
      if (this.preview) {
        if (value) {
          this.preview.play();
        } else {
          this.preview.pause();
        }
      }
    });

    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
  }

  ngOnInit() {
    if (this.isUnsupportedBrowser) { return; }
    this.video = document.querySelector('#video') as HTMLVideoElement;
    this.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.preview = document.querySelector('#preview') as HTMLVideoElement;
    this.start();

    const foregroundedStream =
      fromEvent(document, 'visibilitychange');
    const fixDelayStream =
      foregroundedStream.pipe(filter(() => document.visibilityState === 'visible'),
        exhaustMap(() => this.changeDelay(0)));

    this.playerActions = merge(
      this.userActions.pipe(switchMap(
        (userAction) => this.executeUserAction(userAction))),
      fixDelayStream);
    this.playerActions.subscribe(
      (action) => { this.executePlayerAction(action); });
  }

  ngOnDestroy() {
    this.showPreview$sub.unsubscribe();
  }

  start() {
    const mimeType = this.browserParams.mimeType;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then((mediaStream) => {
        this.mediaStream = mediaStream;
        this.mediaRecorder =
          new MediaRecorder(mediaStream, { mimeType });
        this.bufferSource.addEventListener('sourceopen', () => {
          this.sourceBuffer = this.bufferSource.addSourceBuffer(mimeType);

          this.mediaRecorder.ondataavailable = (e) => {
            if (this.isEnded) {
              return;
            }
            this.showDelay();
            this.lastReceived = new Date();
            const fileReader = new FileReader();
            fileReader.onload = (f) => {
              this.sourceBuffer.appendBuffer((f.target as any).result);
            };
            fileReader.readAsArrayBuffer(e.data);
          };
          this.mediaRecorder.start();
          this.mediaRecorder.requestData();
          interval(1000).subscribe(() => {
            if (!this.isEnded) {
              this.mediaRecorder.requestData();
            }
          });
          this.isInitialized = true;
        });
        this.isLive = true;
        this.video.src = window.URL.createObjectURL(this.bufferSource);
        this.video.pause();
        bindStream(this.liveVideo, this.mediaStream);
        this.liveVideo.play();
        bindStream(this.preview, this.mediaStream);
        this.preview.pause();
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
    if (!this.isPreviewDismissed && !this.isEnded) {
      this.store.dispatch(ViewerActions.showPreview());
    }
    this.isWizardShown = false;
    this.userActions.next('more');
  }

  stopRecord() {
    this.isWizardShown = false;
    this.userActions.next('stopRecord');
  }

  togglePreview() {
    this.store.dispatch(ViewerActions.togglePreview());
    this.isPreviewDismissed = true;
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
      default:
        const checkExhaustive: never = action;
    }
  }

  changeDelay(ms: number, noWait = false): Observable<PlayerAction> {
    this.skip = true;
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
          this.liveVideo.play();
          this.video.pause();
          this.waitTime = 0;
          this.isLive = true;
        }
        break;
      case 'Play':
        console.log('playing');
        this.switchToDelayed();
        this.video.play();
        this.waitTime = 0;
        this.isStopped = false;
        break;
      case 'Pause':
        console.log('pausing');
        this.switchToDelayed();
        this.video.pause();
        break;
      case 'SetTime':
        console.log('setting time', action);
        this.video.currentTime = action.timeS;
        break;
      case 'SetWaiting':
        console.log('setting waiting', action);
        this.video.currentTime = 0;
        this.waitTime = action.timeS;
        break;
      case 'StopRecord':
        console.log('stop recording');
        this.isEnded = true;
        this.store.dispatch(ViewerActions.hidePreview());
        this.switchToDelayed();
        if (this.mediaStream) {
          for (const mediaStreamTrack of this.mediaStream.getTracks()) {
            mediaStreamTrack.stop();
          }
        }
        this.bufferSource.endOfStream();
        if (this.mediaRecorder) {
          this.mediaRecorder.stop();
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
      this.liveVideo.pause();
      this.video.play();
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
    if (!this.lastReceived || this.sourceBuffer.buffered.length === 0) {
      return 0;
    }
    const result = 1000 * this.sourceBuffer.buffered.end(0);
    return result + this.timeSinceLastReceivedMs;
  }

  get delayMs() {
    if (this.isLive) {
      return 0;
    } else {
      return this.absoluteEndMs - this.video.currentTime * 1000;
    }
  }

  get isWaiting() { return this.waitTime <= 0; }

  showDelay() {
    this.totalTime = this.sourceBuffer.buffered.length ?
      this.sourceBuffer.buffered.end(0) :
      0;
    if (!this.isEnded) {
      this.totalTime += this.timeSinceLastReceivedMs / 1000;
    }
    this.currentTime = this.isLive ? this.totalTime : this.video.currentTime;
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
