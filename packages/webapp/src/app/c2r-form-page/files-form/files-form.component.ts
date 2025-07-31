import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTab, MatTabChangeEvent, MatTabGroup } from '@angular/material/tabs';
import { FileUploadComponent } from '../../widgets/file-upload/file-upload.component';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';

@Component({
  selector: 'app-files-form',
  imports: [
    CommonModule,
    MatTabGroup,
    MatTab,
    FileUploadComponent,
    MatFormField,
    MatInput,
    MatLabel,
    ReactiveFormsModule,
  ],
  templateUrl: './files-form.component.html',
  styleUrl: './files-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilesFormComponent {
  form = input<
    FormGroup<{
      mainFile: FormControl<File>;
      mainFileUrl: FormControl<string>;
      otherFiles: FormControl<File[]>;
      configFile: FormControl<File>;
    }>
  >();

  onMFTabChange(event: MatTabChangeEvent): void {
    const isFileTab = event.index === 0;
    const urlInp = this.form().get('mainFileUrl');
    this.form().get('mainFile')[isFileTab ? 'enable' : 'disable']();
    urlInp[isFileTab ? 'disable' : 'enable']();
  }
}
