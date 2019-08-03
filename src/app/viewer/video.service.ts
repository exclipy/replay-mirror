import {Injectable} from '@angular/core';

declare type MediaRecorder = any;
declare var MediaRecorder: any;

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  mediaStream: MediaStream | null;
  mediaRecorder: MediaRecorder | null;
  video: HTMLVideoElement;
  liveVideo: HTMLVideoElement;
  preview: HTMLVideoElement;
  bufferSource: MediaSource;
  sourceBuffer: SourceBuffer | null;

  constructor() {}
}
