/// <reference types="@types/dom-mediacapture-record" />
// tslint:disable: member-ordering
import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {Action, select, Store} from '@ngrx/store';
import {concat, from, interval, Observable, of, timer} from 'rxjs';
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
import {changeDelayParams, isEnded, isLive} from './viewer.selectors';

const REQUEST_DATA_INTERVAL_MS = 1000;

@Injectable()
export class ViewerEffects {
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
          this.store.dispatch(
            ViewerActions.setLegacy({
              payload: {
                targetMs: 0,
                isEnded: false,
                isLive: true,
                isPermissionDeniedError: false,
                isNotFoundError: false,
                isUnknownError: false,
                waitTime: 0,
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
                this.store.dispatch(ViewerActions.finishInit());
              });
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
                this.store.dispatch(ViewerActions.setLegacy({payload: {isNotFoundError: true}}));
              } else {
                this.store.dispatch(ViewerActions.setLegacy({payload: {isUnknownError: true}}));
                console.log('Unknown error:', e);
              }
            });
        }),
      ),
    {dispatch: false},
  );

  finishInit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.finishInit),
        switchMap(() =>
          interval(REQUEST_DATA_INTERVAL_MS).pipe(
            withLatestFrom(this.store.select(isEnded)),
            map(([_, isEnded]) => {
              if (!isEnded) {
                this.videoService.mediaRecorder!.requestData();
              }
              return isEnded;
            }),
            takeWhile(isEnded => !isEnded),
          ),
        ),
      ),
    {dispatch: false},
  );

  onDataAvailableActions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.onDataAvailable),
      withLatestFrom(this.store.select(isEnded)),
      concatMap(
        ([action, isEnded]): Observable<Action> => {
          if (isEnded) {
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

  updateTime$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.updateTime),
      map(() => this.createSetTimeStateAction()),
    ),
  );

  private createSetTimeStateAction(): Action {
    return ViewerActions.setTimeState({
      now: new Date(),
      bufferedTimeRanges: this.videoService.sourceBuffer!.buffered,
      currentTimeS: this.videoService.video!.currentTime,
    });
  }

  userActions$ = createEffect(() => {
    return this.actions$.pipe(
      ofType(
        ViewerActions.less,
        ViewerActions.more,
        ViewerActions.stopRecord,
        ViewerActions.foregrounded,
      ),
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
          case ViewerActions.foregrounded.type:
            return this.changeDelay(0, params);
        }
      }),
    );
  });

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
    const headroom = params.absoluteEndMs - targetMs;
    if (headroom < 0) {
      const periods = Math.floor(-headroom / 1000) + 1;
      return concat(
        from([ViewerActions.goToBeforeStart({targetMs, waitingS: periods})]),
        timer(-headroom % 1000, 1000).pipe(
          takeUntil(
            this.store.pipe(
              select(isEnded),
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
    } else if (targetMs <= params.timeSinceLastReceivedMs && !params.isEnded) {
      return of(ViewerActions.goToLive());
    } else if (targetMs > params.timeSinceLastReceivedMs) {
      return of(ViewerActions.goTo({timeS: (params.absoluteEndMs - targetMs) / 1000, targetMs}));
    } else {
      return of(ViewerActions.goToEnd());
    }
  }

  doStopRecord$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.doStopRecord),
      withLatestFrom(this.store.select(isLive)),
      map(([_, isLive]) => {
        if (isLive) {
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
        return ViewerActions.setLegacy({payload: {isLive: false, isEnded: true}});
      }),
    ),
  );

  play$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.play),
      map(() => {
        this.videoService.liveVideo!.pause();
        this.videoService.video!.play();
        return ViewerActions.setLegacy({
          payload: {waitTime: 0, isLive: false},
        });
      }),
    ),
  );

  goToBeforeStart$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.goToBeforeStart),
        tap(() => {
          this.videoService.liveVideo!.pause();
          this.videoService.video!.pause();
          this.videoService.video!.currentTime = 0;
        }),
      ),
    {dispatch: false},
  );

  goTo$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.goTo),
        tap(action => {
          this.videoService.liveVideo!.pause();
          this.videoService.video!.currentTime = action.timeS;
          this.videoService.video!.play();
        }), // TODO: also set the TimeState here to avoid the flash
      ),
    {dispatch: false},
  );

  goToLive$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.goToLive),
        tap(() => {
          this.videoService.liveVideo!.play();
          this.videoService.video!.pause();
        }),
      ),
    {dispatch: false},
  );

  goToEnd$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.goToEnd),
        tap(() => {
          this.videoService.video!.currentTime = this.videoService.video!.duration;
        }),
      ),
    {dispatch: false},
  );

  setWaiting$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setWaiting),
        tap(action => {
          this.videoService.video!.currentTime = 0;
          this.store.dispatch(ViewerActions.setLegacy({payload: {waitTime: action.timeS}}));
        }),
      ),
    {dispatch: false},
  );
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
