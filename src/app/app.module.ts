import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {RouterModule, Routes} from '@angular/router';

import {AppComponent} from './app.component';
import {IconComponent} from './icon/icon.component';
import {ViewerComponent} from './viewer/viewer.component';

const appRoutes: Routes = [
  {path: '', component: ViewerComponent},
];

@NgModule({
  declarations: [AppComponent, IconComponent, ViewerComponent],
  imports: [BrowserModule, RouterModule.forRoot(appRoutes)],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
