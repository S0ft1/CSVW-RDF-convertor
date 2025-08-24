import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTab, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { ValidateService } from '../services/validate.service';
import { Router } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, startWith, switchMap } from 'rxjs/operators';
import { MatButton } from '@angular/material/button';
import { FileUploadComponent } from '../widgets/file-upload/file-upload.component';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';

@Component({
  selector: 'app-validate-simple-form-page',
  imports: [
    CommonModule,
    MatTabGroup,
    MatButton,
    MatTab,
    ReactiveFormsModule,
    FileUploadComponent,
    MatFormField,
    MatInput,
    MatLabel,
  ],
  templateUrl: './validate-simple-form-page.component.html',
  styleUrl: './validate-simple-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateSimpleFormPageComponent {
  form = new FormGroup({
    files: new FormGroup({
      mainFile: new FormControl<File>(null, Validators.required),
      mainFileUrl: new FormControl<string>('', Validators.required),
    }),
  });
  service = inject(ValidateService);
  router = inject(Router);

  filesFG = this.form.get('files') as FormGroup;

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
      },
    });
    this.form.reset();
    this.router.navigate(['validate/results']);
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
