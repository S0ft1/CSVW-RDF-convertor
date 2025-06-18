import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatStepperModule } from '@angular/material/stepper';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FileUploadComponent } from '../widgets/file-upload/file-upload.component';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTab, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-c2r-form-page',
  imports: [
    CommonModule,
    MatStepperModule,
    ReactiveFormsModule,
    FileUploadComponent,
    MatInputModule,
    MatFormFieldModule,
    MatTabGroup,
    MatTab,
    MatButton,
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
  });

  filesFG = this.form.get('files') as FormGroup;

  onMFTabChange(event: MatTabChangeEvent): void {
    const isFileTab = event.index === 0;
    const urlInp = this.filesFG.get('mainFileUrl');
    this.filesFG.get('mainFile')[isFileTab ? 'enable' : 'disable']();
    urlInp[isFileTab ? 'disable' : 'enable']();
    if (!urlInp.value) {
      urlInp.markAsPristine();
      urlInp.markAsUntouched();
    }
  }
}
