import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  MatFormField,
  MatHint,
  MatInput,
  MatLabel,
} from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { PathOverrideComponent } from '../../c2r-form-page/options-form/path-override/path-override.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-r2c-options-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatSlideToggle,
    PathOverrideComponent,
    MatButton,
    MatIcon,
    MatIconButton,
    MatHint,
  ],
  templateUrl: './r2c-options-form.component.html',
  styleUrl: './r2c-options-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cOptionsFormComponent {
  form = input<
    FormGroup<{
      baseIri: FormControl<string>;
      pathOverrides: FormArray<FormControl<[string | RegExp, string]>>;
      interactiveSchema: FormControl<boolean>;
      useVocabMetadata: FormControl<boolean>;
    }>
  >();
  overrideFA = computed(
    () =>
      this.form().get('pathOverrides') as FormArray<
        FormControl<[string | RegExp, string]>
      >,
  );
  descriptor = input<unknown>();

  constructor() {
    effect(() => {
      const descriptorProvided = !!this.descriptor();
      const ctrl = this.form().get('interactiveSchema');
      ctrl[descriptorProvided ? 'disable' : 'enable']();
    });
  }

  addPathOverride() {
    this.overrideFA().push(new FormControl(null, Validators.required));
  }

  removePathOverride(index: number) {
    this.overrideFA().removeAt(index);
  }
}
