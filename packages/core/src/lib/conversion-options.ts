export interface Csvw2RdfOptions {
  pathOverrides: [string, string][]; // [oldPath, newPath]
  offline: boolean;
}

export const optionsNs = 'https://github.com/S0ft1/CSSW-RDF-convertor' as const;