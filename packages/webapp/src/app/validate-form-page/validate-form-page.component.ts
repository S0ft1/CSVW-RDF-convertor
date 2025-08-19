import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-validate-form-page',
  imports: [CommonModule],
  templateUrl: './validate-form-page.component.html',
  styleUrl: './validate-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateFormPageComponent {}
