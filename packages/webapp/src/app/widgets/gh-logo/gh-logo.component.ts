import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatIconButton } from '@angular/material/button';

@Component({
  selector: 'app-gh-logo',
  imports: [MatIconButton],
  templateUrl: './gh-logo.component.html',
  styleUrl: './gh-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GhLogoComponent {}
