import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Observable } from 'rxjs';

import { ViewerEffects } from './viewer.effects';

describe('ViewerEffects', () => {
  let actions$: Observable<any>;
  let effects: ViewerEffects;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ViewerEffects,
        provideMockActions(() => actions$)
      ]
    });

    effects = TestBed.get<ViewerEffects>(ViewerEffects);
  });

  it('should be created', () => {
    expect(effects).toBeTruthy();
  });
});
