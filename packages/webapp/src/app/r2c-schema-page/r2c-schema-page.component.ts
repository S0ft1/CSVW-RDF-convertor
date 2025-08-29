import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { R2CService } from '../services/r2c.service';
import { DiagramComponent } from './diagram/diagram.component';
import { MatProgressBar } from '@angular/material/progress-bar';

@Component({
  selector: 'app-r2c-schema-page',
  imports: [CommonModule, DiagramComponent, MatProgressBar],
  templateUrl: './r2c-schema-page.component.html',
  styleUrl: './r2c-schema-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cSchemaPageComponent {
  service = inject(R2CService);
}
