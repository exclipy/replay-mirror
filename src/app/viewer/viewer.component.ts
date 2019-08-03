import {animate, state, style, transition, trigger} from '@angular/animations';
import {Component, Inject, OnDestroy, OnInit} from '@angular/core';
import {select, Store} from '@ngrx/store';
import {untilComponentDestroyed} from '@w11k/ngx-componentdestroyed';
import {fromEvent, Observable} from 'rxjs';
import {filter} from 'rxjs/operators';
import {BrowserParamsService} from '../browser-params.service';
import {State} from '../reducers';
import {VideoService} from './video.service';
import * as ViewerActions from './viewer.actions';
import * as ViewerSelectors from './viewer.selectors';

@Component({
  selector: 'app-viewer',
  templateUrl: './viewer.component.html',
  styleUrls: ['./viewer.component.css'],
  animations: [
    trigger('preview', [
      state('hide', style({opacity: 0, transform: 'scale(0)'})),
      transition('hide <=> show', [animate(100)]),
    ]),
  ],
})
export class ViewerComponent implements OnInit, OnDestroy {
  targetMs$: Observable<number>;
  adjustIntervalId$: Observable<number | null>;
  lastReceived$: Observable<Date | null>;
  isEnded$: Observable<boolean>;
  isStopped$: Observable<boolean>;
  isLive$: Observable<boolean>;
  isInitialized$: Observable<boolean>;
  isPermissionDeniedError$: Observable<boolean>;
  isNotFoundError$: Observable<boolean>;
  isUnknownError$: Observable<boolean>;
  currentTime$: Observable<number>;
  totalTime$: Observable<number>;
  displayedDelay$: Observable<number>;
  waitTime$: Observable<number>;

  isUnsupportedBrowser = false;
  showPreview$: Observable<boolean>;
  showWizard$: Observable<boolean>;

  isAtEnd$: Observable<boolean>;
  isWaiting$: Observable<boolean>;
  isError$: Observable<boolean>;

  constructor(
    @Inject(BrowserParamsService) private browserParams: BrowserParamsService,
    private videoService: VideoService,
    private store: Store<State>,
  ) {
    this.targetMs$ = store.pipe(select('viewer', 'legacy', 'targetMs'));
    this.adjustIntervalId$ = store.pipe(select('viewer', 'legacy', 'adjustIntervalId'));
    this.lastReceived$ = store.pipe(select('viewer', 'legacy', 'lastReceived'));
    this.isEnded$ = store.pipe(select('viewer', 'legacy', 'isEnded'));
    this.isStopped$ = store.pipe(select('viewer', 'legacy', 'isStopped'));
    this.isLive$ = store.pipe(select('viewer', 'legacy', 'isLive'));
    this.isInitialized$ = store.pipe(select('viewer', 'legacy', 'isInitialized'));
    this.isPermissionDeniedError$ = store.pipe(
      select('viewer', 'legacy', 'isPermissionDeniedError'),
    );
    this.isNotFoundError$ = store.pipe(select('viewer', 'legacy', 'isNotFoundError'));
    this.isUnknownError$ = store.pipe(select('viewer', 'legacy', 'isUnknownError'));
    this.currentTime$ = store.pipe(select('viewer', 'legacy', 'currentTime'));
    this.totalTime$ = store.pipe(select('viewer', 'legacy', 'totalTime'));
    this.displayedDelay$ = store.pipe(select('viewer', 'legacy', 'displayedDelay'));
    this.waitTime$ = store.pipe(select('viewer', 'legacy', 'waitTime'));

    this.videoService.mediaStream = null;

    this.showPreview$ = store.pipe(select('viewer', 'showPreview'));
    this.showWizard$ = store.pipe(select('viewer', 'showWizard'));
    this.isAtEnd$ = store.pipe(select(ViewerSelectors.isAtEnd));
    this.isWaiting$ = store.pipe(select(ViewerSelectors.isWaiting));
    this.isError$ = store.pipe(select(ViewerSelectors.isError));

    this.showPreview$.pipe(untilComponentDestroyed(this)).subscribe(value => {
      if (this.videoService.preview) {
        if (value) {
          this.videoService.preview.play();
        } else {
          this.videoService.preview.pause();
        }
      }
    });

    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
  }

  ngOnInit() {
    if (this.isUnsupportedBrowser) {
      return;
    }
    this.videoService.video = document.querySelector('#video') as HTMLVideoElement;
    this.videoService.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.videoService.preview = document.querySelector('#preview') as HTMLVideoElement;
    this.store.dispatch(ViewerActions.init());

    fromEvent(document, 'visibilitychange')
      .pipe(
        untilComponentDestroyed(this),
        filter(() => document.visibilityState === 'visible'),
      )
      .subscribe(() => this.store.dispatch(ViewerActions.foregrounded()));
  }

  ngOnDestroy() {
    this.videoService.video = undefined;
    this.videoService.liveVideo = undefined;
    this.videoService.preview = undefined;
  }

  less() {
    this.store.dispatch(ViewerActions.less());
  }

  more() {
    this.store.dispatch(ViewerActions.more());
  }

  stopRecord() {
    this.store.dispatch(ViewerActions.stopRecord());
  }

  dismissWizard() {
    this.store.dispatch(ViewerActions.dismissWizard());
  }

  togglePreview() {
    this.store.dispatch(ViewerActions.togglePreview());
  }

  stopped() {
    this.store.dispatch(ViewerActions.stop());
  }

  updateTime() {
    this.store.dispatch(ViewerActions.updateTime());
  }
}
