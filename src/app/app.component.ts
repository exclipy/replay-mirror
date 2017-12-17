import { Component } from '@angular/core';

declare var MediaRecorder: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  private target: number;
  private skip: boolean;
  private mediaStream: MediaStream;
  private adjustIntervalId: number|null;
  private video: HTMLVideoElement;

  constructor() {
    this.target = 5000;
    this.skip = false;
    this.mediaStream = null;
    this.adjustIntervalId = null;
  }

  ngOnInit() {
    this.start();
    this.video = document.querySelector('#video') as HTMLVideoElement;
  }

  start() {
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

    this.adjustIntervalId = window.setInterval(() => {
      if (!this.skip && this.video.currentTime !== undefined && this.video.buffered.length > 0) {
        console.log('currentTime: ', this.video.currentTime,
            'buffer end: ', this.video.buffered.end(0),
            'delay: ', this.delayMs,
            'delta: ', this.target - this.delayMs);

        let rate = Math.pow(1.5, (this.delayMs - this.target)/1000);
        if (Math.abs(rate - 1) < 0.01) {
          rate = 1;
        }
        this.video.playbackRate = rate;
        console.log('playback rate: ', rate);
        this.showDelay();
      }
    }, 1000);
  }

  stop() {
    if (this.mediaStream) {
      for (const mediaStreamTrack of this.mediaStream.getTracks()) {
        mediaStreamTrack.stop();
      }
    }
    if (this.adjustIntervalId) {
      window.clearInterval(this.adjustIntervalId);
    }
  }

  changeDelay(ms) {
    this.skip = true;
    this.target = Math.max(this.target + ms, 0);
    const headroom = this.video.buffered.end(0) * 1000 - this.target;
    if (headroom < 0) {
      const waitS = Math.floor(-headroom / 1000);
      const waitMs = -headroom % 1000;
      this.video.pause();
      window.setTimeout(() => {
        window.setInterval(() => {

        }, waitS * 1000);
      }, waitMs);
      window.setTimeout(() => {
        this.video.currentTime = 0;
        this.video.play();
        this.showDelay();
      }, this.target - this.delayMs);
    } else {
      this.video.currentTime = this.video.buffered.end(0) - this.target / 1000;
      this.showDelay();
    }
    this.skip = false;
  }

  get delayMs() {
    return 1000 * (this.video.buffered.end(0) - this.video.currentTime);
  }

  showDelay() {
    if (this.video.currentTime !== undefined && this.video.buffered.length > 0) {
      const total = this.video.buffered.end(0);
      const currentTime = this.video.currentTime;
      const delay = total - this.video.currentTime;
      document.getElementById('target').innerHTML = (this.target / 1000).toPrecision(2) + 's';
      document.getElementById('delay').innerHTML = delay.toPrecision(2) + 's';
      document.getElementById('currentTime').innerHTML = this.video.currentTime.toPrecision(2) + 's';
      document.getElementById('total').innerHTML = total.toPrecision(2) + 's';
    }
  }
}
