import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ttl-form',
  imports: [CommonModule],
  templateUrl: './ttl-form.component.html',
  styleUrl: './ttl-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TtlFormComponent {}
