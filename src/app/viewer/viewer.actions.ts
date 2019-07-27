import { createAction } from '@ngrx/store';

export const showPreview = createAction('[View Component] Show Preview');
export const hidePreview = createAction('[View Component] Hide Preview');
export const togglePreview = createAction('[View Component] Toggle Preview');
export const more = createAction('[View Component] More');
export const stopRecord = createAction('[View Component] Stop Record');
export const dismissWizard = createAction('[View Component] Dismiss Wizard');
