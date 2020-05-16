import {Component, Inject, OnDestroy} from '@angular/core';
import {SwUpdate} from '@angular/service-worker';
import {SubSink} from 'subsink';
import {environment} from '../../environments/environment';
import {BrowserParamsService} from '../browser-params.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnDestroy {
  isUnsupportedBrowser = false;
  private subsink = new SubSink();
  private router: Router;
  private videoQualitySelect?: HTMLSelectElement;
  private videoCameraSelect?: HTMLSelectElement;

  constructor(
    @Inject(BrowserParamsService) browserParams: BrowserParamsService,
    @Inject(SwUpdate) updates: SwUpdate,
    @Inject(Router) router: Router,
  ) {
    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
    this.router = router;

    if (environment.production) {
      this.subsink.add(
        updates.available.subscribe(_ => {
          updates.activateUpdate().then(() => document.location.reload());
        }),
      );
    }
  }

  ngOnInit() {
    this.videoQualitySelect = document.querySelector('#video-quality')! as HTMLSelectElement;
    this.videoCameraSelect = document.querySelector('#video-camera')! as HTMLSelectElement;
    this.videoQualitySelect.value =
      localStorage.getItem('defaultQuality') || '480';
    this.videoCameraSelect.value =
      localStorage.getItem('defaultCamera') || 'user';
  }

  ngOnDestroy() {
    this.subsink.unsubscribe();
  }

  onClick() {
    let quality = this.videoQualitySelect!.options[this.videoQualitySelect!.selectedIndex].value;
    let camera = this.videoCameraSelect!.options[this.videoCameraSelect!.selectedIndex].value;
    localStorage.setItem('defaultQuality', quality);
    localStorage.setItem('defaultCamera', camera);
    this.router.navigate(['/run'], {
      queryParams: {
        h: quality,
        cam: camera,
      }
    });
  }
}
