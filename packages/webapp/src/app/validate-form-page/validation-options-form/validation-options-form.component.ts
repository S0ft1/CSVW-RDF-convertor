import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { PathOverrideComponent } from '../../c2r-form-page/options-form/path-override/path-override.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-validation-options-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    PathOverrideComponent,
    MatButton,
    MatIcon,
    MatIconButton,
    MatHint,
  ],
  templateUrl: './validation-options-form.component.html',
  styleUrl: './validation-options-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationOptionsFormComponent {
  form = input<
    FormGroup<{
      baseIri: FormControl<string>;
      pathOverrides: FormArray<FormControl<[string | RegExp, string]>>;
    }>
  >();
  overrideFA = computed(
    () =>
      this.form().get('pathOverrides') as FormArray<
        FormControl<[string | RegExp, string]>
      >,
  );
  descriptor = input<unknown>();

  addPathOverride() {
    this.overrideFA().push(new FormControl(null, Validators.required));
  }

  removePathOverride(index: number) {
    this.overrideFA().removeAt(index);
  }
}
