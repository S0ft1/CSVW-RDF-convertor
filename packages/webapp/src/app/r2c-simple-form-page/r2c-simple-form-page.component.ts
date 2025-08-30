import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { InitR2CParams, R2CService } from '../services/r2c.service';
import { Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs/operators';
import { MatTab, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { FileUploadComponent } from '../widgets/file-upload/file-upload.component';
import { MatSlideToggle } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-r2c-simple-form-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButton,
    MatTab,
    MatTabGroup,
    FileUploadComponent,
    MatLabel,
    MatFormField,
    MatInput,
    MatSlideToggle,
  ],
  templateUrl: './r2c-simple-form-page.component.html',
  styleUrl: './r2c-simple-form-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cSimpleFormPageComponent {
  form = new FormGroup({
    files: new FormGroup({
      mainFile: new FormControl<File>(null, Validators.required),
      mainFileUrl: new FormControl<string>('', Validators.required),
    }),
    options: new FormGroup({
      interactiveSchema: new FormControl<boolean>(true),
    }),
    descriptor: new FormControl<any>(null), // only for keeping descriptor from a config file,
  });
  service = inject(R2CService);
  router = inject(Router);

  filesFG = this.form.get('files') as FormGroup;
  optionsFG = this.form.get('options') as FormGroup;

  descriptor = toSignal(
    this.form
      .get('descriptor')
      .valueChanges.pipe(startWith(this.form.get('descriptor').value)),
  );

  constructor() {
    this.filesFG.get('mainFileUrl').disable();
  }

  submit() {
    const val = this.form.value;
    const params: InitR2CParams = {
      files: {
        ...val.files,
        otherFiles: [],
      },
      options: {
        pathOverrides: [],
        useVocabMetadata: true,
        interactiveSchema: val.options.interactiveSchema,
      },
      descriptor: val.descriptor,
    };
    if (this.form.value.options.interactiveSchema) {
      this.service.inferSchema(params);
      this.router.navigate(['r2c/schema']);
    } else {
      this.service.initConversion(params);
      this.router.navigate(['r2c/results']);
    }
    this.form.reset();
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
