import {Component, OnInit, Inject} from '@angular/core';
import {BrowserParamsService} from '../browser-params.service'

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  isUnsupportedBrowser = false;

  constructor(@Inject(BrowserParamsService) browserParams: BrowserParamsService) {
    this.isUnsupportedBrowser = browserParams.isUnsupportedBrowser;
  }

  ngOnInit() {}
}
