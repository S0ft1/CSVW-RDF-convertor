import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-r2c-schema-page',
  imports: [CommonModule],
  templateUrl: './r2c-schema-page.component.html',
  styleUrl: './r2c-schema-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cSchemaPageComponent {}
