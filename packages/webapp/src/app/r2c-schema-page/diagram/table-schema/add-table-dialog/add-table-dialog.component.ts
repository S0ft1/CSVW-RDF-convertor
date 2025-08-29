import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';

@Component({
  selector: 'app-add-table-dialog',
  imports: [
    MatDialogModule,
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatButton,
  ],
  templateUrl: './add-table-dialog.component.html',
  styleUrl: './add-table-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTableDialogComponent {
  ctrl = new FormControl('', Validators.required);
}
