import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { PrefixesComponent } from '../../../widgets/prefixes/prefixes.component';
import {
  MatFormField,
  MatHint,
  MatInput,
  MatLabel,
} from '@angular/material/input';

@Component({
  selector: 'app-ttl-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatSlideToggle,
    PrefixesComponent,
    MatFormField,
    MatInput,
    MatLabel,
    MatHint,
  ],
  templateUrl: './ttl-form.component.html',
  styleUrl: './ttl-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TtlFormComponent {
  form = input<
    FormGroup<{
      prefixes: FormControl<Record<string, string>>;
      lookupPrefixes: FormControl<boolean>;
      baseIri: FormControl<string>;
    }>
  >();
}
