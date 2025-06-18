import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-file-handle',
  imports: [CommonModule],
  templateUrl: './file-handle.component.html',
  styleUrl: './file-handle.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileHandleComponent {}
