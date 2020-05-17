/// <reference types="@types/dom-mediacapture-record" />
// tslint:disable: member-ordering
import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {Action, select, Store} from '@ngrx/store';
import {concat, EMPTY, from, interval, Observable, of, timer} from 'rxjs';
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
import {Status} from '../reducers/viewer.reducer';
import {delayToTimeMs, timeToDelayMs} from './timeUtils';
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
          this.videoService.bufferSource = new MediaSource();

          const mimeType = this.browserParams.mimeType!;

          console.log({
            video: {
              facingMode: localStorage.getItem('videoCamera')!,
              height: parseInt(localStorage.getItem('videoQuality')!),
            },
          });
          navigator.mediaDevices
            .getUserMedia({
              video: {
                facingMode: localStorage.getItem('videoCamera')!,
                height: parseInt(localStorage.getItem('videoQuality')!),
              },
            })
            .then((mediaStream) => {
              this.videoService.mediaStream = mediaStream;
              this.videoService.mediaRecorder = new MediaRecorder(mediaStream, {mimeType});
              this.videoService.bufferSource!.addEventListener('sourceopen', () => {
                this.videoService.sourceBuffer = this.videoService.bufferSource!.addSourceBuffer(
                  mimeType,
                );

                this.videoService.mediaRecorder!.ondataavailable = (e) => {
                  this.store.dispatch(ViewerActions.onDataAvailable({data: e.data}));
                };
                this.videoService.mediaRecorder!.start();
                this.videoService.mediaRecorder!.requestData();
                this.store.dispatch(ViewerActions.finishInit({now: new Date()}));
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
            .catch((e) => {
              if (
                e.name === 'PermissionDeniedError' || // Chrome
                e.name === 'NotAllowedError' // Firefox
              ) {
                this.store.dispatch(ViewerActions.setError({status: Status.PermissionDeniedError}));
              } else if (e.name === 'NotFoundError') {
                this.store.dispatch(ViewerActions.setError({status: Status.NotFoundError}));
              } else {
                this.store.dispatch(ViewerActions.setError({status: Status.UnknownError}));
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
            takeWhile((isEnded) => !isEnded),
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
            return EMPTY;
          }
          const fileReader = new FileReader();
          fileReader.onload = (f) => {
            this.videoService.sourceBuffer!.appendBuffer((f.target as any).result);
          };
          fileReader.readAsArrayBuffer(action.data);
          this.videoService.recordingParts.push(action.data);
          return from([this.createSetTimeStateAction()]);
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
      targetMs: number;
      isEnded: boolean;
      timeStarted: Date | null;
      bufferedTimeRangeEndS: number | null;
      noWait?: boolean;
    },
  ): Observable<Action> {
    if (!params.timeStarted) {
      return EMPTY;
    }
    const bufferedTimeRangeEndS = params.bufferedTimeRangeEndS || 0;
    params.noWait = params.noWait || false;
    const now = new Date();
    const end = params.isEnded
      ? new Date(params.timeStarted.getTime() + bufferedTimeRangeEndS * 1000)
      : now;
    let targetTimeMs = delayToTimeMs(params.targetMs + ms, end, params.timeStarted);
    targetTimeMs = Math.min(targetTimeMs, delayToTimeMs(0, end, params.timeStarted));
    if (params.noWait || params.isEnded) {
      // Don't allow the currentTime to be before the start.
      targetTimeMs = Math.max(targetTimeMs, 0);
    }
    const targetDelayMs = timeToDelayMs(targetTimeMs, end, params.timeStarted);
    if (targetTimeMs < 0) {
      const periods = Math.floor(-targetTimeMs / 1000) + 1;
      return concat(
        from([ViewerActions.goToBeforeStart({targetMs: targetDelayMs, waitingS: periods})]),
        timer(-targetTimeMs % 1000, 1000).pipe(
          takeUntil(
            this.store.pipe(
              select(isEnded),
              filter((x) => x),
            ),
          ),
          take(periods),
          map((i) =>
            i < periods - 1
              ? ViewerActions.setWaiting({timeS: periods - 1 - i})
              : ViewerActions.play(),
          ),
        ),
      );
    } else if (targetTimeMs >= bufferedTimeRangeEndS * 1000) {
      if (params.isEnded) {
        return of(ViewerActions.goToEnd());
      } else {
        return of(ViewerActions.goToLive());
      }
    } else {
      return of(ViewerActions.goTo({timeS: targetTimeMs / 1000, targetMs: targetDelayMs, now}));
    }
  }

  doStopRecord$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.doStopRecord),
        withLatestFrom(this.store.select(isLive)),
        tap(([_, isLive]) => {
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
        }),
      ),
    {dispatch: false},
  );

  play$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.play),
        tap(() => {
          this.videoService.liveVideo!.pause();
          this.videoService.video!.play();
        }),
      ),
    {dispatch: false},
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
        tap((action) => {
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

  goToEnd$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ViewerActions.goToEnd),
      map(() => {
        this.videoService.video!.currentTime = this.videoService.video!.duration;
        return this.createSetTimeStateAction();
      }),
    ),
  );

  setWaiting$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ViewerActions.setWaiting),
        tap(() => {
          this.videoService.video!.currentTime = 0;
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
