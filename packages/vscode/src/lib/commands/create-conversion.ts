import * as vscode from 'vscode';
import { CSVWActionsProvider } from '../tree-data-provider.js';
import { getAvailableFilePath, sanitizePathSegment } from '../file-utils.js';
import { fileExtensions, RDFSerialization } from '@csvw-rdf-convertor/core';
import { validateWorkspace } from '../command-handlers.js';

export const CREATE_CONVERSION_COMMAND = 'csvwrdfconvertor.createConversion';

/**
 * Registers the command that creates a new conversion,
 * input box is shown to provide its name.
 * @param csvwActionsProvider Tree data provider for conversions
 * @returns Disposable which unregisters the command on disposal
 */
export function registerCreateConversion(
  csvwActionsProvider: CSVWActionsProvider,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    CREATE_CONVERSION_COMMAND,
    async () => {
      const workspaceFolder = validateWorkspace();
      if (workspaceFolder === undefined) {
        return;
      }

      // TODO: Make public getter for tree-data-provider counter and make value dynamic
      const conversionName = await vscode.window.showInputBox({
        prompt: 'Enter a name for the new conversion',
        placeHolder: 'My Conversion',
        value: 'My Conversion',
      });
      if (conversionName === undefined) {
        // user canceled the creation of a new conversion
        // e.g by pressing Esc
        return;
      }
      const sanitizedName = sanitizePathSegment(conversionName);

      const conversion = csvwActionsProvider.addConversion(
        conversionName,
        await createDefaultDescriptorFile(workspaceFolder.uri, sanitizedName),
        await createDefaultCsvFiles(workspaceFolder.uri, sanitizedName),
        await createDefaultRdfFiles(workspaceFolder.uri, sanitizedName),
      );

      vscode.window.showInformationMessage(
        `✅ Created new conversion: ${conversion.name}`,
      );
    },
  );
}

/**
 * Creates CSVW descriptor file with default content.
 * @param workspaceFolder URI of the root workspace folder
 * @param conversionName Sanitized conversion name
 * @returns URI of the newly created descriptor file with the default content
 */
async function createDefaultDescriptorFile(
  workspaceFolder: vscode.Uri,
  conversionName: string,
): Promise<vscode.Uri> {
  const encoder = new TextEncoder();
  const tableName = 'countries';
  const descriptorFile = await getAvailableFilePath(
    vscode.Uri.joinPath(workspaceFolder, conversionName),
    `${tableName}.csv-metadata.json`,
  );

  await vscode.workspace.fs.writeFile(
    descriptorFile,
    encoder.encode(`{
  "@context": "http://www.w3.org/ns/csvw",
  "tables": [{
    "url": "${tableName}.csv",
    "tableSchema": {
      "columns": [{
        "name": "countryCode",
        "titles": "countryCode",
        "datatype": "string",
        "propertyUrl": "http://www.geonames.org/ontology{#_name}"
      }, {
        "name": "latitude",
        "titles": "latitude",
        "datatype": "number"
      }, {
        "name": "longitude",
        "titles": "longitude",
        "datatype": "number"
      }, {
        "name": "name",
        "titles": "name",
        "datatype": "string"
      }],
      "aboutUrl": "http://example.org/countries.csv{#countryCode}",
      "propertyUrl": "http://schema.org/{_name}",
      "primaryKey": "countryCode"
    }
  }]
}
`),
  );

  return descriptorFile;
}

/**
 * Creates CSV file with default content.
 * @param workspaceFolder URI of the root workspace folder
 * @param conversionName Sanitized conversion name
 * @returns URI of the newly created descriptor file with the default content
 */
async function createDefaultCsvFiles(
  workspaceFolder: vscode.Uri,
  conversionName: string,
): Promise<[vscode.Uri]> {
  const encoder = new TextEncoder();
  const tableName = 'countries';
  const csvFile = await getAvailableFilePath(
    vscode.Uri.joinPath(workspaceFolder, conversionName),
    `${tableName}.csv`,
  );

  await vscode.workspace.fs.writeFile(
    csvFile,
    encoder.encode(`countryCode,latitude,longitude,name
AD,42.546245,1.601554,Andorra
AE,23.424076,53.847818,"United Arab Emirates"
AF,33.93911,67.709953,Afghanistan
`),
  );

  return [csvFile];
}

