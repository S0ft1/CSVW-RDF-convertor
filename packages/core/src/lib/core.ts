import jsonld from 'jsonld';
import {CompactedExpandedCsvwDescriptor} from "./descriptor/descriptor.js";
import { CsvwTableDescription } from './descriptor/table.js';

//Class for manipulating the descriptor
export class DescriptorBuilder{
  public _descriptor : CompactedExpandedCsvwDescriptor;
  //TODO: pridat navratovej typ kterej snese table grupy nebo jednotlivy tably
  
  public getTableSchema():void {
    if(this._descriptor['http://www.w3.org/ns/csvw#tables'] === undefined){
      console.log(this._descriptor['http://www.w3.org/ns/csvw#tableSchema']);
    }
    else{
      const arr = this._descriptor['http://www.w3.org/ns/csvw#tables'] as CsvwTableDescription[];
      arr.forEach(element => {
        console.log(this._descriptor['http://www.w3.org/ns/csvw#tableSchema']);
      });
    }
  }

  /*public getTableMetadata(): Record<string, unknown>{
  }*/

  public async BuildDescriptor(descriptor : string | Record<string, unknown>): Promise<void> {
    let parsedDescriptor : Record<string, unknown>;
    if(typeof descriptor === 'string'){
      parsedDescriptor = JSON.parse(descriptor);
    }
    else{
      parsedDescriptor = descriptor;
    }
    const expanded = await jsonld.expand(parsedDescriptor);
    this._descriptor = await jsonld.compact(expanded,{}) as CompactedExpandedCsvwDescriptor;
  }
}
