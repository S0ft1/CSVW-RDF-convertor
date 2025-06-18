import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { FileHandleComponent } from '../file-handle/file-handle.component';
import { GlobalEventService } from '../../services/global-event.service';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-file-upload',
  imports: [CommonModule, MatButtonModule, FileHandleComponent],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => FileUploadComponent),
      multi: true,
    },
  ],
})
export class FileUploadComponent implements ControlValueAccessor {
  private static instances = 0;
  id = `file-upload-${FileUploadComponent.instances++}`;

  multiple = input(false);
  label = input('Upload File');
  buttonLabel = input('Choose File');
  editableNames = input(false);

  private gEventS = inject(GlobalEventService);
  dragging = toSignal(this.gEventS.dragging);

  value: File[] = [];
  isDisabled = signal(false);
  private onChange: (value: File | File[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(obj: File | File[] | null): void {
    this.value = obj ? (Array.isArray(obj) ? obj : [obj]) : [];
  }

  registerOnChange(fn: (value: File | File[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.processFiles(input.files);
  }

  onDrop(event: DragEvent): void {
    if (this.isDisabled()) {
      return;
    }
    event.preventDefault();

    const files = event.dataTransfer?.files;
    this.processFiles(files);
  }

  private processFiles(files: FileList): void {
    if (this.multiple()) {
      this.value ??= [];
      (this.value as File[]).push(...((files as any) || []));
    } else {
      const file = files && files.length ? files[0] : null;
      this.value = file ? [file] : [];
    }
    this.onChange(this.multiple() ? this.value : this.value[0] || null);
    this.onTouched();
  }
}
