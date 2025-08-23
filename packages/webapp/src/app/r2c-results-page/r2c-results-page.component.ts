import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-r2c-results-page',
  imports: [CommonModule],
  templateUrl: './r2c-results-page.component.html',
  styleUrl: './r2c-results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cResultsPageComponent {}
