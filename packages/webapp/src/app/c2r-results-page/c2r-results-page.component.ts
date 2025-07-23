import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { C2RService } from '../services/c2r.service';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButton, MatIconButton } from '@angular/material/button';
import { IssueCardComponent } from './issue-card/issue-card.component';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-c2r-results-page',
  imports: [
    CommonModule,
    MatProgressBar,
    MatCardModule,
    MatButton,
    IssueCardComponent,
    MatIcon,
    MatIconButton,
  ],
  templateUrl: './c2r-results-page.component.html',
  styleUrl: './c2r-results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class C2rResultsPageComponent {
  service = inject(C2RService);
  private snackBar = inject(MatSnackBar);
  containsErrors = computed(
    () => this.service.issues().at(-1)?.type === 'error',
  );
  showResult = signal(false);

  copyToClipboard() {
    navigator.clipboard
      .writeText(this.service.result() ?? '')
      .then(() => {
        this.snackBar.open('Result copied to clipboard', 'Close', {
          duration: 2000,
        });
      })
      .catch((error) => {
        console.error('Failed to copy result:', error);
      });
  }
}
