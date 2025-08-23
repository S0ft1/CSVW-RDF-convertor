import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-r2c-simple-form-page',
  imports: [CommonModule],
  templateUrl: './r2c-simple-form-page.component.html',
  styleUrl: './r2c-simple-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cSimpleFormPageComponent {}
