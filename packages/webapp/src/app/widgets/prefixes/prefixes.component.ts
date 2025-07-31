import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MatError,
  MatFormField,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatButton, MatIconButton } from '@angular/material/button';
import {
  ControlValueAccessor,
  FormArray,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-prefixes',
  imports: [
    CommonModule,
    MatFormField,
    MatInput,
    MatIcon,
    MatLabel,
    MatError,
    MatIconButton,
    ReactiveFormsModule,
    MatButton,
  ],
  templateUrl: './prefixes.component.html',
  styleUrl: './prefixes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PrefixesComponent),
      multi: true,
    },
  ],
})
export class PrefixesComponent implements ControlValueAccessor {
  onTouched: () => void;
  onChange: (value: Record<string, string>) => void = () => {};
  isDisabled = signal(false);

  form = new FormGroup({
    keys: new FormArray([]),
    values: new FormArray([]),
  });
  keys = this.form.get('keys') as FormArray<FormControl<string>>;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.onChange(this.form.valid ? this.getValue() : null);
    });
  }

  writeValue(obj: Record<string, string>): void {
    const value = {
      keys: obj ? Object.keys(obj) : [],
      values: obj ? Object.values(obj) : [],
    };
    this.form.setValue(value, { emitEvent: false });
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    this.form[isDisabled ? 'disable' : 'enable']();
  }

  addPrefix(): void {
    const values = this.form.get('values') as FormArray;
    this.keys.push(
      new FormControl('', {
        validators: [
          Validators.required,
          Validators.pattern(/^[a-z][a-z0-9]*$/i),
        ],
      })
    );
    values.push(new FormControl('', Validators.required));
  }

  removePrefix(index: number): void {
    this.keys.removeAt(index);
    (this.form.get('values') as FormArray).removeAt(index);
    this.onChange(this.getValue());
  }

  getValue(): Record<string, string> {
    const keys = this.keys.value;
    const values = (this.form.get('values') as FormArray).value;
    const result: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = values[i];
    }
    return result;
  }
}
