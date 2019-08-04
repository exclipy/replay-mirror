import {Injectable} from '@angular/core';

declare type MediaRecorder = any;
declare var MediaRecorder: any;

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  mediaStream: MediaStream | undefined;
  mediaRecorder: MediaRecorder | undefined;
  video: HTMLVideoElement | undefined;
  liveVideo: HTMLVideoElement | undefined;
  preview: HTMLVideoElement | undefined;
  bufferSource: MediaSource | undefined;
  sourceBuffer: SourceBuffer | undefined;

  constructor() {}
}
