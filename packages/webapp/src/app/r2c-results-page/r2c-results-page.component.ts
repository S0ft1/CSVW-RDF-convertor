import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
} from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { IssueCardComponent } from '../c2r-results-page/issue-card/issue-card.component';
import { R2CService } from '../services/r2c.service';
import { downloadZip } from 'client-zip';
import {
  MatExpansionPanel,
  MatExpansionPanelHeader,
} from '@angular/material/expansion';

@Component({
  selector: 'app-r2c-results-page',
  imports: [
    CommonModule,
    MatProgressBar,
    MatCardModule,
    MatButton,
    IssueCardComponent,
    MatIcon,
    MatIconButton,
    RouterLink,
    MatExpansionPanel,
    MatExpansionPanelHeader,
  ],
  templateUrl: './r2c-results-page.component.html',
  styleUrl: './r2c-results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class R2cResultsPageComponent implements OnDestroy {
  service = inject(R2CService);
  private snackBar = inject(MatSnackBar);
  containsErrors = computed(
    () => this.service.issues().at(-1)?.type === 'error',
  );
  router = inject(Router);
  lastUrl = this.getLastUrl();
  simple = this.lastUrl.endsWith('simple');

  constructor() {}

  getLastUrl() {
    let nav = this.router.lastSuccessfulNavigation;
    if (nav.initialUrl.toString().endsWith('schema')) {
      nav = nav.previousNavigation;
    }
    return nav.initialUrl.toString();
  }

  copyToClipboard(text: string) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.snackBar.open('Result copied to clipboard', 'Close', {
          duration: 2000,
        });
      })
      .catch((error) => {
        console.error('Failed to copy result:', error);
      });
  }

  download(blob: Blob, filename: string) {
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
    this.download(
      new Blob([json], { type: 'application/json' }),
      'r2c-config.json',
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

  async downloadFullResult() {
    const blob = await downloadZip(
      this.service
        .result()
        .map(({ content, filename }) => ({ name: filename, input: content })),
    ).blob();
    this.download(blob, 'r2c-result.zip');
  }
}
