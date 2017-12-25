import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-seek-bar',
  templateUrl: './seek-bar.component.html',
  styleUrls: ['./seek-bar.component.css']
})
export class SeekBarComponent {
  @Input() currentTime: number = 0;
  @Input() totalTime: number = 0;
  @Input() targetDelay: number = 0;
  @Input() displayedDelay: number = 0;
  @Input() isEnded: boolean = false;

  constructor() {}

  get totalWidthDurationS() {
    if (this.isEnded) {
      return this.totalTime;
    } else {
      return Math.max(this.targetDelay * 1.5, 60);
    }
  }

  get knobPosition() {
    return asPercent(1 - this.timeToEnd / this.totalWidthDurationS);
  }

  get bufferBarWidth() {
    return asPercent(this.totalTime / this.totalWidthDurationS);
  }

  get timeToEnd() {
    if (this.isEnded) {
      return this.totalTime - this.currentTime;
    } else if (this.targetDelay > this.totalTime) {
      return this.targetDelay;
    } else {
      return this.displayedDelay;
    }
  }

  get bufferBarBackground() {
    if (this.isEnded) {
      return '#999';
    } else {
      const timeCompression = this.totalWidthDurationS / 60;
      const angle = Math.atan(timeCompression);
      const period = 8 * Math.cos(Math.atan(timeCompression)) / timeCompression;
      const angleStr = angle.toPrecision(4);
      const periodStr = period.toPrecision(4);
      const period2Str = (period * 2).toPrecision(4);
      const result = (`repeating-linear-gradient(${angleStr}rad, transparent, transparent ${periodStr}px, #999 ${periodStr}px, #999 ${period2Str}px)`);
      console.log(result);
      return result;
    }
  }
}

function asPercent(n: number) {
  return n * 100 + '%';
}
