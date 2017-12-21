import {Component} from '@angular/core';
import * as Rx from 'rxjs/Rx';

declare var MediaRecorder: any;

type UserAction = 'more' | 'less' | 'stop';

type PauseAction = {
  kind: 'Pause'
};
type PlayAction = {
  kind: 'Play'
};
type StopAction = {
  kind: 'Stop'
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

type PlayerAction = PauseAction | PlayAction | StopAction | SetTimeAction |
    SetLiveAction | SetWaitingAction;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  targetMs = 0;
  private skip = false;
  private mediaStream: MediaStream|null;
  private adjustIntervalId: number|null;
  private video: HTMLVideoElement;
  private liveVideo: HTMLVideoElement;
  private preview: HTMLVideoElement;
  private lastRequested: Date|null = null;
  private bufferSource = new MediaSource();
  private sourceBuffer: SourceBuffer|null;
  isLive = true;
  isInitialized = false;
  isUnsupportedBrowser = false;
  isPermissionDeniedError = false;
  isNotFoundError = false;
  isUnknownError = false;
  displayedDelay = 0;
  waitTime = 0;
  showPreview_ = false;

  private userActions = new Rx.Subject<UserAction>();
  private playerActions: Rx.Observable<PlayerAction>;

  constructor() {
    this.targetMs = 0;
    this.skip = false;
    this.mediaStream = null;
    this.adjustIntervalId = null;

    this.playerActions = this.userActions.switchMap(
        (userAction) => this.executeUserAction(userAction));
    this.playerActions.subscribe(
        (action) => { this.executePlayerAction(action); });
    Rx.Observable.interval(200).subscribe(() => this.showDelay());
  }

  ngOnInit() {
    this.video = document.querySelector('#video') as HTMLVideoElement;
    this.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.preview = document.querySelector('#preview') as HTMLVideoElement;

    this.start();
  }

  getMimeType(): string|undefined {
    try {
      return ['video/webm\;codecs=vp9', 'video/webm\;codecs=vp8'].find(
          (mimeType) => MediaRecorder.isTypeSupported(mimeType));
    } catch (e) {
      return undefined;
    }
  }

  start() {
    const mimeType = this.getMimeType();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ||
        !mimeType) {
      this.isUnsupportedBrowser = true;
      return;
    }

    navigator.mediaDevices.getUserMedia({video: true})
        .then((mediaStream) => {
          this.mediaStream = mediaStream;
          const recorder =
              new MediaRecorder(mediaStream, {mimeType: mimeType}) as any;
          this.bufferSource.addEventListener('sourceopen', () => {
            this.sourceBuffer = this.bufferSource.addSourceBuffer(mimeType);

            recorder.ondataavailable = (e) => {
              const fileReader = new FileReader();
              fileReader.onload = (f) => {
                this.sourceBuffer.appendBuffer((f.target as any).result);
              };
              fileReader.readAsArrayBuffer(e.data);
            };
            recorder.start();
            recorder.requestData();
            Rx.Observable.interval(1000).subscribe(() => {
              recorder.requestData();
              this.lastRequested = new Date();
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
          }
        });

    //    document.addEventListener('visibilitychange', () =>
    //      {
    //        if (document.visibilityState === 'visible') {
    //          this.changeDelay(0);
    //        }
    //      });
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

  more() { this.userActions.next('more'); }

  stop() { this.userActions.next('stop'); }

  togglePreview() { this.showPreview = !this.showPreview; }

  set showPreview(value) {
    if (this.preview) {
      if (value) {
        this.preview.play();
      } else {
        this.preview.pause();
      }
    }
    this.showPreview_ = value;
  }

  get showPreview() { return this.showPreview_; }

  get isError() {
    return this.isNotFoundError || this.isPermissionDeniedError ||
        this.isUnsupportedBrowser;
  }

  executeUserAction(action: UserAction): Rx.Observable<PlayerAction> {
    switch (action) {
      case 'less':
        return this.changeDelay(-5000);
      case 'more':
        return this.changeDelay(5000);
      case 'stop':
        return Rx.Observable.from([{kind: 'Stop' as 'Stop'}]);
      default:
        const checkExhaustive: never = action;
    }
  }

  changeDelay(ms): Rx.Observable<PlayerAction> {
    this.skip = true;
    this.targetMs = Math.max(this.targetMs + ms, 0);
    const headroom = this.absoluteEndMs - this.targetMs;
    if (headroom < 0) {
      const periods = Math.floor(-headroom / 1000) + 1;
      const x = new Date();
      return Rx.Observable
          .from([
            {kind: 'Pause' as 'Pause'},
            {kind: ('SetTime' as 'SetTime'), timeS: 0},
            {kind: ('SetWaiting' as 'SetWaiting'), timeS: periods},
          ])
          .concat(Rx.Observable.timer((-headroom) % 1000, 1000)
                      .take(periods)
                      .switchMap((i: number): Rx.Observable<PlayerAction> => {
                        const x = new Date();
                        if (i < periods - 1) {
                          return Rx.Observable.from([{
                            kind: ('SetWaiting' as 'SetWaiting'),
                            timeS: periods - 1 - i
                          }]);
                        } else {
                          return Rx.Observable.from(
                              [{kind: ('Play' as 'Play')}]);
                        }
                      }));
    } else {
      if (this.targetMs === 0) {
        return Rx.Observable.from([{kind: ('SetLive' as 'SetLive')}]);
      }
      return Rx.Observable.from([
        {
          kind: 'SetTime' as 'SetTime',
          timeS: (this.absoluteEndMs - this.targetMs) / 1000
        },
        {kind: ('Play' as 'Play')}
      ]);
    }
  }

  executePlayerAction(action: PlayerAction) {
    switch (action.kind) {
      case 'SetLive':
        console.log('set live');
        if (!this.isLive) {
          this.showPreview = false;
          this.liveVideo.play();
          this.video.pause();
          this.isLive = true;
        }
        break;
      case 'Play':
        console.log('playing');
        this.switchToDelayed();
        this.waitTime = 0;
        this.video.play();
        this.showDelay();
        break;
      case 'Pause':
        console.log('pausing');
        this.switchToDelayed();
        this.video.pause();
        this.showDelay();
        break;
      case 'SetTime':
        console.log('setting time', action);
        this.video.currentTime = action.timeS;
        this.showDelay();
        break;
      case 'SetWaiting':
        console.log('setting waiting', action);
        this.video.currentTime = 0;
        this.waitTime = action.timeS;
        this.showDelay();
        break;
      case 'Stop':
        console.log('stopping');
        this.showPreview = false;
        if (this.mediaStream) {
          for (const mediaStreamTrack of this.mediaStream.getTracks()) {
            mediaStreamTrack.stop();
          }
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

  get absoluteEndMs() {
    if (!this.lastRequested || this.sourceBuffer.buffered.length === 0) {
      return 0;
    }
    const now = new Date().getTime();
    const timeSinceLastRequestMs = now - this.lastRequested.getTime();
    return 1000 * this.sourceBuffer.buffered.end(0) + timeSinceLastRequestMs;
  }

  get delayMs() {
    if (this.isLive) {
      return 0;
    } else {
      return this.absoluteEndMs - this.video.currentTime * 1000;
    }
  }

  get isWaiting() { return this.waitTime <= 0; }

  showDelay() { this.displayedDelay = this.delayMs / 1000; }
}
