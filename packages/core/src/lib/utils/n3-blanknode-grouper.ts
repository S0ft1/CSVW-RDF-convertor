import { Quad, Stream } from '@rdfjs/types';
import { Readable } from 'readable-stream';

export class N3BlankNodeGrouper extends Readable {
  constructor(private input: Stream<Quad>) {
    super({ objectMode: true });
  }
}
