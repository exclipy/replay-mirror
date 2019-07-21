import { Injectable } from '@angular/core';

declare var MediaRecorder: any;

@Injectable()
export class BrowserParamsService {
  mimeType: string | undefined;
  isUnsupportedBrowser = false;

  constructor() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.isUnsupportedBrowser = true;
      return;
    }
    this.mimeType = getMimeType();
    if (!this.mimeType) {
      this.isUnsupportedBrowser = true;
    }
  }
}

function getMimeType(): string | undefined {
  try {
    return ['video/webm\;codecs=vp9', 'video/webm\;codecs=vp8'].find(
      (mimeType) => MediaRecorder.isTypeSupported(mimeType));
  } catch (e) {
    return undefined;
  }
}
