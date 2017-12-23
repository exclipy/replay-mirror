import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {RouterModule, Routes} from '@angular/router';

import {AppComponent} from './app.component';
import {BrowserParamsService} from './browser-params.service';
import {HomeComponent} from './home/home.component';
import {IconComponent} from './icon/icon.component';
import {SeekBarComponent} from './seek-bar/seek-bar.component';
import {ViewerComponent} from './viewer/viewer.component';

const appRoutes: Routes = [
  {path: '', component: HomeComponent},
  {path: 'run', component: ViewerComponent},
];

@NgModule({
  declarations: [
    AppComponent, IconComponent, ViewerComponent, HomeComponent,
    SeekBarComponent
  ],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  providers: [BrowserParamsService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
