import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rdf-icon',
  imports: [CommonModule],
  templateUrl: './rdf-icon.component.html',
  styleUrl: './rdf-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RdfIconComponent {}