/**
 * Creates RDF files in available serializations with default content.
 * @param workspaceFolder URI of the root workspace folder
 * @param conversionName Sanitized conversion name
 * @returns Record of URIs of the newly created descriptor files with default content
 */
async function createDefaultRdfFiles(
  workspaceFolder: vscode.Uri,
  conversionName: string,
): Promise<Record<RDFSerialization, vscode.Uri>> {
  const encoder = new TextEncoder();
  const tableName = 'countries';
  const rdfFiles: Record<RDFSerialization, vscode.Uri> = {
    jsonld: await getAvailableFilePath(
      vscode.Uri.joinPath(workspaceFolder, conversionName),
      `${tableName}.${fileExtensions['jsonld']}`,
    ),
    nquads: await getAvailableFilePath(
      vscode.Uri.joinPath(workspaceFolder, conversionName),
      `${tableName}.${fileExtensions['nquads']}`,
    ),
    ntriples: await getAvailableFilePath(
      vscode.Uri.joinPath(workspaceFolder, conversionName),
      `${tableName}.${fileExtensions['ntriples']}`,
    ),
    rdfxml: await getAvailableFilePath(
      vscode.Uri.joinPath(workspaceFolder, conversionName),
      `${tableName}.${fileExtensions['rdfxml']}`,
    ),
    turtle: await getAvailableFilePath(
      vscode.Uri.joinPath(workspaceFolder, conversionName),
      `${tableName}.${fileExtensions['turtle']}`,
    ),
    trig: await getAvailableFilePath(
      vscode.Uri.joinPath(workspaceFolder, conversionName),
      `${tableName}.${fileExtensions['trig']}`,
    ),
  };

  for (const serialization of Object.keys(rdfFiles) as RDFSerialization[]) {
    let content: string;
    switch (serialization) {
      case 'jsonld':
        content = `[
  {
    "@id": "http://example.org/countries.csv#AD",
    "http://www.geonames.org/ontology#countryCode": [
      {
        "@value": "AD"
      }
    ],
    "http://schema.org/latitude": [
      {
        "@value": "42.546245",
        "@type": "http://www.w3.org/2001/XMLSchema#double"
      }
    ],
    "http://schema.org/longitude": [
      {
        "@value": "1.601554",
        "@type": "http://www.w3.org/2001/XMLSchema#double"
      }
    ],
    "http://schema.org/name": [
      {
        "@value": "Andorra"
      }
    ]
  },
  {
    "@id": "http://example.org/countries.csv#AE",
    "http://www.geonames.org/ontology#countryCode": [
      {
        "@value": "AE"
      }
    ],
    "http://schema.org/latitude": [
      {
        "@value": "23.424076",
        "@type": "http://www.w3.org/2001/XMLSchema#double"
      }
    ],
    "http://schema.org/longitude": [
      {
        "@value": "53.847818",
        "@type": "http://www.w3.org/2001/XMLSchema#double"
      }
    ],
    "http://schema.org/name": [
      {
        "@value": "United Arab Emirates"
      }
    ]
  },
  {
    "@id": "http://example.org/countries.csv#AF",
    "http://www.geonames.org/ontology#countryCode": [
      {
        "@value": "AF"
      }
    ],
    "http://schema.org/latitude": [
      {
        "@value": "33.93911",
        "@type": "http://www.w3.org/2001/XMLSchema#double"
      }
    ],
    "http://schema.org/longitude": [
      {
        "@value": "67.709953",
        "@type": "http://www.w3.org/2001/XMLSchema#double"
      }
    ],
    "http://schema.org/name": [
      {
        "@value": "Afghanistan"
      }
    ]
  }
]
`;
        break;

      case 'nquads':
      case 'ntriples':
        content = `<http://example.org/countries.csv#AD> <http://www.geonames.org/ontology#countryCode> "AD" .
<http://example.org/countries.csv#AD> <http://schema.org/latitude> "42.546245"^^<http://www.w3.org/2001/XMLSchema#double> .
<http://example.org/countries.csv#AD> <http://schema.org/longitude> "1.601554"^^<http://www.w3.org/2001/XMLSchema#double> .
<http://example.org/countries.csv#AD> <http://schema.org/name> "Andorra" .
<http://example.org/countries.csv#AE> <http://www.geonames.org/ontology#countryCode> "AE" .
<http://example.org/countries.csv#AE> <http://schema.org/latitude> "23.424076"^^<http://www.w3.org/2001/XMLSchema#double> .
<http://example.org/countries.csv#AE> <http://schema.org/longitude> "53.847818"^^<http://www.w3.org/2001/XMLSchema#double> .
<http://example.org/countries.csv#AE> <http://schema.org/name> "United Arab Emirates" .
<http://example.org/countries.csv#AF> <http://www.geonames.org/ontology#countryCode> "AF" .
<http://example.org/countries.csv#AF> <http://schema.org/latitude> "33.93911"^^<http://www.w3.org/2001/XMLSchema#double> .
<http://example.org/countries.csv#AF> <http://schema.org/longitude> "67.709953"^^<http://www.w3.org/2001/XMLSchema#double> .
<http://example.org/countries.csv#AF> <http://schema.org/name> "Afghanistan" .
`;
        break;

      case 'rdfxml':
        content = `<?xml version="1.0" encoding="utf-8" ?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:schema="http://schema.org/"
         xmlns:geonames="http://www.geonames.org/ontology#">

  <rdf:Description rdf:about="http://example.org/countries.csv#AD">
    <schema:latitude rdf:datatype="http://www.w3.org/2001/XMLSchema#double">42.546245</schema:latitude>
    <schema:longitude rdf:datatype="http://www.w3.org/2001/XMLSchema#double">1.601554</schema:longitude>
    <schema:name>Andorra</schema:name>
    <geonames:countryCode>AD</geonames:countryCode>
  </rdf:Description>

  <rdf:Description rdf:about="http://example.org/countries.csv#AE">
    <schema:latitude rdf:datatype="http://www.w3.org/2001/XMLSchema#double">23.424076</schema:latitude>
    <schema:longitude rdf:datatype="http://www.w3.org/2001/XMLSchema#double">53.847818</schema:longitude>
    <schema:name>United Arab Emirates</schema:name>
    <geonames:countryCode>AE</geonames:countryCode>
  </rdf:Description>

  <rdf:Description rdf:about="http://example.org/countries.csv#AF">
    <schema:latitude rdf:datatype="http://www.w3.org/2001/XMLSchema#double">33.93911</schema:latitude>
    <schema:longitude rdf:datatype="http://www.w3.org/2001/XMLSchema#double">67.709953</schema:longitude>
    <schema:name>Afghanistan</schema:name>
    <geonames:countryCode>AF</geonames:countryCode>
  </rdf:Description>

</rdf:RDF>
`;
        break;

      case 'turtle':
      case 'trig':
        content = `@prefix geonames: <http://www.geonames.org/ontology#>.
@prefix schema: <http://schema.org/>.

<http://example.org/countries.csv#AD>
  schema:latitude "42.546245"^^<http://www.w3.org/2001/XMLSchema#double>;
  schema:longitude "1.601554"^^<http://www.w3.org/2001/XMLSchema#double>;
  schema:name "Andorra";
  geonames:countryCode "AD".

<http://example.org/countries.csv#AE>
  schema:latitude "23.424076"^^<http://www.w3.org/2001/XMLSchema#double>;
  schema:longitude "53.847818"^^<http://www.w3.org/2001/XMLSchema#double>;
  schema:name "United Arab Emirates";
  geonames:countryCode "AE".

<http://example.org/countries.csv#AF>
  schema:latitude "33.93911"^^<http://www.w3.org/2001/XMLSchema#double>;
  schema:longitude "67.709953"^^<http://www.w3.org/2001/XMLSchema#double>;
  schema:name "Afghanistan";
  geonames:countryCode "AF".
`;
        break;
    }

    await vscode.workspace.fs.writeFile(
      rdfFiles[serialization],
      encoder.encode(content),
    );
  }

  return rdfFiles;
}
