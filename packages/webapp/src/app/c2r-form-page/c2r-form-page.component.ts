import { ChangeDetectionStrategy, Component } from '@angular/core';
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
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith, filter, switchMap } from 'rxjs/operators';

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
      otherFiles: new FormControl<File[]>([]),
      configFile: new FormControl<File>(null),
    }),
    options: new FormGroup({
      baseIri: new FormControl<string>(''),
      pathOverrides: new FormArray<FormControl<[string | RegExp, string]>>([]),
      templateIris: new FormControl<boolean>(false),
      minimal: new FormControl<boolean>(true),
    }),
    format: new FormGroup({
      format: new FormControl<RDFSerialization>('turtle', Validators.required),
      ttl: new FormGroup({
        prefixes: new FormControl<Record<string, string>>(
          {},
          Validators.required
        ),
        lookupPrefixes: new FormControl<boolean>(false),
        baseIri: new FormControl<string>(''),
      }),
    }),
  });

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
  }
}
