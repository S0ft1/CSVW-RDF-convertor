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
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { PathOverrideComponent } from './path-override/path-override.component';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

@Component({
  selector: 'app-options-form',
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
  templateUrl: './options-form.component.html',
  styleUrl: './options-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsFormComponent {
  form = input<
    FormGroup<{
      baseIri: FormControl<string>;
      pathOverrides: FormArray<FormControl<[string | RegExp, string]>>;
      templateIris: FormControl<boolean>;
      minimal: FormControl<boolean>;
    }>
  >();
  overrideFA = computed(
    () =>
      this.form().get('pathOverrides') as FormArray<
        FormControl<[string | RegExp, string]>
      >
  );
  descriptor = input<unknown>();

  exampleIri = 'https://slovník.cz/čeština/přístroj';
  exampleUri = new URL(this.exampleIri).href;

  addPathOverride() {
    this.overrideFA().push(new FormControl(null, Validators.required));
  }

  removePathOverride(index: number) {
    this.overrideFA().removeAt(index);
  }
}
