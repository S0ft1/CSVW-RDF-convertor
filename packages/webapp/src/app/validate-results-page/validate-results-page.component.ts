import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ValidateService } from '../services/validate.service';
import { Router, RouterLink } from '@angular/router';
import { MatProgressBar } from '@angular/material/progress-bar';
import { IssueCardComponent } from '../c2r-results-page/issue-card/issue-card.component';
import { MatButton } from '@angular/material/button';

@Component({
  selector: 'app-validate-results-page',
  imports: [
    CommonModule,
    MatProgressBar,
    IssueCardComponent,
    RouterLink,
    MatButton,
  ],
  templateUrl: './validate-results-page.component.html',
  styleUrl: './validate-results-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidateResultsPageComponent implements OnDestroy {
  service = inject(ValidateService);
  router = inject(Router);
  lastUrl = this.router.lastSuccessfulNavigation.initialUrl.toString();
  simple = this.lastUrl.endsWith('simple');

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
    this.download(json, 'validation-config.json', 'application/json');
  }

  ngOnDestroy(): void {
    this.service.reset();
  }
}
