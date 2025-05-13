import { DescriptorWrapper } from '../descriptor.js';
import { IssueTracker } from '../utils/issue-tracker.js';

export interface ValidationContext {
  input: DescriptorWrapper;
  issueTracker: IssueTracker;
}
