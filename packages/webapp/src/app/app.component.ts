import { Component, inject } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { LightToggleComponent } from './light-toggle/light-toggle.component';
import { LoadingOverlayComponent } from './loading-overlay/loading-overlay.component';
import { LoadingOverlayService } from './services/loading-overlay.service';
import { GhLogoComponent } from './widgets/gh-logo/gh-logo.component';

@Component({
  imports: [
    RouterModule,
    MatToolbar,
    RouterLink,
    LightToggleComponent,
    LoadingOverlayComponent,
    GhLogoComponent,
  ],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  public loadingOverlayS = inject(LoadingOverlayService);
}
