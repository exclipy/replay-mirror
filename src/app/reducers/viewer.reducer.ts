import {Action, createReducer, on} from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export interface ViewerState {
  showPreview: boolean;
  showWizard: boolean;
  isPreviewDismissed: boolean;
  isEnded: boolean;
  isStopped: boolean;
  lastReceived: Date | null;
  timeState: TimeState;
  isInitialized: boolean;

  legacy: {
    targetMs: number;
    isEnded: boolean;
    isLive: boolean;
    isPermissionDeniedError: boolean;
    isNotFoundError: boolean;
    isUnknownError: boolean;
    waitTime: number;
  };
}

const initialState: ViewerState = {
  showPreview: false,
  showWizard: true,
  isPreviewDismissed: false,
  isEnded: false,
  isStopped: false,
  lastReceived: null,
  isInitialized: false,
  timeState: {
    now: new Date(),
    bufferedTimeRangeEndS: null,
    currentTimeS: null,
  },
  legacy: {
    targetMs: 0,
    isEnded: false,
    isLive: true,
    isPermissionDeniedError: false,
    isNotFoundError: false,
    isUnknownError: false,
    waitTime: 0,
  },
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
    ViewerActions.setLastReceived,
    (state, action): ViewerState => ({
      ...state,
      lastReceived: action.date,
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
    ViewerActions.setLegacy,
    (state, legacyPatch): ViewerState => ({
      ...state,
      legacy: {
        ...state.legacy,
        ...legacyPatch.payload,
      },
    }),
  ),
  on(
    ViewerActions.finishInit,
    (state): ViewerState => ({
      ...state,
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
      legacy: {
        ...state.legacy,
        targetMs: action.targetMs,
        waitTime: action.waitingS,
        isLive: false,
      },
    }),
  ),
  on(
    ViewerActions.goTo,
    (state, action): ViewerState => ({
      ...state,
      timeState: {
        ...state.timeState,
        currentTimeS: action.timeS,
      },
      legacy: {
        ...state.legacy,
        targetMs: action.targetMs,
        waitTime: 0,
        isLive: false,
      },
    }),
  ),
  on(
    ViewerActions.goToLive,
    (state): ViewerState => ({
      ...state,
      legacy: {
        ...state.legacy,
        targetMs: 0,
        waitTime: 0,
        isLive: true,
      },
    }),
  ),
  on(
    ViewerActions.goToEnd,
    (state): ViewerState => ({
      ...state,
      legacy: {
        ...state.legacy,
        targetMs: 0,
        waitTime: 0,
        isLive: false,
      },
    }),
  ),
);

export function viewerReducer(state: ViewerState | undefined, action: Action) {
  return reducer(state, action);
}
