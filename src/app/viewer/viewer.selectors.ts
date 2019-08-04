import {createFeatureSelector, createSelector} from '@ngrx/store';
import {State} from '../reducers';
import {TimeState, ViewerState} from '../reducers/viewer.reducer';

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

export const absoluteEndMs = createSelector(
  viewerStateSelector,
  timeStateSelector,
  timeSinceLastReceivedMs,
  (state: ViewerState, timeState: TimeState, timeSinceLastReceivedMs: number) =>
    !state.lastReceived || timeState.bufferedTimeRangeEndS == null
      ? 0
      : 1000 * timeState.bufferedTimeRangeEndS + timeSinceLastReceivedMs,
);

export const delayMs = createSelector(
  timeStateSelector,
  isLive,
  absoluteEndMs,
  (timeState: TimeState, isLive: boolean, absoluteEndMs: number) =>
    isLive || timeState.currentTimeS == null ? 0 : absoluteEndMs - timeState.currentTimeS * 1000,
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
  timeSinceLastReceivedMs,
  absoluteEndMs,
  delayMs,
  (
    state: ViewerState,
    timeSinceLastReceivedMs: number,
    absoluteEndMs: number,
    delayMs: number,
  ) => ({
    timeSinceLastReceivedMs,
    targetMs: state.targetMs,
    absoluteEndMs,
    isEnded: state.isEnded,
    delayMs,
  }),
);
