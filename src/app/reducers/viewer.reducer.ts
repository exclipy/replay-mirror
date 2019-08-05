import {Action, createReducer, on} from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export enum Status {
  Success,
  PermissionDeniedError,
  UnknownError,
  NotFoundError,
}

export interface ViewerState {
  showPreview: boolean;
  showWizard: boolean;
  isPreviewDismissed: boolean;
  isEnded: boolean;
  isStopped: boolean;
  timeStarted: Date | null;
  timeState: TimeState;
  isInitialized: boolean;
  status: Status;
  targetMs: number;
  isLive: boolean;
  waitTime: number;
}

const initialState: ViewerState = {
  showPreview: false,
  showWizard: true,
  isPreviewDismissed: false,
  isEnded: false,
  isStopped: false,
  timeStarted: null,
  isInitialized: false,
  status: Status.Success,
  timeState: {
    now: new Date(),
    bufferedTimeRangeEndS: null,
    currentTimeS: null,
  },
  targetMs: 0,
  isLive: true,
  waitTime: 0,
};

export interface TimeState {
  // Current time
  now: Date;
  // Null if there is no buffered time range, otherwise it is the `end` of the zeroth one.
  bufferedTimeRangeEndS: number | null;
  // As reported by the video element
  currentTimeS: number | null;
}

export const reducer = createReducer(
  initialState,
  on(
    ViewerActions.init,
    (state): ViewerState => ({
      ...state,
      status: Status.Success,
      targetMs: 0,
      isEnded: false,
      isLive: true,
      waitTime: 0,
      timeState: {
        ...state.timeState,
        now: new Date(),
      },
    }),
  ),
  on(
    ViewerActions.setError,
    (state, action): ViewerState => ({
      ...state,
      status: action.status,
    }),
  ),
  on(
    ViewerActions.setTimeState,
    (state, action): ViewerState => ({
      ...state,
      timeState: {
        now: action.now,
        bufferedTimeRangeEndS: action.bufferedTimeRanges.length
          ? action.bufferedTimeRanges.end(0)
          : null,
        currentTimeS: action.currentTimeS,
      },
    }),
  ),
  on(
    ViewerActions.togglePreview,
    (state): ViewerState => ({
      ...state,
      showPreview: !state.showPreview,
      isPreviewDismissed: true,
    }),
  ),
  on(
    ViewerActions.more,
    (state): ViewerState => ({
      ...state,
      showPreview: (!state.isPreviewDismissed && !state.isEnded) || state.showPreview,
      showWizard: false,
    }),
  ),
  on(
    ViewerActions.stopRecord,
    (state): ViewerState => ({
      ...state,
      showPreview: false,
      showWizard: false,
      isEnded: true,
    }),
  ),
  on(
    ViewerActions.stop,
    (state): ViewerState => ({
      ...state,
      isStopped: false,
    }),
  ),
  on(
    ViewerActions.play,
    (state): ViewerState => ({
      ...state,
      isStopped: false,
      waitTime: 0,
      isLive: false,
    }),
  ),
  on(
    ViewerActions.doStopRecord,
    (state): ViewerState => ({
      ...state,
      isLive: false,
      isEnded: true,
    }),
  ),
  on(
    ViewerActions.dismissWizard,
    (state): ViewerState => ({
      ...state,
      showWizard: false,
    }),
  ),
  on(
    ViewerActions.finishInit,
    (state, action): ViewerState => ({
      ...state,
      timeStarted: action.now,
      isInitialized: true,
    }),
  ),
  on(
    ViewerActions.goToBeforeStart,
    (state, action): ViewerState => ({
      ...state,
      timeState: {
        ...state.timeState,
        currentTimeS: 0,
      },
      targetMs: action.targetMs,
      waitTime: action.waitingS,
      isLive: false,
    }),
  ),
  on(
    ViewerActions.goTo,
    (state, action): ViewerState => ({
      ...state,
      timeState: {
        ...state.timeState,
        currentTimeS: action.timeS,
        now: action.now,
      },
      targetMs: action.targetMs,
      waitTime: 0,
      isLive: false,
    }),
  ),
  on(
    ViewerActions.goToLive,
    (state): ViewerState => ({
      ...state,
      targetMs: 0,
      waitTime: 0,
      isLive: true,
    }),
  ),
  on(
    ViewerActions.goToEnd,
    (state): ViewerState => ({
      ...state,
      targetMs: 0,
      waitTime: 0,
      isLive: false,
    }),
  ),
  on(
    ViewerActions.setWaiting,
    (state, action): ViewerState => ({
      ...state,
      waitTime: action.timeS,
    }),
  ),
);

export function viewerReducer(state: ViewerState | undefined, action: Action) {
  return reducer(state, action);
}
