import { createReducer, on, Action } from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export interface ViewerState {
    showPreview: boolean;
    showWizard: boolean;
    isPreviewDismissed: boolean;
    isEnded: boolean;
}

const initialState = {
    showPreview: false,
    showWizard: true,
    isPreviewDismissed: false,
    isEnded: false,
};

export const reducer = createReducer(initialState,
    on(ViewerActions.togglePreview, state => ({
        ...state,
        showPreview: !state.showPreview,
        isPreviewDismissed: true,
    })),
    on(ViewerActions.more, state => ({
        ...state,
        showPreview: !state.isPreviewDismissed && !state.isEnded || state.showPreview,
        showWizard: false
    })),
    on(ViewerActions.stopRecord, state => ({
        ...state,
        showPreview: false,
        showWizard: false,
        isEnded: true,
    })),
    on(ViewerActions.dismissWizard, state => ({
        ...state,
        showWizard: false
    })),
);

export function viewerReducer(state: ViewerState | undefined, action: Action) {
    return reducer(state, action);
}
