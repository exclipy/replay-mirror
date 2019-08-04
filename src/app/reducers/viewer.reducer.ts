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

  legacy: {
    targetMs: number;
    isEnded: boolean;
    isLive: boolean;
    isInitialized: boolean;
    isUnsupportedBrowser: boolean;
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
  timeState: {
    now: new Date(),
    bufferedTimeRangeEndS: null,
    currentTimeS: null,
  },
  legacy: {
    targetMs: 0,
    isEnded: false,
    isLive: true,
    isInitialized: false, //
    isUnsupportedBrowser: false,
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
);

export function viewerReducer(state: ViewerState | undefined, action: Action) {
  return reducer(state, action);
}
