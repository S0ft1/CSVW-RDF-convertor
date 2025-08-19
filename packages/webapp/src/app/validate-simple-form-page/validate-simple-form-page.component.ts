import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-validate-simple-form-page',
  imports: [CommonModule],
  templateUrl: './validate-simple-form-page.component.html',
  styleUrl: './validate-simple-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateSimpleFormPageComponent {}
