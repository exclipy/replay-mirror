import { createReducer, on, Action } from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export interface ViewerState {
    showPreview: boolean;
    showWizard: boolean;
}

const initialState = { showPreview: false, showWizard: true, };

export const reducer = createReducer(initialState,
    on(ViewerActions.showPreview, state => ({
        ...state,
        showPreview: true
    })),
    on(ViewerActions.togglePreview, state => ({
        ...state,
        showPreview: !state.showPreview
    })),
    on(ViewerActions.more, state => ({
        ...state,
        showWizard: false
    })),
    on(ViewerActions.stopRecord, state => ({
        ...state,
        showPreview: false,
        showWizard: false
    })),
    on(ViewerActions.dismissWizard, state => ({
        ...state,
        showWizard: false
    })),
);

export function viewerReducer(state: ViewerState | undefined, action: Action) {
    return reducer(state, action);
}
