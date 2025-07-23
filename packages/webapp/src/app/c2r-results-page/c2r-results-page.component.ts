import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
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
import { Router, RouterLink } from '@angular/router';
import { fileExtensions, mimeTypes } from '@csvw-rdf-convertor/core';

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
    RouterLink,
  ],
  templateUrl: './c2r-results-page.component.html',
  styleUrl: './c2r-results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class C2rResultsPageComponent implements OnDestroy {
  service = inject(C2RService);
  private snackBar = inject(MatSnackBar);
  containsErrors = computed(
    () => this.service.issues().at(-1)?.type === 'error',
  );
  showResult = signal(false);
  router = inject(Router);

  constructor() {
    if (
      !this.service.converting() &&
      !this.service.result() &&
      !this.service.issues().length
    ) {
      this.router.navigate(['/c2r']);
    }
  }

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

  download(text: string, filename: string, filetype: string) {
    const blob = new Blob([text], { type: filetype });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  downloadConfig() {
    const config = this.service.config;
    const json = JSON.stringify(config);
    this.download(json, 'c2r-config.json', 'application/json');
  }

  downloadResult() {
    const result = this.service.result();
    const params = this.service.params;
    const filename =
      this.removeExt(params.files.mainFile?.name) ||
      this.urlToFilename(
        params.files.mainFileUrl,
        params.options.baseIri || 'https://example.com',
      ) ||
      'c2r-result';
    this.download(
      result,
      `${filename}.${fileExtensions[params.format.format]}`,
      mimeTypes[params.format.format],
    );
  }

  urlToFilename(url: string, base: string): string {
    const parsed = URL.parse(url) || URL.parse(url, base);
    return this.removeExt(parsed.pathname.split('/').pop());
  }

  removeExt(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  }

  ngOnDestroy(): void {
    this.service.reset();
  }
}
