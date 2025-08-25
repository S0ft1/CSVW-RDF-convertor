import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RDFSerialization } from '@csvw-rdf-convertor/core';
import { C2RService } from '../services/c2r.service';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, startWith, switchMap } from 'rxjs/operators';
import { MatTab, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { FileUploadComponent } from '../widgets/file-upload/file-upload.component';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-c2r-simple-form-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTab,
    MatTabGroup,
    FileUploadComponent,
    MatLabel,
    MatFormField,
    MatInput,
    MatSelect,
    MatOption,
    MatButton,
  ],
  templateUrl: './c2r-simple-form-page.component.html',
  styleUrl: './c2r-simple-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class C2rSimpleFormPageComponent {
  form = new FormGroup({
    files: new FormGroup({
      mainFile: new FormControl<File>(null, Validators.required),
      mainFileUrl: new FormControl<string>('', Validators.required),
    }),
    format: new FormGroup({
      format: new FormControl<RDFSerialization>('turtle', {
        nonNullable: true,
        validators: Validators.required,
      }),
    }),
  });
  service = inject(C2RService);
  router = inject(Router);

  filesFG = this.form.get('files') as FormGroup;
  formatFG = this.form.get('format') as FormGroup;

  descriptor = toSignal(
    this.filesFG.get('mainFile').valueChanges.pipe(
      startWith(this.filesFG.get('mainFile').value),
      filter((file) => file instanceof File && file.name.endsWith('.json')),
      switchMap((file: File) => file.text().then((x) => JSON.parse(x))),
    ),
  );

  constructor() {
    this.filesFG.get('mainFileUrl').disable();
  }

  submit() {
    const val = this.form.value;
    this.service.initConversion({
      files: {
        ...val.files,
        otherFiles: [],
      },
      options: {
        pathOverrides: [],
        templateIris: true,
        minimal: true,
      },
      format: {
        format: val.format.format,
        ttl: {
          prefixes: {},
          lookupPrefixes: false,
          baseIri: '',
        },
      },
    });
    this.form.reset();
    this.router.navigate(['c2r/results']);
  }

  onMFTabChange(event: MatTabChangeEvent): void {
    const isFileTab = event.index === 0;
    const urlInp = this.form.get(['files', 'mainFileUrl'] as const);
    /* prettier-ignore */
    this.form
      .get(['files', 'mainFile'] as const)[
        isFileTab ? 'enable' : 'disable'
      ]();
    urlInp[isFileTab ? 'disable' : 'enable']();
  }
}
