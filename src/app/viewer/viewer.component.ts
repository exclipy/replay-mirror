import 'rxjs/add/observable/from';
import 'rxjs/add/observable/fromEvent';
import 'rxjs/add/observable/interval';
import 'rxjs/add/observable/merge';
import 'rxjs/add/observable/timer';
import 'rxjs/add/operator/concat';
import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/exhaustMap';
import 'rxjs/add/operator/map';
import 'rxjs/add/operator/switchMap';
import 'rxjs/add/operator/take';

import {Component, Inject, OnInit} from '@angular/core';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';

import {BrowserParamsService} from '../browser-params.service'

declare type MediaRecorder = any;
declare var MediaRecorder: any;

type UserAction = 'more' | 'less' | 'stopRecord';

type PauseAction = {
  kind: 'Pause'
};
type PlayAction = {
  kind: 'Play'
};
type StopRecordAction = {
  kind: 'StopRecord'
};
type SetLiveAction = {
  kind: 'SetLive'
};
type SetTimeAction = {
  kind: 'SetTime',
  timeS: number
};
type SetWaitingAction = {
  kind: 'SetWaiting',
  timeS: number
};

type PlayerAction = PauseAction | PlayAction | StopRecordAction |
    SetTimeAction | SetLiveAction | SetWaitingAction;

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css']
})
export class ViewerComponent implements OnInit {
  targetMs = 0;
  private skip = false;
  private mediaStream: MediaStream|null;
  private mediaRecorder: MediaRecorder|null;
  private adjustIntervalId: number|null;
  private video: HTMLVideoElement;
  private liveVideo: HTMLVideoElement;
  private preview: HTMLVideoElement;
  private lastReceived: Date|null = null;
  private bufferSource = new MediaSource();
  private sourceBuffer: SourceBuffer|null;
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
  showPreview_ = false;

  private userActions = new Subject<UserAction>();
  private playerActions: Observable<PlayerAction>;

  constructor(@Inject(BrowserParamsService) private browserParams:
                  BrowserParamsService) {
    this.targetMs = 0;
    this.skip = false;
    this.mediaStream = null;
    this.adjustIntervalId = null;

    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
  }

  ngOnInit() {
    if (this.isUnsupportedBrowser) return;
    this.video = document.querySelector('#video') as HTMLVideoElement;
    this.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.preview = document.querySelector('#preview') as HTMLVideoElement;
    this.start();

    const foregroundedStream =
        Observable.fromEvent(document, 'visibilitychange');
    const fixDelayStream =
        foregroundedStream.filter(() => document.visibilityState === 'visible')
            .exhaustMap(() => this.changeDelay(0));

    this.playerActions = Observable.merge(
        this.userActions.switchMap(
            (userAction) => this.executeUserAction(userAction)),
        fixDelayStream);
    this.playerActions.subscribe(
        (action) => { this.executePlayerAction(action); });
  }

  start() {
    const mimeType = this.browserParams.mimeType;

    navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}})
        .then((mediaStream) => {
          this.mediaStream = mediaStream;
          this.mediaRecorder =
              new MediaRecorder(mediaStream, {mimeType: mimeType}) as any;
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
            Observable.interval(1000).subscribe(() => {
              if (!this.isEnded) {
                this.mediaRecorder.requestData();
              }
            });
            this.isInitialized = true;
          });
          this.isLive = true;
          this.video.src = window.URL.createObjectURL(this.bufferSource);
          this.video.pause();
          this.liveVideo.src = window.URL.createObjectURL(this.mediaStream);
          this.liveVideo.play();
          this.preview.src = window.URL.createObjectURL(this.mediaStream);
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
            console.log(e);
          }
        });

    //
    //    this.adjustIntervalId = window.setInterval(() => {
    //      if (!this.skip && this.video.currentTime !== undefined &&
    //      this.video.buffered.length > 0) {
    //        console.log('currentTime: ', this.video.currentTime,
    //            'buffer end: ', this.video.buffered.end(0),
    //            'delay: ', this.delayMs,
    //            'delta: ', this.target - this.delayMs);
    //
    //        if (Math.abs(this.target - this.delayMs) > 500) {
    //          this.showDelay();
    //          this.changeDelay(0);
    //        } else {
    //          let rate = Math.pow(1.5, (this.delayMs - this.target)/1000);
    //          if (Math.abs(rate - 1) < 0.01) {
    //            rate = 1;
    //          }
    //          this.video.playbackRate = rate;
    //          console.log('playback rate: ', rate);
    //          this.showDelay();
    //        }
    //      }
    //    }, 1000);
  }

  less() { this.userActions.next('less'); }

  more() {
    if (!this.isPreviewDismissed && !this.isEnded) this.isPreviewShown = true;
    this.isWizardShown = false;
    this.userActions.next('more');
  }

  stopRecord() {
    this.isWizardShown = false;
    this.userActions.next('stopRecord');
  }

  togglePreview() {
    this.isPreviewShown = !this.isPreviewShown;
    this.isPreviewDismissed = true;
  }

  stopped() {
    console.log('stopped');
    this.isStopped = true;
  }

  set isPreviewShown(value) {
    if (this.preview) {
      if (value) {
        this.preview.play();
      } else {
        this.preview.pause();
      }
    }
    this.showPreview_ = value;
  }

  get isPreviewShown() { return this.showPreview_; }

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
        return Observable.from([{kind: 'StopRecord' as 'StopRecord'}])
            .concat(this.changeDelay(0, true));
      default:
        const checkExhaustive: never = action;
    }
  }

  changeDelay(ms, noWait = false): Observable<PlayerAction> {
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
      const x = new Date();
      return Observable
          .from([
            {kind: 'Pause' as 'Pause'},
            {kind: ('SetTime' as 'SetTime'), timeS: 0},
            {kind: ('SetWaiting' as 'SetWaiting'), timeS: periods},
          ])
          .concat(Observable.timer((-headroom) % 1000, 1000)
                      .take(periods)
                      .switchMap((i: number): Observable<PlayerAction> => {
                        const x = new Date();
                        if (i < periods - 1) {
                          return Observable.from([{
                            kind: ('SetWaiting' as 'SetWaiting'),
                            timeS: periods - 1 - i
                          }]);
                        } else {
                          return Observable.from([{kind: ('Play' as 'Play')}]);
                        }
                      }));
    } else {
      if (this.targetMs <= this.timeSinceLastReceivedMs && !this.isEnded) {
        return Observable.from([{kind: ('SetLive' as 'SetLive')}]);
      }
      const actions: PlayerAction[] = [{
        kind: 'SetTime' as 'SetTime',
        timeS: (this.absoluteEndMs - this.targetMs) / 1000
      }];
      if (this.targetMs > this.timeSinceLastReceivedMs) {
        actions.push({kind: ('Play' as 'Play')});
      }
      return Observable.from(actions);
    }
  }

  executePlayerAction(action: PlayerAction) {
    switch (action.kind) {
      case 'SetLive':
        console.log('set live');
        if (!this.isLive) {
          this.liveVideo.play();
          this.video.pause();
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
        this.isPreviewShown = false;
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
    if (!this.lastReceived) return 0;
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
