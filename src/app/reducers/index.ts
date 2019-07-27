import {
  ActionReducer,
  ActionReducerMap,
  createFeatureSelector,
  createSelector,
  MetaReducer
} from '@ngrx/store';
import { environment } from '../../environments/environment';
import { viewerReducer, ViewerState } from './viewer.reducer';

export interface State {
  viewer: ViewerState;
}

export const reducers: ActionReducerMap<State> = {
  viewer: viewerReducer,
};


export const metaReducers: MetaReducer<State>[] = !environment.production ? [] : [];
