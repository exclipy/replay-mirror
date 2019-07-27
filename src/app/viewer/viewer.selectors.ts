import { createSelector, createFeatureSelector } from "@ngrx/store";
import { ViewerState } from '../reducers/viewer.reducer';
import { State } from '../reducers';

export const viewerStateSelector = createFeatureSelector<State, ViewerState>('viewer');
