import { RDFSerialization } from '@csvw-rdf-convertor/core';

/**
 * Enum representing the types of conversions supported.
 */
export enum ConversionType {
  CSVW_TO_RDF = 'csvw2rdf',
  RDF_TO_CSVW = 'rdf2csvw',
}

/**
 * Configuration options for minimal CSVW to RDF conversion.
 */
export interface MiniOptions {
  /** Output RDF Serialization */
  format: RDFSerialization;
  /** Whether to use template IRIs in the conversion */
  templateIris: boolean;
  /** Whether to use minimal mode for reduced output */
  minimal: boolean;
}

/**
 * Represents a single conversion item in the tree view.
 * Contains all necessary information and references for managing a conversion.
 */
export interface ConversionItem {
  id: string;
  name: string;
  folderPath: string;
  descriptorFilePath?: string;
  inputFilePath: string;
  rdfInputFilePath: string;
  outputFilePath?: string;
  outputFilePaths?: string[];
  additionalInputFilePaths?: string[];
  templateIRIsChecked?: boolean;
  minimalModeChecked?: boolean;
  rdfSerialization?: RDFSerialization;
  errorFilePath?: string;
  lastConversionType?: ConversionType;
  lastShownOutputFiles?: string[];
}

/**
 * Union type representing items that can be displayed in the tree view.
 * Can be either a string (for actions) or a ConversionItem.
 */
export type TreeItem = string | ConversionItem;
