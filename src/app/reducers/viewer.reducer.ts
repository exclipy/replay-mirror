import {createReducer, on, Action} from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export interface ViewerState {
  showPreview: boolean;
  showWizard: boolean;
  isPreviewDismissed: boolean;
  isEnded: boolean;
  legacy: {
    targetMs: number;
    adjustIntervalId: number | null;
    lastReceived: Date | null;
    isEnded: boolean;
    isStopped: boolean;
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
  legacy: {
    targetMs: 0,
    adjustIntervalId: null,
    lastReceived: null,
    isEnded: false,
    isStopped: false,
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
