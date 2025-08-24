import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatStepperModule } from '@angular/material/stepper';
import {
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { R2cFilesFormComponent } from './r2c-files-form/r2c-files-form.component';
import { R2cOptionsFormComponent } from './r2c-options-form/r2c-options-form.component';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith, filter, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { InitR2CParams, R2CService } from '../services/r2c.service';
import { of } from 'rxjs';

@Component({
  selector: 'app-r2c-form-page',
  imports: [
    CommonModule,
    MatStepperModule,
    ReactiveFormsModule,
    MatButton,
    R2cFilesFormComponent,
    R2cOptionsFormComponent,
  ],
  templateUrl: './r2c-form-page.component.html',
  styleUrl: './r2c-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cFormPageComponent {
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
      interactiveSchema: new FormControl<boolean>(true, { nonNullable: true }),
      useVocabMetadata: new FormControl<boolean>(true, { nonNullable: true }),
    }),
  });
  service = inject(R2CService);
  router = inject(Router);

  filesFG = this.form.get('files') as FormGroup;
  optionsFG = this.form.get('options') as FormGroup;

  descriptor = toSignal(
    this.filesFG.get('configFile').valueChanges.pipe(
      startWith(this.filesFG.get('configFile').value),
      switchMap((file: File) =>
        file
          ? file.text().then((x) => {
              const parsed = JSON.parse(x);
              if (!('@context' in parsed) && 'descriptor' in parsed) {
                return parsed.descriptor;
              }
              return parsed;
            })
          : of(null),
      ),
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
        content.a = 11;
        // this.form.patchValue(this.service.configToParams(content));
      });
  }

  submit() {
    this.service.initConversion(this.form.value as InitR2CParams);
    this.form.reset();
    this.router.navigate(['r2c/results']);
  }
}
