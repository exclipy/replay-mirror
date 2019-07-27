import { createReducer, on, Action } from '@ngrx/store';
import * as ViewerActions from '../viewer/viewer.actions';

export interface ViewerState {
    showPreview: boolean;
}

const initialState = { showPreview: false };

export const reducer = createReducer(initialState,
    on(ViewerActions.hidePreview, state => ({ ...state, showPreview: false   })),
    on(ViewerActions.showPreview, state => ({ ...state, showPreview: true })),
    on(ViewerActions.togglePreview, state => ({ ...state, showPreview: !state.showPreview })),
);

export function viewerReducer(state: ViewerState|undefined, action: Action) {
    return reducer(state, action);
}
