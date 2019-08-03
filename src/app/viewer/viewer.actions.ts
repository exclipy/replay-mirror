import {createAction, props} from '@ngrx/store';

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

export const doStopRecord = createAction('[View Effect] Actually Stop Record');
export const pause = createAction('[View Effect] Pause');
export const play = createAction('[View Effect] Play');
export const setLive = createAction('[View Effect] Set Live');
export const setTime = createAction('[View Effect] Set Time', props<{timeS: number}>());
export const setWaiting = createAction('[View Effect] Set Waiting', props<{timeS: number}>());

export const setLegacy = createAction(
  '[View Effect] Set Legacy',
  props<{
    payload: {
      targetMs?: number;
      adjustIntervalId?: number | null;
      lastReceived?: Date | null;
      isEnded?: boolean;
      isStopped?: boolean;
      isLive?: boolean;
      isInitialized?: boolean;
      isUnsupportedBrowser?: boolean;
      isPermissionDeniedError?: boolean;
      isNotFoundError?: boolean;
      isUnknownError?: boolean;
      currentTime?: number;
      totalTime?: number;
      displayedDelay?: number;
      waitTime?: number;
    };
  }>(),
);
