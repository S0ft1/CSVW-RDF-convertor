import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Issue } from '@csvw-rdf-convertor/core';

@Component({
  selector: 'app-issue-card',
  imports: [CommonModule],
  templateUrl: './issue-card.component.html',
  styleUrl: './issue-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssueCardComponent {
  issue = input<Issue>();
  locationKeys: (keyof Issue['location'])[] = ['table', 'column', 'row'];
}
