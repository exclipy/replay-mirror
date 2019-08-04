import {createAction, props} from '@ngrx/store';
import {Status} from '../reducers/viewer.reducer';

export const togglePreview = createAction('[View Component] Toggle Preview');
export const less = createAction('[View Component] Less');
export const more = createAction('[View Component] More');
export const stopRecord = createAction('[View Component] Stop Record');
export const dismissWizard = createAction('[View Component] Dismiss Wizard');

export const stop = createAction('[View System] Stop');
export const foregrounded = createAction('[View System] Foregrounded');
export const updateTime = createAction('[View System] Update Time');
export const init = createAction('[View System] Init');
export const onDataAvailable = createAction(
  '[View System] On Data Available',
  props<{data: Blob}>(),
);

export const finishInit = createAction('[View Effect] Finish Init');
export const setError = createAction(
  '[View Effect] Set error',
  props<{
    status: Status;
  }>(),
);
export const doStopRecord = createAction('[View Effect] Actually Stop Record');
export const play = createAction('[View Effect] Play');
export const goToBeforeStart = createAction(
  '[View Effect] Go to before start',
  props<{
    targetMs: number;
    waitingS: number;
  }>(),
);
export const goTo = createAction(
  '[View Effect] Go To',
  props<{
    timeS: number;
    targetMs: number;
  }>(),
);
export const goToLive = createAction('[View Effect] Go To Live');
export const goToEnd = createAction('[View Effect] Go To End');
export const setWaiting = createAction('[View Effect] Set Waiting', props<{timeS: number}>());
export const setLastReceived = createAction(
  '[View Effect] Set Last Received',
  props<{date: Date}>(),
);
export const setTimeState = createAction(
  '[View Effect] Set Time State',
  props<{
    now: Date;
    bufferedTimeRanges: TimeRanges;
    currentTimeS: number;
  }>(),
);
