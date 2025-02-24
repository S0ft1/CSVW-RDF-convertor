import { RDFSerialization } from './types/rdf-serialization.js';

export class CSVW2RDFConvertor {
  config?: unknown;
  pathOverrides?: Record<string, string>;
  offline?: boolean;

  public constructor(
    config?: unknown,
    pathOverrides?: Record<string, string>,
    offline?: boolean
  ) {
    this.config = config;
    this.pathOverrides = pathOverrides;
    this.offline = offline;
  }

  public async convert(
    input?: string,
    output?: string,
    format?: RDFSerialization
  ) {
    const uri = await this.getUri('foaf');
    console.log(`foaf -> ${uri}`);
    const prefix = await this.getPrefix('http://xmlns.com/foaf/0.1/');
    console.log(`http://xmlns.com/foaf/0.1/ -> ${prefix}`);

    throw new Error('Not implemented.');
  }

  private getUri(prefix: string): Promise<string | null> {
    return (
      fetch(`https://prefix.cc/${prefix}.file.json`)
        .then((response) => response.json() as Promise<PrefixCCResponse>)
        .then((data) => data[prefix])
        // Prefix not found, or prefix.cc does not respond
        .catch(() => null)
    );
  }

  private getPrefix(uri: string): Promise<string | null> {
    return (
      fetch(`https://prefix.cc/reverse?uri=${uri}&format=json`)
        .then((response) => response.json() as Promise<PrefixCCResponse>)
        .then((data) => Object.keys(data)[0])
        // No registered prefix for the given URI, or prefix.cc does not respond
        .catch(() => null)
    );
  }
}

interface PrefixCCResponse {
  [key: string]: string;
}
