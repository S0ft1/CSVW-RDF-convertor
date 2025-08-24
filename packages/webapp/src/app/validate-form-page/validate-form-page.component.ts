import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  InitValidationParams,
  ValidateService,
} from '../services/validate.service';
import { Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { filter, startWith, switchMap } from 'rxjs/operators';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButton } from '@angular/material/button';
import { FilesFormComponent } from '../c2r-form-page/files-form/files-form.component';
import { ValidationOptionsFormComponent } from './validation-options-form/validation-options-form.component';

@Component({
  selector: 'app-validate-form-page',
  imports: [
    CommonModule,
    MatStepperModule,
    ReactiveFormsModule,
    MatButton,
    FilesFormComponent,
    ValidationOptionsFormComponent,
  ],
  templateUrl: './validate-form-page.component.html',
  styleUrl: './validate-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateFormPageComponent {
  form = new FormGroup({
    files: new FormGroup({
      mainFile: new FormControl<File>(null, Validators.required),
      mainFileUrl: new FormControl<string>('', Validators.required),
      otherFiles: new FormControl<File[]>([], { nonNullable: true }),
      configFile: new FormControl<File>(null),
    }),
    options: new FormGroup({
      baseIri: new FormControl<string>(''),
      pathOverrides: new FormArray<FormControl<[string | RegExp, string]>>([]),
    }),
  });
  service = inject(ValidateService);
  router = inject(Router);

  filesFG = this.form.get('files') as FormGroup;
  optionsFG = this.form.get('options') as FormGroup;

  descriptor = toSignal(
    this.filesFG.get('mainFile').valueChanges.pipe(
      startWith(this.filesFG.get('mainFile').value),
      filter((file) => file instanceof File && file.name.endsWith('.json')),
      switchMap((file: File) => file.text().then((x) => JSON.parse(x))),
    ),
  );

  constructor() {
    this.filesFG.get('mainFileUrl').disable();
    this.filesFG
      .get('configFile')
      .valueChanges.pipe(
        filter((x) => !!x),
        takeUntilDestroyed(),
      )
      .subscribe(async (file: File) => {
        const content = await file.text().then((x) => JSON.parse(x));
        this.form.patchValue(this.service.configToParams(content));
      });
  }

  submit() {
    this.service.initConversion(this.form.value as InitValidationParams);
    this.form.reset();
    this.router.navigate(['validate/results']);
  }
}
