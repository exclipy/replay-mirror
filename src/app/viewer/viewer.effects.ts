/// <reference types="@types/dom-mediacapture-record" />

import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {Action, select, Store} from '@ngrx/store';
import {concat, from, interval, Observable, timer} from 'rxjs';
import {
  concatMap,
  filter,
  map,
  startWith,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import {BrowserParamsService} from '../browser-params.service';
import {State} from '../reducers';
import {VideoService} from './video.service';
import * as ViewerActions from './viewer.actions';
import {changeDelayParams} from './viewer.selectors';

@Injectable()
export class ViewerEffects {
  private isEnded = false;
  private isLive = true;
  private isNotFoundError = false;
  private isUnknownError = false;
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
          this.isEnded = false;
          this.isLive = true;
          this.isNotFoundError = false;
          this.isUnknownError = false;
          this.waitTime = 0;

          this.store.dispatch(
            ViewerActions.setLegacy({
              payload: {
                targetMs: 0,
                isEnded: this.isEnded,
                isLive: this.isLive,
                isInitialized: false,
                isPermissionDeniedError: false,
                isNotFoundError: this.isNotFoundError,
                isUnknownError: this.isUnknownError,
                waitTime: this.waitTime,
              },
            }),
          );
          this.videoService.bufferSource = new MediaSource();

          const mimeType = this.browserParams.mimeType!;

          navigator.mediaDevices
            .getUserMedia({video: {facingMode: 'user'}})
            .then(mediaStream => {
              this.videoService.mediaStream = mediaStream;
              this.videoService.mediaRecorder = new MediaRecorder(mediaStream, {mimeType});
              this.videoService.bufferSource!.addEventListener('sourceopen', () => {
                this.videoService.sourceBuffer = this.videoService.bufferSource!.addSourceBuffer(
                  mimeType,
                );

                this.videoService.mediaRecorder!.ondataavailable = e => {
                  this.store.dispatch(ViewerActions.onDataAvailable({data: e.data}));
                };
                this.videoService.mediaRecorder!.start();
                this.videoService.mediaRecorder!.requestData();
                interval(1000)
                  .pipe(
                    map(() => {
                      if (!this.isEnded) {
                        this.videoService.mediaRecorder!.requestData();
                      }
                      return this.isEnded;
                    }),
                    takeWhile(isEnded => !isEnded),
                  )
                  .subscribe();
                this.store.dispatch(ViewerActions.setLegacy({payload: {isInitialized: true}}));
              });
              this.isLive = true;
              this.store.dispatch(ViewerActions.setLegacy({payload: {isLive: this.isLive}}));
              this.videoService.video!.src = window.URL.createObjectURL(
                this.videoService.bufferSource,
              );
              this.videoService.video!.pause();
              bindStream(this.videoService.liveVideo!, this.videoService.mediaStream);
              this.videoService.liveVideo!.play();
              bindStream(this.videoService.preview!, this.videoService.mediaStream);
              this.videoService.preview!.pause();
            })
            .catch(e => {
              if (
                e.name === 'PermissionDeniedError' || // Chrome
                e.name === 'NotAllowedError'
              ) {
                // Firefox
                this.store.dispatch(
                  ViewerActions.setLegacy({payload: {isPermissionDeniedError: true}}),
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

  onDataAvailableActions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.onDataAvailable),
      concatMap(
        (action): Observable<Action> => {
          if (this.isEnded) {
            this.videoService.mediaRecorder!.ondataavailable = () => {};
            return from([ViewerActions.setLastReceived({date: new Date()})]);
          }
          const fileReader = new FileReader();
          fileReader.onload = f => {
            this.videoService.sourceBuffer!.appendBuffer((f.target as any).result);
          };
          fileReader.readAsArrayBuffer(action.data);
          return from([
            this.createSetTimeStateAction(),
            ViewerActions.setLastReceived({date: new Date()}),
          ]);
        },
      ),
    ),
  );

  userActions$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ViewerActions.less, ViewerActions.more, ViewerActions.stopRecord),
      withLatestFrom(this.store.pipe(select(changeDelayParams))),
      switchMap(([action, params]) => {
        switch (action.type) {
          case ViewerActions.less.type:
            return this.changeDelay(-5000, params);
          case ViewerActions.more.type:
            return this.changeDelay(5000, params);
          case ViewerActions.stopRecord.type:
            return this.changeDelay(0, {...params, noWait: true}).pipe(
              startWith(ViewerActions.doStopRecord()),
            );
        }
      }),
    );
  });

  // System actions
  foregrounded$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(ViewerActions.foregrounded),
      withLatestFrom(this.store.pipe(select(changeDelayParams))),
      switchMap(([_, params]) => {
        return this.changeDelay(0, params);
      }),
    );
  });

  updateTime$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.updateTime),
      map(() => this.createSetTimeStateAction()),
    ),
  );

  // Player Actions
  doStopRecord$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.doStopRecord),
      map(() => {
        if (this.isLive) {
          this.videoService.liveVideo!.pause();
          this.videoService.video!.play();
        }
        if (this.videoService.mediaStream) {
          for (const mediaStreamTrack of this.videoService.mediaStream.getTracks()) {
            mediaStreamTrack.stop();
          }
        }
        this.videoService.bufferSource!.endOfStream();
        if (this.videoService.mediaRecorder) {
          this.videoService.mediaRecorder.stop();
        }
        this.isEnded = true;
        this.isLive = false;
        return ViewerActions.setLegacy({payload: {isLive: this.isLive, isEnded: this.isEnded}});
      }),
    ),
  );

  setLive$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setLive),
        tap(() => {
          if (!this.isLive) {
            this.videoService.liveVideo!.play();
            this.videoService.video!.pause();
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

  play$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.play),
      map(() => {
        if (this.isLive) {
          this.videoService.liveVideo!.pause();
          this.videoService.video!.play();
        }
        this.videoService.video!.play();
        this.waitTime = 0;
        this.isLive = false;
        return ViewerActions.setLegacy({
          payload: {waitTime: 0, isLive: false},
        });
      }),
    ),
  );

  pause$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.pause),
      map(() => {
        this.videoService.liveVideo!.pause();
        this.videoService.video!.play();
        this.videoService.video!.pause();
        this.isLive = false;
        return ViewerActions.setLegacy({payload: {isLive: this.isLive}});
      }),
    ),
  );

  setTime$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setTime),
        tap(action => {
          this.videoService.video!.currentTime = action.timeS;
        }), // TODO: also set the TimeState here to avoid the flash
      ),
    {dispatch: false},
  );

  setWaiting$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setWaiting),
        tap(action => {
          this.videoService.video!.currentTime = 0;
          this.waitTime = action.timeS;
          this.store.dispatch(ViewerActions.setLegacy({payload: {waitTime: this.waitTime}}));
        }),
      ),
    {dispatch: false},
  );

  private createSetTimeStateAction(): Action {
    return ViewerActions.setTimeState({
      now: new Date(),
      bufferedTimeRanges: this.videoService.sourceBuffer!.buffered,
      currentTimeS: this.videoService.video!.currentTime,
    });
  }

  private changeDelay(
    ms: number,
    params: {
      timeSinceLastReceivedMs: number;
      targetMs: number;
      absoluteEndMs: number;
      isEnded: boolean;
      delayMs: number;
      noWait?: boolean;
    },
  ): Observable<Action> {
    params.noWait = params.noWait || false;
    let targetMs = params.isEnded
      ? Math.max(params.delayMs + ms, params.timeSinceLastReceivedMs)
      : Math.max(params.targetMs + ms, 0);
    if (params.noWait || params.isEnded) {
      // Don't allow the currentTime to be before the start.
      targetMs = Math.min(targetMs, params.absoluteEndMs);
    }
    const actions: Action[] = [];
    actions.push(ViewerActions.setLegacy({payload: {targetMs}}));
    const headroom = params.absoluteEndMs - targetMs;
    if (headroom < 0) {
      const periods = Math.floor(-headroom / 1000) + 1;
      return concat(
        from([
          ...actions,
          ViewerActions.pause(),
          ViewerActions.setTime({timeS: 0}),
          ViewerActions.setWaiting({timeS: periods}),
        ]),
        timer(-headroom % 1000, 1000).pipe(
          takeUntil(
            this.store.pipe(
              select(state => state.viewer.legacy.isEnded),
              filter(x => x),
            ),
          ),
          take(periods),
          map(i =>
            i < periods - 1
              ? ViewerActions.setWaiting({timeS: periods - 1 - i})
              : ViewerActions.play(),
          ),
        ),
      );
    } else {
      if (targetMs <= params.timeSinceLastReceivedMs && !params.isEnded) {
        return from([...actions, ViewerActions.setLive()]);
      }
      actions.push(ViewerActions.setTime({timeS: (params.absoluteEndMs - targetMs) / 1000}));
      if (targetMs > params.timeSinceLastReceivedMs) {
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
