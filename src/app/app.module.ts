import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {RouterModule, Routes} from '@angular/router';
import {ServiceWorkerModule} from '@angular/service-worker';
import {EffectsModule} from '@ngrx/effects';
import {StoreModule} from '@ngrx/store';
import {StoreDevtoolsModule} from '@ngrx/store-devtools';
import {environment} from '../environments/environment';
import {AppComponent} from './app.component';
import {BrowserParamsService} from './browser-params.service';
import {HomeComponent} from './home/home.component';
import {IconComponent} from './icon/icon.component';
import {metaReducers, reducers} from './reducers';
import {SeekBarComponent} from './seek-bar/seek-bar.component';
import {ViewerComponent} from './viewer/viewer.component';
import {ViewerEffects} from './viewer/viewer.effects';

const appRoutes: Routes = [
  {path: '', component: HomeComponent},
  {path: 'run', component: ViewerComponent},
  {path: '**', redirectTo: ''},
];

@NgModule({
  declarations: [AppComponent, IconComponent, ViewerComponent, HomeComponent, SeekBarComponent],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    RouterModule.forRoot(appRoutes),
    ServiceWorkerModule.register('/ngsw-worker.js'),
    StoreModule.forRoot(reducers, {
      metaReducers,
      runtimeChecks: {
        strictStateImmutability: true,
        strictActionImmutability: true,
      },
    }),
    StoreDevtoolsModule.instrument({
      maxAge: 25999, // Retains last 25 states
      logOnly: environment.production, // Restrict extension to log-only mode
    }),
    EffectsModule.forRoot([ViewerEffects]),
  ],
  providers: [BrowserParamsService],
  bootstrap: [AppComponent],
})
export class AppModule {}
