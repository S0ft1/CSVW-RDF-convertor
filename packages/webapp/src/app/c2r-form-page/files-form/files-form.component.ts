import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-files-form',
  imports: [CommonModule],
  templateUrl: './files-form.component.html',
  styleUrl: './files-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesFormComponent {}
