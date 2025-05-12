import { Rdf2CsvwConvertor } from './lib/rdf2csvw-convertor.js';

export * from './lib/descriptor.js';
export * from './lib/conversion-options.js';
export * from './lib/req-resolve.js';
export * from './lib/csvw2rdf-convertor.js';
export * from './lib/rdf2csvw-convertor.js';
export * from './lib/types/rdf-serialization.js';
export * from './lib/utils/prefix.js';

let x : Rdf2CsvwConvertor = new Rdf2CsvwConvertor();
let y = x.convert(`@prefix : <tree-ops.csv#> .
@prefix csvw: <http://www.w3.org/ns/csvw#> .
@prefix dc: <http://purl.org/dc/terms/> .
@prefix dcat: <http://www.w3.org/ns/dcat#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix schema: <http://schema.org/> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

:gid-1 :GID "1";
   :inventory_date "2010-10-18"^^xsd:date;
   :on_street "1234.5678";
   :species "Celtis australis";
   :trim_cycle "Large Tree Routine Prune" .

:gid-2 :GID "2";
   :inventory_date "2010-06-02"^^xsd:date;
   :on_street "1234.567";
   :species "Liquidambar styraciflua";
   :trim_cycle "Large Tree Routine Prune" .

 [
    a csvw:TableGroup;
    csvw:table [
      a csvw:Table;
      dc:title "Tree Operations"@en;
      dcat:keyword "tree"@en,
        "street"@en,
        "maintenance"@en;
      dc:license <http://opendefinition.org/licenses/cc-by/>;
      dc:modified "2010-12-31"^^xsd:date;
      dc:publisher [
        schema:name "Example Municipality"@en;
        schema:url <http://example.org>
      ];
      csvw:row [
        a csvw:Row;
        csvw:describes :gid-1;
        csvw:rownum 1;
        csvw:url <tree-ops.csv#row=2>
      ],  [
        a csvw:Row;
        csvw:describes :gid-2;
        csvw:rownum 2;
        csvw:url <tree-ops.csv#row=3>
      ];
      csvw:url <tree-ops.csv>
    ]
 ] .`,{
    "@context": ["http://www.w3.org/ns/csvw", {"@language": "en"}],
    "url": "tree-ops.csv",
    "dc:title": "Tree Operations",
    "dcat:keyword": ["tree", "street", "maintenance"],
    "dc:publisher": {
      "schema:name": "Example Municipality",
      "schema:url": {"@id": "http://example.org"}
    },
    "dc:license": {"@id": "http://opendefinition.org/licenses/cc-by/"},
    "dc:modified": {"@value": "2010-12-31", "@type": "xsd:date"},
    "tableSchema": {
      "columns": [{
        "name": "GID",
        "titles": ["GID", "Generic Identifier"],
        "dc:description": "An identifier for the operation on a tree.",
        "datatype": "string",
        "required": true
      }, {
        "name": "on_street",
        "titles": "On Street",
        "dc:description": "The street that the tree is on.",
        "datatype": {
            "base": "decimal",
            "format": {
                "pattern": "#,##0.00",
                "groupChar": " ",
                "decimalChar": ","
            },
            }
      }, {
        "name": "species",
        "titles": "Species",
        "dc:description": "The species of the tree.",
        "datatype": "string"
      }, {
        "name": "trim_cycle",
        "titles": "Trim Cycle",
        "dc:description": "The operation performed on the tree.",
        "datatype": "string"
      }, {
        "name": "inventory_date",
        "titles": "Inventory Date",
        "dc:description": "The date of the operation that was performed.",
        "datatype": {"base": "date", "format": "M/d/yyyy"}
      }],
      "primaryKey": "GID",
      "aboutUrl": "#gid-{GID}"
    }
  })