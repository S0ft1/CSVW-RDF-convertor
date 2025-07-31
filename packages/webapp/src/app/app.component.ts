import { Component } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { MatToolbar } from '@angular/material/toolbar';
import { LightToggleComponent } from './light-toggle/light-toggle.component';

@Component({
  imports: [RouterModule, MatToolbar, RouterLink, LightToggleComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {}
