import {Action, createReducer, on} from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export interface ViewerState {
  showPreview: boolean;
  showWizard: boolean;
  isPreviewDismissed: boolean;
  isEnded: boolean;
  isStopped: boolean;
  lastReceived: Date | null;
  legacy: {
    targetMs: number;
    adjustIntervalId: number | null;
    isEnded: boolean;
    isLive: boolean;
    isInitialized: boolean;
    isUnsupportedBrowser: boolean;
    isPermissionDeniedError: boolean;
    isNotFoundError: boolean;
    isUnknownError: boolean;
    currentTime: number;
    totalTime: number;
    displayedDelay: number;
    waitTime: number;
  };
}

const initialState = {
  showPreview: false,
  showWizard: true,
  isPreviewDismissed: false,
  isEnded: false,
  isStopped: false,
  lastReceived: null,
  legacy: {
    targetMs: 0,
    adjustIntervalId: null,
    isEnded: false,
    isLive: true,
    isInitialized: false,
    isUnsupportedBrowser: false,
    isPermissionDeniedError: false,
    isNotFoundError: false,
    isUnknownError: false,
    currentTime: 0,
    totalTime: 0,
    displayedDelay: 0,
    waitTime: 0,
  },
};

export const reducer = createReducer(
  initialState,
  on(ViewerActions.togglePreview, state => ({
    ...state,
    showPreview: !state.showPreview,
    isPreviewDismissed: true,
  })),
  on(ViewerActions.more, state => ({
    ...state,
    showPreview: (!state.isPreviewDismissed && !state.isEnded) || state.showPreview,
    showWizard: false,
  })),
  on(ViewerActions.stopRecord, state => ({
    ...state,
    showPreview: false,
    showWizard: false,
    isEnded: true,
  })),
  on(ViewerActions.stop, state => ({
    ...state,
    isStopped: false,
  })),
  on(ViewerActions.play, state => ({
    ...state,
    isStopped: false,
  })),
  on(ViewerActions.dismissWizard, state => ({
    ...state,
    showWizard: false,
  })),
  on(ViewerActions.setLegacy, (state, legacyPatch) => ({
    ...state,
    legacy: {
      ...state.legacy,
      ...legacyPatch.payload,
    },
  })),
);

export function viewerReducer(state: ViewerState | undefined, action: Action) {
  return reducer(state, action);
}
