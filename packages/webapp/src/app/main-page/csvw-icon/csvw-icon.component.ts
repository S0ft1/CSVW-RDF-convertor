import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-csvw-icon',
  imports: [CommonModule],
  templateUrl: './csvw-icon.component.html',
  styleUrl: './csvw-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CsvwIconComponent {}
