import fs from 'node:fs/promises';
jest.mock('node:fs/promises');
import { readFileOrUrl } from './read-file-or-url.js';

describe('readFileOrUrl', () => {
  const orgFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ text: () => 'Fetch output' });
  });

  afterAll(() => {
    global.fetch = orgFetch;
  });

  it('should read remote URL', async () => {
    const requests = [
      readFileOrUrl('https://example.com/remote.txt'),
      readFileOrUrl('http://example.com'),
      readFileOrUrl('http://example.com/remote?foo=bar&baz=qux#xx'),
    ];
    await Promise.all(requests);
    expect(global.fetch).toHaveBeenCalledTimes(requests.length);
    expect(fs.readFile).not.toHaveBeenCalled();
  });

  it('should read local file', async () => {
    const requests = [
      readFileOrUrl('C:/local/file.txt'),
      readFileOrUrl('./file.txt'),
      readFileOrUrl('file.txt'),
      readFileOrUrl('/file.txt'),
      readFileOrUrl('file:/C:/local/file.txt'),
      readFileOrUrl('file:C:/local/file.txt'),
      readFileOrUrl('file:///C:/local/file.txt'),
      // readFileOrUrl('file://folder/file.txt'),  // this throws on unix
      // readFileOrUrl('file:///folder/file.txt'), // this throws on windows
      // readFileOrUrl('file:/folder/file.txt'),   // this throws on windows
    ];
    await Promise.all(requests);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(fs.readFile).toHaveBeenCalledTimes(requests.length);
  });
});
