import {Component, Inject, OnDestroy} from '@angular/core';
import {SwUpdate} from '@angular/service-worker';
import {SubSink} from 'subsink';
import {environment} from '../../environments/environment';
import {BrowserParamsService} from '../browser-params.service';
import {Router} from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnDestroy {
  isUnsupportedBrowser = false;
  videoQuality: string;
  videoCamera: string;
  private subsink = new SubSink();
  private router: Router;

  constructor(
    @Inject(BrowserParamsService) browserParams: BrowserParamsService,
    @Inject(SwUpdate) updates: SwUpdate,
    @Inject(Router) router: Router,
  ) {
    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
    this.router = router;

    if (environment.production) {
      this.subsink.add(
        updates.available.subscribe((_) => {
          updates.activateUpdate().then(() => document.location.reload());
        }),
      );
    }
    this.videoQuality = localStorage.getItem('videoQuality') || '480';
    this.videoCamera = localStorage.getItem('videoCamera') || 'user';
  }

  ngOnDestroy() {
    this.subsink.unsubscribe();
  }

  onClick() {
    localStorage.setItem('videoQuality', this.videoQuality);
    localStorage.setItem('videoCamera', this.videoCamera);
    this.router.navigate(['/run']);
  }
}
