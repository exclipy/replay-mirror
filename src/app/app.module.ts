import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {RouterModule, Routes} from '@angular/router';

import {AppComponent} from './app.component';
import {HomeComponent} from './home/home.component';
import {IconComponent} from './icon/icon.component';
import {ViewerComponent} from './viewer/viewer.component';

const appRoutes: Routes = [
  {path: '', component: HomeComponent},
  {path: 'run', component: ViewerComponent},
];

@NgModule({
  declarations: [AppComponent, IconComponent, ViewerComponent, HomeComponent],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
