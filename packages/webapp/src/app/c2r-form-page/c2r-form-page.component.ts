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
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButton } from '@angular/material/button';
import { FilesFormComponent } from './files-form/files-form.component';
import { FormatFormComponent } from './format-form/format-form.component';
import { OptionsFormComponent } from './options-form/options-form.component';
import { RDFSerialization } from '@csvw-rdf-convertor/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { startWith, filter, switchMap } from 'rxjs/operators';
import { C2RService, InitC2RParams } from '../services/c2r.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-c2r-form-page',
  imports: [
    CommonModule,
    MatStepperModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatButton,
    FilesFormComponent,
    FormatFormComponent,
    OptionsFormComponent,
  ],
  templateUrl: './c2r-form-page.component.html',
  styleUrl: './c2r-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class C2rFormPageComponent {
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
      templateIris: new FormControl<boolean>(false, { nonNullable: true }),
      minimal: new FormControl<boolean>(true, { nonNullable: true }),
    }),
    format: new FormGroup({
      format: new FormControl<RDFSerialization>('turtle', {
        nonNullable: true,
        validators: Validators.required,
      }),
      ttl: new FormGroup({
        prefixes: new FormControl<Record<string, string>>(
          {},
          { nonNullable: true, validators: Validators.required }
        ),
        lookupPrefixes: new FormControl<boolean>(false, { nonNullable: true }),
        baseIri: new FormControl<string>(''),
      }),
    }),
  });
  service = inject(C2RService);
  router = inject(Router);

  filesFG = this.form.get('files') as FormGroup;
  optionsFG = this.form.get('options') as FormGroup;
  formatFG = this.form.get('format') as FormGroup;

  descriptor = toSignal(
    this.filesFG.get('mainFile').valueChanges.pipe(
      startWith(this.filesFG.get('mainFile').value),
      filter((file) => file instanceof File && file.name.endsWith('.json')),
      switchMap((file: File) => file.text().then((x) => JSON.parse(x)))
    )
  );

  constructor() {
    this.filesFG.get('mainFileUrl').disable();
    this.filesFG
      .get('configFile')
      .valueChanges.pipe(
        filter((x) => !!x),
        takeUntilDestroyed()
      )
      .subscribe(async (file: File) => {
        const content = await file.text().then((x) => JSON.parse(x));
        this.form.patchValue(this.service.configToParams(content));
      });
  }

  submit() {
    this.service.initConversion(this.form.value as InitC2RParams);
    this.form.reset();
    this.router.navigate(['c2r/results']);
  }
}
