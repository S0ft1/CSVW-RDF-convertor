import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RDFSerialization } from '@csvw-rdf-convertor/core';
import { TtlFormComponent } from './ttl-form/ttl-form.component';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatFormField, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { transition, trigger, useAnimation } from '@angular/animations';
import { dropdownIn } from '../../animations';

@Component({
  selector: 'app-format-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TtlFormComponent,
    MatProgressSpinner,
    MatFormField,
    MatSelect,
    MatOption,
    MatLabel,
  ],
  templateUrl: './format-form.component.html',
  styleUrl: './format-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fade', [transition(':enter', useAnimation(dropdownIn))]),
  ],
})
export class FormatFormComponent {
  form = input<
    FormGroup<{
      format: FormControl<RDFSerialization>;
      ttl: FormGroup<{
        prefixes: FormControl<Record<string, string>>;
        lookupPrefixes: FormControl<boolean>;
        baseIri: FormControl<string>;
      }>;
    }>
  >();
}
