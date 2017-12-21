import { Component } from '@angular/core';
import * as Rx from 'rxjs/Rx';

declare var MediaRecorder: any;

type UserAction = 'more' | 'less' | 'stop';

type PauseAction = { kind: 'Pause' };
type PlayAction = { kind: 'Play' };
type StopAction = { kind: 'Stop' };
type SetTimeAction = { kind: 'SetTime', timeS: number };
type SetWaitingAction = { kind: 'SetWaiting', timeS: number };

type PlayerAction = PauseAction |
  PlayAction |
  StopAction |
  SetTimeAction |
  SetWaitingAction;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private target = 0;
  private skip = false;
  private mediaStream: MediaStream;
  private adjustIntervalId: number|null;
  private video: HTMLVideoElement;
  displayedDelay = 0;
  waitTime = 0;

  private userActions = new Rx.Subject<UserAction>();
  private playerActions: Rx.Observable<PlayerAction>;

  constructor() {
    this.target = 0;
    this.skip = false;
    this.mediaStream = null;
    this.adjustIntervalId = null;

    this.playerActions = this.userActions.switchMap((userAction) =>
        this.executeUserAction(userAction));
    this.playerActions.subscribe((action) => {
      this.executePlayerAction(action);
    });
  }

  ngOnInit() {
    this.start();
  }

  start() {
    this.video = document.querySelector('#video') as HTMLVideoElement;
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true }).then((mediaStream) => {
        this.mediaStream = mediaStream;
        const recorder = new MediaRecorder(mediaStream, {mimeType: 'video/webm; codecs=vp9'}) as any;
        const source = new MediaSource();
        source.addEventListener('sourceopen', () => {
          const sourceBuffer = source.addSourceBuffer('video/webm; codecs=vp9');

          recorder.ondataavailable = (e) => {
            const fileReader = new FileReader();
            fileReader.onload = (f) => {
              sourceBuffer.appendBuffer((f.target as any).result);
            };
            fileReader.readAsArrayBuffer(e.data);
          }
          recorder.start();
          recorder.requestData();
          window.setInterval(() => recorder.requestData(), 1000);
          this.video.play();
        });
        this.video.src = window.URL.createObjectURL(source);
      });
    }

    //    document.addEventListener('visibilitychange', () =>
    //      {
    //        if (document.visibilityState === 'visible') {
    //          this.changeDelay(0);
    //        }
    //      });
    //
    //    this.adjustIntervalId = window.setInterval(() => {
    //      if (!this.skip && this.video.currentTime !== undefined && this.video.buffered.length > 0) {
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

  less() {
    this.userActions.next('less');
  }

  more() {
    this.userActions.next('more');
  }

  stop() {
    this.userActions.next('stop');
  }

  executeUserAction(action: UserAction): Rx.Observable<PlayerAction> {
    switch (action) {
      case 'less':
        console.log('less');
        return this.changeDelay(-5000);
      case 'more':
        console.log('more');
        return this.changeDelay(5000);
      case 'stop':
        console.log('stop');
        return Rx.Observable.from([{kind: 'Stop' as 'Stop'}]);
      default:
        const checkExhaustive : never = action;
    }
  }

  changeDelay(ms): Rx.Observable<PlayerAction> {
    this.skip = true;
    this.target = Math.max(this.target + ms, 0);
    const headroom = this.video.buffered.end(0) * 1000 - this.target;
    if (headroom < 0) {
      console.log('a ---->', -headroom % 1000, Math.floor(-headroom / 1000) + 1)
      const periods = Math.floor(-headroom / 1000) + 1;
      const x = new Date();
      console.log(-1, x.getSeconds(), x.getMilliseconds());
      return Rx.Observable.from([
        {kind: 'Pause' as 'Pause'},
        {kind: ('SetWaiting' as 'SetWaiting'), timeS: periods},
      ]).concat(
        Rx.Observable.timer(-headroom % 1000, 1000)
            .take(periods)
            .switchMap((i: number): Rx.Observable<PlayerAction> => {
              const x = new Date();
              console.log(i, x.getSeconds(), x.getMilliseconds());
              if (i < periods - 1) {
                return Rx.Observable.from([
                  {
                    kind: ('SetWaiting' as 'SetWaiting'),
                    timeS: periods - 1 - i
                  }]);
              } else {
                return Rx.Observable.from([
                  {kind: ('Play' as 'Play')},
                  {kind: ('SetTime' as 'SetTime'), timeS: 0}]);
              }
            }));
    } else {
      console.log('b');
      return Rx.Observable.from([
        {kind: ('Play' as 'Play')},
        {
          kind: 'SetTime' as 'SetTime',
          timeS: this.video.buffered.end(0) - this.target / 1000
        }]);
    }
  }

  executePlayerAction(action: PlayerAction) {
    switch (action.kind) {
      case 'Play':
        console.log('playing');
        this.waitTime = 0;
        this.video.play();
        this.showDelay();
        break;
      case 'Pause':
        console.log('pausing');
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
        const checkExhaustive : never = action;
    }
  }

  get delayMs() {
    return 1000 * (this.video.buffered.end(0) - this.video.currentTime);
  }

  get isWaiting() {
    return this.waitTime <= 0;
  }

  showDelay() {
    if (this.video.currentTime !== undefined && this.video.buffered.length > 0) {
      const total = this.video.buffered.end(0);
      const currentTime = this.video.currentTime;
      this.displayedDelay = total - this.video.currentTime;
      document.getElementById('target').innerHTML = (this.target / 1000).toPrecision(2) + 's';
      document.getElementById('currentTime').innerHTML = this.video.currentTime.toPrecision(2) + 's';
      document.getElementById('total').innerHTML = total.toPrecision(2) + 's';
    }
  }
}
