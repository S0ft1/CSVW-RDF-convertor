import { allUris } from './all-uris.js';

describe('allUris', () => {
  it('should find all URIs in a descriptor object', () => {
    const descriptor = {
      name: 'example',
      url: 'https://example.com',
      nested: {
        uri: 'https://nested.example.com',
        array: [
          'https://array.example.com',
          { anotherUri: 'https://another.example.com' },
        ],
      },
    };

    const result = allUris(descriptor);
    expect(result).toEqual(
      new Set([
        'https://example.com',
        'https://nested.example.com',
        'https://array.example.com',
        'https://another.example.com',
      ])
    );
  });

  it('should handle empty objects and arrays', () => {
    const descriptor = {
      emptyObject: {},
      emptyArray: [],
    };

    const result = allUris(descriptor);
    expect(result).toEqual(new Set());
  });

  it('should handle strings that are not URIs', () => {
    const descriptor = {
      name: 'example',
      notAUri: 'just-a-string',
    };

    const result = allUris(descriptor);
    expect(result).toEqual(new Set());
  });
});
