import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NgControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { FileHandleComponent } from '../file-handle/file-handle.component';
import { GlobalEventService } from '../../services/global-event.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatChip, MatChipRemove, MatChipSet } from '@angular/material/chips';
import { MatIcon } from '@angular/material/icon';
import { transition, trigger, useAnimation } from '@angular/animations';
import { dropdownIn, dropdownOut } from '../../animations';

@Component({
  selector: 'app-file-upload',
  imports: [
    CommonModule,
    MatButtonModule,
    FileHandleComponent,
    MatChip,
    MatChipSet,
    MatChipRemove,
    MatIcon,
  ],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fade', [
      transition(':enter', useAnimation(dropdownIn)),
      transition(':leave', useAnimation(dropdownOut)),
    ]),
  ],
})
export class FileUploadComponent implements ControlValueAccessor, OnInit {
  private static instances = 0;
  id = `file-upload-${FileUploadComponent.instances++}`;

  multiple = input(false);
  label = input('Upload File');
  buttonLabel = input('Choose File');
  editableNames = input(false);
  accept = input<string | null>(null);

  private gEventS = inject(GlobalEventService);
  dragging = toSignal(this.gEventS.dragging);
  private registeredControl = inject(NgControl, {
    optional: true,
    self: true,
  });
  isRequired = signal(false);

  value: File[] = [];
  isDisabled = signal(false);
  private onChange: (value: File | File[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  originalNames = new Map<File, string>();

  constructor() {
    if (this.registeredControl) {
      this.registeredControl.valueAccessor = this;
    }
  }

  ngOnInit(): void {
    if (this.registeredControl) {
      this.isRequired.set(
        this.registeredControl.control?.hasValidator(Validators.required) ??
          false
      );
    }
  }

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
    for (const file of files as any as Iterable<File>) {
      this.originalNames.set(file, file.name);
    }
    if (this.multiple()) {
      this.value ??= [];
      (this.value as File[]).push(...((files as any) || []));
    } else {
      const file = files && files.length ? files[0] : null;
      this.value = file ? [file] : [];
    }
    this.handleChangeCb();
    this.onTouched();
  }

  handleChangeCb() {
    this.onChange(this.multiple() ? this.value : this.value[0] || null);
  }

  removeFile(file: File): void {
    const index = this.value.indexOf(file);
    if (index > -1) {
      this.originalNames.delete(file);
      this.value.splice(index, 1);
      this.handleChangeCb();
      this.onTouched();
    }
  }

  renameFile(file: File, newName: string): void {
    newName = newName.trim();
    if (newName === '') {
      return this.removeFile(file);
    }
    const index = this.value.indexOf(file);
    if (index > -1) {
      const renamedFile = new File([file], newName, { type: file.type });
      this.originalNames.set(renamedFile, this.originalNames.get(file));
      this.originalNames.delete(file);
      this.value[index] = renamedFile;
      this.handleChangeCb();
      this.onTouched();
    }
  }
}
