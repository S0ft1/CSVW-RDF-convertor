import { Quad, Stream } from '@rdfjs/types';
import { CircularBuffer } from 'mnemonist';
import { Quadstore } from 'quadstore';
import { eventEmitterToAsyncIterable } from '../utils/event-emitter.js';

/**
 * RDF store wrapper with a possibly set size for processing RDF streams.
 */
export class WindowStore {
  private queue: CircularBuffer<Quad>;
  private streamInitialized = false;
  private streamIter: AsyncIterator<Quad>;
  public get done(): boolean {
    return this._done;
  }
  private _done = false;

  constructor(
    public store: Quadstore,
    private stream: Stream<Quad>,
    public windowSize?: number,
    public stepSize = windowSize && Math.max(Math.floor(windowSize / 10), 1),
  ) {
    if (windowSize !== undefined && windowSize !== null) {
      this.queue = new CircularBuffer<Quad>(Array, windowSize);
    }
  }

  /**
   * Advances the underlying stream.
   */
  public async moveWindow(): Promise<Quad[]> {
    const results: Quad[] = [];
    if (!this.streamInitialized) {
      throw new Error('Stream not initialized');
    }
    if (!this.queue) {
      return results;
    }
    for (let i = 0; i < (this.stepSize as number) && !this._done; i++) {
      const nextQuad = await this.streamIter.next();
      if (nextQuad.value) {
        this.queue.push(nextQuad.value);
        results.push(nextQuad.value);
        await this.store.put(nextQuad.value);
        const quad = this.queue.shift() as Quad;
        await this.store.del(quad);
      }
      this._done = !!nextQuad.done;
    }
    return results;
  }

  /**
   * Initializes the stream and populates the window store.
   */
  public async initStream() {
    if (!this.queue) {
      await this.store.putStream(this.stream);
      this._done = true;
    } else {
      const iterable =
        Symbol.asyncIterator in this.stream
          ? (this.stream as AsyncIterable<Quad>)
          : eventEmitterToAsyncIterable<Quad>(this.stream);
      this.streamIter = iterable[Symbol.asyncIterator]();
    }
    this.streamInitialized = true;
  }
}
