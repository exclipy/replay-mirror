import {createFeatureSelector, createSelector} from '@ngrx/store';
import {State} from '../reducers';
import {TimeState, ViewerState} from '../reducers/viewer.reducer';
import {timeToDelayMs} from './timeUtils';

export const viewerStateSelector = createFeatureSelector<State, ViewerState>('viewer');

export const timeStateSelector = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.timeState,
);

export const isAtEnd = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isLive || state.isStopped,
);
export const statusSelector = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.status,
);

export const isWaiting = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.waitTime <= 0,
);

export const isStopped = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isStopped,
);

export const isLive = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isLive,
);

export const isEnded = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.isEnded,
);

export const timeSinceLastReceivedMs = createSelector(
  viewerStateSelector,
  timeStateSelector,
  (state: ViewerState, timeState: TimeState) =>
    state.lastReceived ? timeState.now.getTime() - state.lastReceived.getTime() : 0,
);

export const delayMs = createSelector(
  viewerStateSelector,
  timeStateSelector,
  isLive,
  (state: ViewerState, timeState: TimeState, isLive: boolean) =>
    isLive || timeState.currentTimeS == null || state.timeStarted == null
      ? 0
      : timeToDelayMs(timeState.currentTimeS * 1000, timeState.now, state.timeStarted),
);

export const displayedDelay = createSelector(
  delayMs,
  (delayMs: number) => delayMs / 1000,
);

export const targetS = createSelector(
  viewerStateSelector,
  (state: ViewerState) => state.targetMs / 1000,
);

export const totalTimeS = createSelector(
  viewerStateSelector,
  timeStateSelector,
  timeSinceLastReceivedMs,
  (state: ViewerState, timeState: TimeState, timeSinceLastReceivedMs: number) =>
    timeState.bufferedTimeRangeEndS || 0 + (state.isEnded ? 0 : timeSinceLastReceivedMs / 1000),
);

export const currentTimeS = createSelector(
  timeStateSelector,
  isLive,
  totalTimeS,
  (timeState: TimeState, isLive: boolean, totalTimeS: number) =>
    isLive || timeState.currentTimeS == null ? totalTimeS : timeState.currentTimeS,
);

export const changeDelayParams = createSelector(
  viewerStateSelector,
  (state: ViewerState) => ({
    targetMs: state.targetMs,
    isEnded: state.isEnded,
    timeStarted: state.timeStarted,
    bufferedTimeRangeEndS: state.timeState.bufferedTimeRangeEndS,
  }),
);
