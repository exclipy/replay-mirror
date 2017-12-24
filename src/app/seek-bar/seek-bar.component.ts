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
    return asPercent(Math.min(1, this.totalTime / this.totalWidthDurationS));
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
}

function asPercent(n: number) {
  return n * 100 + '%';
}
