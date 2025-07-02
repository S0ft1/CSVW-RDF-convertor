import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatError,
  MatFormField,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import fuzzysort from 'fuzzysort';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, map } from 'rxjs/operators';
import { allUris } from '@csvw-rdf-convertor/core';
import {
  MatAutocompleteModule,
  MatOption,
} from '@angular/material/autocomplete';
import { MatSlideToggle } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-path-override',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatAutocompleteModule,
    MatOption,
    MatSlideToggle,
    MatError,
  ],
  templateUrl: './path-override.component.html',
  styleUrl: './path-override.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PathOverrideComponent),
      multi: true,
    },
  ],
})
export class PathOverrideComponent implements ControlValueAccessor {
  searchControl = new FormControl<string>('', [Validators.required]);
  isRegexControl = new FormControl(false);
  form = new FormGroup(
    {
      pattern: this.searchControl,
      replacement: new FormControl('', Validators.required),
      isRegex: this.isRegexControl,
    },
    () => {
      const isRegex = this.isRegexControl.value;
      if (!isRegex) {
        this.removeInvalidRegexError();
        return null;
      }
      const pattern = this.searchControl.value;
      if (this.regexCache?.source !== pattern) {
        try {
          this.regexCache = new RegExp(pattern);
          this.removeInvalidRegexError();
          return null;
        } catch {
          this.searchControl.setErrors({
            ...this.searchControl.errors,
            invalidRegex: true,
          });
          return null;
        }
      }
      return null;
    }
  );

  descriptor = input<unknown>();

  preparedUris = computed(() => {
    const uris = allUris(this.descriptor());
    return Array.from(Iterator.from(uris).map((u) => fuzzysort.prepare(u)));
  });
  filteredUris = toSignal(
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      map((search) => {
        const results = fuzzysort
          .go(search, this.preparedUris(), {
            limit: 7,
            all: false,
          })
          .map((res) => res.target);
        return results;
      })
    ),
    { initialValue: [] }
  );
  disabled = signal(false);
  regexCache: RegExp;

  onChange: (value: [string | RegExp, string]) => void = () => {};
  onTouched: () => void = () => {};

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (!this.form.valid) this.onChange(null);
      else {
        this.onChange([
          value.isRegex ? this.regexCache : value.pattern,
          value.replacement,
        ]);
      }
    });
  }

  writeValue(obj: [string | RegExp, string]): void {
    if (!obj) {
      this.form.reset();
      return;
    }
    this.form.setValue({
      isRegex: obj[0] instanceof RegExp,
      pattern: obj[0] instanceof RegExp ? obj[0].source : obj[0],
      replacement: obj[1],
    });
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
    this.searchControl[isDisabled ? 'disable' : 'enable']();
  }

  private removeInvalidRegexError() {
    if (this.searchControl.errors?.invalidRegex) {
      const errors = { ...this.searchControl.errors };
      delete errors.invalidRegex;
      this.searchControl.setErrors(Object.keys(errors).length ? errors : null);
    }
  }
}
