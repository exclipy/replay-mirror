import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {Action, select, Store} from '@ngrx/store';
import {concat, from, interval, Observable, timer} from 'rxjs';
import {filter, map, startWith, switchMap, take, takeUntil, takeWhile, tap} from 'rxjs/operators';
import {BrowserParamsService} from '../browser-params.service';
import {State} from '../reducers';
import {VideoService} from './video.service';
import * as ViewerActions from './viewer.actions';

declare type MediaRecorder = any;
declare var MediaRecorder: any;

@Injectable()
export class ViewerEffects {
  private targetMs = 0;
  private adjustIntervalId: number | null = 0;
  private lastReceived: Date | null = null;
  private isEnded = false;
  private isLive = true;
  private isInitialized = false;
  private isUnsupportedBrowser = false;
  private isPermissionDeniedError = false;
  private isNotFoundError = false;
  private isUnknownError = false;
  private currentTime = 0;
  private totalTime = 0;
  private displayedDelay = 0;
  private waitTime = 0;

  constructor(
    private browserParams: BrowserParamsService,
    private videoService: VideoService,
    private actions$: Actions,
    private store: Store<State>,
  ) {}

  // User actions
  init$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.init),
        tap(() => {
          this.targetMs = 0;
          this.adjustIntervalId = 0;
          this.lastReceived = null;
          this.isEnded = false;
          this.isLive = true;
          this.isInitialized = false;
          this.isUnsupportedBrowser = false;
          this.isPermissionDeniedError = false;
          this.isNotFoundError = false;
          this.isUnknownError = false;
          this.currentTime = 0;
          this.totalTime = 0;
          this.displayedDelay = 0;
          this.waitTime = 0;

          this.store.dispatch(
            ViewerActions.setLegacy({
              payload: {
                targetMs: this.targetMs,
                adjustIntervalId: this.adjustIntervalId,
                lastReceived: this.lastReceived,
                isEnded: this.isEnded,
                isLive: this.isLive,
                isUnsupportedBrowser: this.isUnsupportedBrowser,
                isPermissionDeniedError: this.isPermissionDeniedError,
                isNotFoundError: this.isNotFoundError,
                isUnknownError: this.isUnknownError,
                currentTime: this.currentTime,
                totalTime: this.totalTime,
                displayedDelay: this.displayedDelay,
                waitTime: this.waitTime,
              },
            }),
          );
          this.videoService.bufferSource = new MediaSource();

          const mimeType = this.browserParams.mimeType;

          navigator.mediaDevices
            .getUserMedia({video: {facingMode: 'user'}})
            .then(mediaStream => {
              this.videoService.mediaStream = mediaStream;
              this.videoService.mediaRecorder = new MediaRecorder(mediaStream, {mimeType});
              this.videoService.bufferSource.addEventListener('sourceopen', () => {
                this.videoService.sourceBuffer = this.videoService.bufferSource.addSourceBuffer(
                  mimeType,
                );

                this.videoService.mediaRecorder.ondataavailable = e => {
                  if (this.isEnded) {
                    this.videoService.mediaRecorder.ondataavailable = null;
                    return;
                  }
                  this.showDelay();
                  this.lastReceived = new Date();
                  this.store.dispatch(
                    ViewerActions.setLegacy({payload: {lastReceived: this.lastReceived}}),
                  );
                  const fileReader = new FileReader();
                  fileReader.onload = f => {
                    this.videoService.sourceBuffer.appendBuffer((f.target as any).result);
                  };
                  fileReader.readAsArrayBuffer(e.data);
                };
                this.videoService.mediaRecorder.start();
                this.videoService.mediaRecorder.requestData();
                interval(1000)
                  .pipe(
                    map(() => {
                      if (!this.isEnded) {
                        this.videoService.mediaRecorder.requestData();
                      }
                      return this.isEnded;
                    }),
                    takeWhile(isEnded => !isEnded),
                  )
                  .subscribe();
                this.isInitialized = true;
                this.store.dispatch(
                  ViewerActions.setLegacy({payload: {isInitialized: this.isInitialized}}),
                );
              });
              this.isLive = true;
              this.store.dispatch(ViewerActions.setLegacy({payload: {isLive: this.isLive}}));
              this.videoService.video.src = window.URL.createObjectURL(
                this.videoService.bufferSource,
              );
              this.videoService.video.pause();
              bindStream(this.videoService.liveVideo, this.videoService.mediaStream);
              this.videoService.liveVideo.play();
              bindStream(this.videoService.preview, this.videoService.mediaStream);
              this.videoService.preview.pause();
            })
            .catch(e => {
              if (
                e.name === 'PermissionDeniedError' || // Chrome
                e.name === 'NotAllowedError'
              ) {
                // Firefox
                this.isPermissionDeniedError = true;
                this.store.dispatch(
                  ViewerActions.setLegacy({
                    payload: {isPermissionDeniedError: this.isPermissionDeniedError},
                  }),
                );
              } else if (e.name === 'NotFoundError') {
                this.isNotFoundError = true;
                this.store.dispatch(
                  ViewerActions.setLegacy({payload: {isNotFoundError: this.isNotFoundError}}),
                );
              } else {
                this.isUnknownError = true;
                this.store.dispatch(
                  ViewerActions.setLegacy({payload: {isUnknownError: this.isUnknownError}}),
                );
                console.log('Unknown error:', e);
              }
            });
        }),
      ),
    {dispatch: false},
  );

  userActions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.less, ViewerActions.more, ViewerActions.stopRecord),
      switchMap(action => {
        switch (action.type) {
          case ViewerActions.less.type:
            return this.changeDelay(-5000);
          case ViewerActions.more.type:
            return this.changeDelay(5000);
          case ViewerActions.stopRecord.type:
            return this.changeDelay(0, true).pipe(startWith(ViewerActions.doStopRecord()));
        }
      }),
    ),
  );

  // System actions
  foregrounded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.foregrounded),
      switchMap(() => this.changeDelay(0)),
    ),
  );

  updateTime$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.updateTime),
        tap(() => {
          this.showDelay();
        }),
      ),
    {dispatch: false},
  );

  // Player Actions
  doStopRecord$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.doStopRecord),
        tap(() => {
          this.isEnded = true;
          this.store.dispatch(ViewerActions.setLegacy({payload: {isEnded: this.isEnded}}));
          this.switchToDelayed();
          if (this.videoService.mediaStream) {
            for (const mediaStreamTrack of this.videoService.mediaStream.getTracks()) {
              mediaStreamTrack.stop();
            }
          }
          this.videoService.bufferSource.endOfStream();
          if (this.videoService.mediaRecorder) {
            this.videoService.mediaRecorder.stop();
          }
          if (this.adjustIntervalId) {
            window.clearInterval(this.adjustIntervalId);
          }
        }),
      ),
    {dispatch: false},
  );

  setLive$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setLive),
        tap(() => {
          if (!this.isLive) {
            this.videoService.liveVideo.play();
            this.videoService.video.pause();
            this.waitTime = 0;
            this.isLive = true;
            this.store.dispatch(
              ViewerActions.setLegacy({payload: {waitTime: this.waitTime, isLive: this.isLive}}),
            );
          }
        }),
      ),
    {dispatch: false},
  );

  play$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.play),
        tap(() => {
          this.switchToDelayed();
          this.videoService.video.play();
          this.waitTime = 0;
          this.store.dispatch(
            ViewerActions.setLegacy({
              payload: {waitTime: this.waitTime},
            }),
          );
        }),
      ),
    {dispatch: false},
  );

  pause$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.pause),
        tap(() => {
          this.switchToDelayed();
          this.videoService.video.pause();
        }),
      ),
    {dispatch: false},
  );

  setTime$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setTime),
        tap(action => {
          this.videoService.video.currentTime = action.timeS;
        }),
      ),
    {dispatch: false},
  );

  setWaiting$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setWaiting),
        tap(action => {
          this.videoService.video.currentTime = 0;
          this.waitTime = action.timeS;
          this.store.dispatch(ViewerActions.setLegacy({payload: {waitTime: this.waitTime}}));
        }),
      ),
    {dispatch: false},
  );

  switchToDelayed() {
    if (this.isLive) {
      this.videoService.liveVideo.pause();
      this.videoService.video.play();
      this.isLive = false;
      this.store.dispatch(ViewerActions.setLegacy({payload: {isLive: this.isLive}}));
    }
  }

  get timeSinceLastReceivedMs() {
    if (!this.lastReceived) {
      return 0;
    }
    const now = new Date().getTime();
    return now - this.lastReceived.getTime();
  }

  get absoluteEndMs() {
    if (!this.lastReceived || this.videoService.sourceBuffer.buffered.length === 0) {
      return 0;
    }
    const result = 1000 * this.videoService.sourceBuffer.buffered.end(0);
    return result + this.timeSinceLastReceivedMs;
  }

  get delayMs() {
    if (this.isLive) {
      return 0;
    } else {
      return this.absoluteEndMs - this.videoService.video.currentTime * 1000;
    }
  }

  showDelay() {
    this.totalTime = this.videoService.sourceBuffer.buffered.length
      ? this.videoService.sourceBuffer.buffered.end(0)
      : 0;
    if (!this.isEnded) {
      this.totalTime += this.timeSinceLastReceivedMs / 1000;
    }
    this.currentTime = this.isLive ? this.totalTime : this.videoService.video.currentTime;
    this.displayedDelay = this.delayMs / 1000;
    this.store.dispatch(
      ViewerActions.setLegacy({
        payload: {
          totalTime: this.totalTime,
          currentTime: this.currentTime,
          displayedDelay: this.displayedDelay,
        },
      }),
    );
  }

  private changeDelay(ms: number, noWait = false): Observable<Action> {
    this.targetMs = this.isEnded
      ? Math.max(this.delayMs + ms, this.timeSinceLastReceivedMs)
      : Math.max(this.targetMs + ms, 0);
    if (noWait || this.isEnded) {
      // Don't allow the currentTime to be before the start.
      this.targetMs = Math.min(this.targetMs, this.absoluteEndMs);
    }
    this.store.dispatch(
      ViewerActions.setLegacy({
        payload: {targetMs: this.targetMs},
      }),
    );
    this.store.dispatch(ViewerActions.setLegacy({payload: {targetMs: this.targetMs}}));
    const headroom = this.absoluteEndMs - this.targetMs;
    if (headroom < 0) {
      const periods = Math.floor(-headroom / 1000) + 1;
      return concat(
        from([
          ViewerActions.pause(),
          ViewerActions.setTime({timeS: 0}),
          ViewerActions.setWaiting({timeS: periods}),
        ]),
        timer(-headroom % 1000, 1000).pipe(
          takeUntil(
            this.store.pipe(
              select('viewer', 'legacy', 'isEnded'),
              filter(x => x),
            ),
          ),
          take(periods),
          switchMap(
            (i: number): Observable<Action> => {
              if (i < periods - 1) {
                return from([ViewerActions.setWaiting({timeS: periods - 1 - i})]);
              } else {
                return from([ViewerActions.play()]);
              }
            },
          ),
        ),
      );
    } else {
      if (this.targetMs <= this.timeSinceLastReceivedMs && !this.isEnded) {
        return from([ViewerActions.setLive()]);
      }
      const actions: Action[] = [
        ViewerActions.setTime({
          timeS: (this.absoluteEndMs - this.targetMs) / 1000,
        }),
      ];
      if (this.targetMs > this.timeSinceLastReceivedMs) {
        actions.push(ViewerActions.play());
      }
      return from(actions);
    }
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
