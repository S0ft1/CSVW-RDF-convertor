
import { Rdf2CsvOptions } from "./conversion-options.js";
import { Stream } from '@rdfjs/types';
import { AnyCsvwDescriptor } from "./types/descriptor/descriptor.js";
import { IssueTracker } from "./utils/issue-tracker.js";
import { Quadstore, StoreOpts } from 'quadstore';
import { BlankNode, DataFactory, Literal, NamedNode, StreamParser } from 'n3';
import { MemoryLevel } from 'memory-level';
import { Readable } from 'stream';
import { DescriptorWrapper } from "./descriptor.js";
import { CsvwTable } from "./types/csvwTable.js";
import { CsvwTableDescription } from "./types/descriptor/table.js";

//const { namedNode, blankNode, literal, defaultGraph, quad } = DataFactory;


export class Rdf2CsvwConvertor {
    private options: Required<Rdf2CsvOptions>;
    public issueTracker: IssueTracker;
    private store: Quadstore;

    public constructor(options?: Rdf2CsvOptions) {
        this.options = this.setDefaults(options);
        //this.store = {} as Quadstore;
    }

    /**
     * Main conversion function. Converts the rdf data to csvw format.
     * @param data Input rdf data to convert
     * @param descriptor CSVW descriptor to use for the conversion. If not provided, a new descriptor will be created from the rdf data.
     * @returns A stream of csvw data.
     */
    public async convert(data: string, descriptor?: DescriptorWrapper): Promise<Stream> {
        if (!descriptor) {
            descriptor = this.createDescriptor(data);
        }
        await this.openStore();
        //Now we have a descriptor either from user or from rdf data.
        const reader = Readable.from(data);
        const parser = new StreamParser({ format: 'text/turtle' });
        await this.store.putStream(reader.pipe(parser), { batchSize: 100 });
        let tables = descriptor.isTableGroup ?  descriptor.getTables() : [descriptor.descriptor] as CsvwTableDescription[];
        let  csvwTables = [] as CsvwTable[];
        for (const table of tables) {
           // csvwTables.push(new CsvwTable(table, descriptor.tableGroup, descriptor.descriptor.dialect, descriptor.schema, descriptor.notes));
        }
        /*
        
        const stream = await this.store.match();    
        stream.on('data', (quad) => {
            console.log(`Subject: ${quad.subject.value}, Predicate: ${quad.predicate.value}, Object: ${quad.object.value}`);
        });
        stream.on('end', () => {
            console.log('All triples have been printed.');
        });
        */
        
        this.store.close();
        return {} as Stream; //This is a placeholder. The actual conversion logic will go here.
    }

    /**
    * Creates a new descriptor from the rdf data, used only if no descriptor is provided.
    * @param rdfData The rdf data to create the descriptor from
    */
    private createDescriptor(rdfData: string): DescriptorWrapper {
        return {} as DescriptorWrapper;
    }

    /**
     * Sets the default options for the options not provided.
     * @param options 
     */
    private setDefaults(options?: Rdf2CsvOptions): Required<Rdf2CsvOptions> {
        options ??= {};
        return {
            descriptorNotProvided: options.descriptorNotProvided ?? false
        };
    }


    private async openStore() {
        const backend = new MemoryLevel() as any;
        // different versions of RDF.js types in quadstore and n3
        this.store = new Quadstore({
            backend,
            dataFactory: DataFactory as unknown as StoreOpts['dataFactory'],
        });
        await this.store.open();
    }

}