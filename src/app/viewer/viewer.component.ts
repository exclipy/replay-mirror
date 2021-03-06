import {animate, state, style, transition, trigger} from '@angular/animations';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {select, Store} from '@ngrx/store';
import {fromEvent, Observable} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {SubSink} from 'subsink';
import {BrowserParamsService} from '../browser-params.service';
import {State} from '../reducers';
import {VideoService} from './video.service';
import * as ViewerActions from './viewer.actions';
import * as ViewerSelectors from './viewer.selectors';
import {targetS} from './viewer.selectors';
import {Status} from '../reducers/viewer.reducer';
import {ActivatedRoute} from '@angular/router';

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
  private subsink = new SubSink();

  targetS$: Observable<number>;
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

  showDebugPanel: Observable<boolean>;
  bufferedEnd$: Observable<number | null>;

  constructor(
    browserParams: BrowserParamsService,
    private videoService: VideoService,
    private store: Store<State>,
    private route: ActivatedRoute,
  ) {
    this.targetS$ = store.pipe(select(targetS));
    this.isEnded$ = store.pipe(select(state => state.viewer.isEnded));
    this.isStopped$ = store.pipe(select(ViewerSelectors.isStopped));
    this.isLive$ = store.pipe(select(ViewerSelectors.isLive));
    this.isInitialized$ = store.pipe(select(state => state.viewer.isInitialized));
    this.currentTime$ = store.pipe(select(ViewerSelectors.currentTimeS));
    this.totalTime$ = store.pipe(select(ViewerSelectors.totalTimeS));
    this.displayedDelay$ = store.pipe(select(ViewerSelectors.displayedDelay));
    this.waitTime$ = store.pipe(select(state => state.viewer.waitTimeS));

    this.showPreview$ = store.pipe(select(state => state.viewer.showPreview));
    this.showWizard$ = store.pipe(select(state => state.viewer.showWizard));
    this.isAtEnd$ = store.pipe(select(ViewerSelectors.isAtEnd));
    this.isWaiting$ = store.pipe(select(ViewerSelectors.isWaiting));

    // For debug
    this.bufferedEnd$ = store.pipe(select(state => state.viewer.timeState.bufferedTimeRangeEndS));

    this.isError$ = store.pipe(
      select(ViewerSelectors.statusSelector),
      map(s => s !== Status.Success),
    );
    this.isPermissionDeniedError$ = store.pipe(
      select(ViewerSelectors.statusSelector),
      map(s => {
        return s === Status.PermissionDeniedError;
      }),
    );
    this.isNotFoundError$ = store.pipe(
      select(ViewerSelectors.statusSelector),
      map(s => s === Status.NotFoundError),
    );
    this.isUnknownError$ = store.pipe(
      select(ViewerSelectors.statusSelector),
      map(s => s === Status.UnknownError),
    );
    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;

    this.showDebugPanel = this.route.fragment.pipe(map(fragment => fragment === 'debug'));
  }

  ngOnInit() {
    if (this.isUnsupportedBrowser) {
      return;
    }
    this.videoService.video = document.querySelector('#video') as HTMLVideoElement;
    this.videoService.liveVideo = document.querySelector('#live') as HTMLVideoElement;
    this.videoService.preview = document.querySelector('#preview') as HTMLVideoElement;
    this.videoService.recordingParts = [];
    this.store.dispatch(ViewerActions.init());

    this.subsink.add(
      this.showPreview$.subscribe(value => {
        if (this.videoService.preview) {
          if (value) {
            this.videoService.preview.play();
          } else {
            this.videoService.preview.pause();
          }
        }
      }),
    );

    this.subsink.add(
      fromEvent(document, 'visibilitychange')
        .pipe(filter(() => document.visibilityState === 'visible'))
        .subscribe(() => this.store.dispatch(ViewerActions.foregrounded())),
    );
  }

  ngOnDestroy() {
    this.subsink.unsubscribe();
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

  save() {
    if (this.videoService.recordingParts.length == 0) {
      return;
    }
    const a = document.createElement('a');
    const url = window.URL.createObjectURL(
      new Blob(this.videoService.recordingParts,
              {type: this.videoService.recordingParts[0].type})
    );
    a.href = url;
    a.download = 'video.webm';
    a.click();
    window.URL.revokeObjectURL(url);
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
