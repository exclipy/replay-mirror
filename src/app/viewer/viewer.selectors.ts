import {createFeatureSelector, createSelector} from '@ngrx/store';
import {State} from '../reducers';
import {ViewerState} from '../reducers/viewer.reducer';

export const viewerStateSelector = createFeatureSelector<State, ViewerState>('viewer');

export const isAtEnd = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.legacy.isLive || state.legacy.isStopped,
);
export const isError = createSelector(
  viewerStateSelector,
  (state: ViewerState) =>
    state.legacy.isPermissionDeniedError ||
    state.legacy.isUnknownError ||
    state.legacy.isNotFoundError,
);

export const isWaiting = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.legacy.waitTime <= 0,
);
