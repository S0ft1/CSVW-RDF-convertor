import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { CsvwIconComponent } from './csvw-icon/csvw-icon.component';
import { RdfIconComponent } from './rdf-icon/rdf-icon.component';

@Component({
  selector: 'app-main-page',
  imports: [
    CommonModule,
    MatButton,
    RouterLink,
    CsvwIconComponent,
    RdfIconComponent,
  ],
  templateUrl: './main-page.component.html',
  styleUrl: './main-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainPageComponent {}
