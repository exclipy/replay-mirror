import {Component, Inject, OnDestroy} from '@angular/core';
import {SwUpdate} from '@angular/service-worker';
import {environment} from '../../environments/environment';
import {BrowserParamsService} from '../browser-params.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnDestroy {
  isUnsupportedBrowser = false;

  subscription: Subscription | undefined;

  constructor(
    @Inject(BrowserParamsService) browserParams: BrowserParamsService,
    @Inject(SwUpdate) updates: SwUpdate,
  ) {
    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;

    if (environment.production) {
      this.subscription = updates.available.subscribe(_ => {
        updates.activateUpdate().then(() => document.location.reload());
      });
    }
  }

  ngOnDestroy() {
    if (environment.production) {
      this.subscription!.unsubscribe();
    }
  }
}
