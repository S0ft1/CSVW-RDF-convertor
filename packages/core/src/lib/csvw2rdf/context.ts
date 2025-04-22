import { DescriptorWrapper } from '../descriptor.js';
import { IssueTracker } from '../utils/issue-tracker.js';

export interface Csvw2RdfContext {
  input: DescriptorWrapper;
  issueTracker: IssueTracker;
}
