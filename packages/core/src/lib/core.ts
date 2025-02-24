import * as fs from 'fs';
import readline from 'readline';
import jsonld from 'jsonld';

//Class for manipulating the descriptor
export class DescriptorManipulator{
  descriptor: Map<string, string> = new Map<string, string>();

  //Reads the jsonLD descriptor and saves the keys and links as values into map
 /* public readDescriptor(pathToFile: string): void {
    
    console.log('Reading descriptor');

    const reader = readline.createInterface(fs.createReadStream(pathToFile))
    reader.on('line', (line) => {
      if(line !== '{' && line !== '}') {
        console.log(line);
        const lineSplit = line.split(':');
        const key = lineSplit[0].trim().replace(/"/g, '');
        const value = lineSplit[1].trim().replace(/"/g, '');
        this.descriptor.set(key, value);
      }
    });
    console.log(this.descriptor);
  }*/


    jsonLDTEST = `{
  "@context": ["http://www.w3.org/ns/csvw", {"@language": "en"}],
  "@id": "http://example.org/tree-ops-ext",
  "url": "tree-ops-ext.csv",
  "dc:title": "Tree Operations",
  "dcat:keyword": ["tree", "street", "maintenance"],
  "dc:publisher": [{
    "schema:name": "Example Municipality",
    "schema:url": {"@id": "http://example.org"}
  }],
  "dc:license": {"@id": "http://opendefinition.org/licenses/cc-by/"},
  "dc:modified": {"@value": "2010-12-31", "@type": "xsd:date"},
  "notes": [{
    "@type": "oa:Annotation",
    "oa:hasTarget": {"@id": "http://example.org/tree-ops-ext"},
    "oa:hasBody": {
      "@type": "oa:EmbeddedContent",
      "rdf:value": "This is a very interesting comment about the table; it's a table!",
      "dc:format": {"@value": "text/plain"}
    }
  }],
  "tableSchema": {
    "columns": [{
      "name": "GID",
      "titles": [
        "GID",
        "Generic Identifier"
      ],
      "dc:description": "An identifier for the operation on a tree.",
      "datatype": "string",
      "required": true, 
      "suppressOutput": true
    }, {
      "name": "on_street",
      "titles": "On Street",
      "dc:description": "The street that the tree is on.",
      "datatype": "string"
    }, {
      "name": "species",
      "titles": "Species",
      "dc:description": "The species of the tree.",
      "datatype": "string"
    }, {
      "name": "trim_cycle",
      "titles": "Trim Cycle",
      "dc:description": "The operation performed on the tree.",
      "datatype": "string",
      "lang": "en"
    }, {
      "name": "dbh",
      "titles": "Diameter at Breast Ht",
      "dc:description": "Diameter at Breast Height (DBH) of the tree (in feet), measured 4.5ft above ground.",
      "datatype": "integer"
    }, {
      "name": "inventory_date",
      "titles": "Inventory Date",
      "dc:description": "The date of the operation that was performed.",
      "datatype": {"base": "date", "format": "M/d/yyyy"}
    }, {
      "name": "comments",
      "titles": "Comments",
      "dc:description": "Supplementary comments relating to the operation or tree.",
      "datatype": "normalizedString",
      "separator": ";"
    }, {
      "name": "protected",
      "titles": "Protected",
      "dc:description": "Indication (YES / NO) whether the tree is subject to a protection order.",
      "datatype": {"base": "boolean", "format": "YES|NO"},
      "default": "NO"
    }, {
      "name": "kml",
      "titles": "KML",
      "dc:description": "KML-encoded description of tree location.",
      "datatype": "xml"
    }],
    "primaryKey": "GID",
    "aboutUrl": "http://example.org/tree-ops-ext#gid-{GID}"
  }
}`
 public async libraryTest(): Promise<void> {
    const parsed = JSON.parse(this.jsonLDTEST);
    const expanded = await jsonld.expand(parsed);
    const compacted = await jsonld.compact(expanded,{});
  }
}
