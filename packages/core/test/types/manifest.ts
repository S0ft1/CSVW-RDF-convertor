export interface Manifest {
  '@context': {};
  id: string;
  type: ManifestType;
  label: string;
  comment: string;
  entries: Entry[];
}

export enum ManifestType {
  Manifest = 'mf:Manifest',
}

export interface Entry {
  id: string;
  type: EntryType;
  name: string;
  comment: string;
  approval: EntryApproval;
  option: EntryOption;
  action: string;
  result?: string;
  implicit?: string[];
  httpLink?: string;
}

export enum EntryType {
  Test = 'csvt:ToRdfTest',
  TestWithWarnings = 'csvt:ToRdfTestWithWarnings',
  NegativeTest = 'csvt:NegativeRdfTest',
}

export enum EntryApproval {
  Approved = 'rdft:Approved',
}

export interface EntryOption {
  noProv: boolean;
  metadata?: string;
  minimal?: boolean;
}

export interface SimpleTest {
  id: number;
  name: string;
  inputDataPath:string;
  inputDescriptor?: string;
  expectedOutput?: string;
  result?: string;
  comment?: string;
  expectsWarning?: boolean;
  expectsError?: boolean;
}