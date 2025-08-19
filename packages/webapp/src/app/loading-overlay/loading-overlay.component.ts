import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-overlay',
  imports: [CommonModule, MatProgressSpinner],
  templateUrl: './loading-overlay.component.html',
  styleUrl: './loading-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {}
