import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatIconButton } from '@angular/material/button';

@Component({
  selector: 'app-file-handle',
  imports: [
    CommonModule,
    MatFormField,
    MatInput,
    MatIcon,
    MatLabel,
    MatIconButton,
  ],
  templateUrl: './file-handle.component.html',
  styleUrl: './file-handle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileHandleComponent {
  path = input<string>('');
  originalName = input<string>('');

  remove = output<void>();
  pathChange = output<string>();
}
