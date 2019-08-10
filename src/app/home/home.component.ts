import {Component, Inject, OnDestroy} from '@angular/core';
import {SwUpdate} from '@angular/service-worker';
import {SubSink} from 'subsink';
import {environment} from '../../environments/environment';
import {BrowserParamsService} from '../browser-params.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnDestroy {
  isUnsupportedBrowser = false;
  private subsink = new SubSink();

  constructor(
    @Inject(BrowserParamsService) browserParams: BrowserParamsService,
    @Inject(SwUpdate) updates: SwUpdate,
  ) {
    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;

    if (environment.production) {
      this.subsink.add(
        updates.available.subscribe(_ => {
          updates.activateUpdate().then(() => document.location.reload());
        }),
      );
    }
  }

  ngOnDestroy() {
    this.subsink.unsubscribe();
  }
}
