import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-validate-results-page',
  imports: [CommonModule],
  templateUrl: './validate-results-page.component.html',
  styleUrl: './validate-results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateResultsPageComponent {}
