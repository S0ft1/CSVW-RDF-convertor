import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IssueCardComponent } from './issue-card.component';
import { setInput } from '../../testing/set-input';

describe('IssueCardComponent', () => {
  let component: IssueCardComponent;
  let fixture: ComponentFixture<IssueCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IssueCardComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IssueCardComponent);
    component = fixture.componentInstance;
    setInput(fixture, 'issue', {});
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
