import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-options-form',
  imports: [CommonModule],
  templateUrl: './options-form.component.html',
  styleUrl: './options-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsFormComponent {}
