
import { Rdf2CsvOptions } from "./conversion-options.js";
import { Stream } from '@rdfjs/types';
import { AnyCsvwDescriptor } from "./types/descriptor/descriptor.js";
import { IssueTracker } from "./utils/issue-tracker.js";

export class Rdf2CsvwConvertor {
    private options: Required<Rdf2CsvOptions>;
    public issueTracker: IssueTracker;

    public constructor(options?: Rdf2CsvOptions) {
        this.options = this.setDefaults(options);
    }

    /**
     * Main conversion function. Converts the rdf data to csvw format.
     * @param data Input rdf data to convert
     * @param descriptor CSVW descriptor to use for the conversion. If not provided, a new descriptor will be created from the rdf data.
     * @returns A stream of csvw data.
     */
    public async convert(data: string, descriptor?: string | AnyCsvwDescriptor): Promise<Stream> {
        if (!descriptor) {
            descriptor = this.createDescriptor(data);
        }
        //Now we have a descriptor either from user or from rdf data.
        return {} as Stream; //This is a placeholder. The actual conversion logic will go here.
    }

    /**
    * Creates a new descriptor from the rdf data, used only if no descriptor is provided.
    * @param rdfData The rdf data to create the descriptor from
    */
    private createDescriptor(rdfData: string): AnyCsvwDescriptor {
        return {} as AnyCsvwDescriptor; 
    }

    /**
     * Sets the default options for the options not provided.
     * @param options 
     */
    private setDefaults(options?: Rdf2CsvOptions): Required<Rdf2CsvOptions> {
        return {};
    }

}
