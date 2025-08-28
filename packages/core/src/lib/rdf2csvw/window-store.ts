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
   * Advances the underlying stream by {@link stepSize} quads.
   * @returns [array of quads added to store; array of quads removed from store]
   */
  public async moveWindow(): Promise<[added: Quad[], removed: Quad[]]> {
    const added: Quad[] = [];
    const removed: Quad[] = [];
    if (!this.streamInitialized) {
      throw new Error('Stream not initialized');
    }
    if (!this.queue) {
      return [added, removed];
    }
    for (let i = 0; i < (this.stepSize as number) && !this._done; i++) {
      const nextQuad = await this.streamIter.next();
      if (nextQuad.value) {
        this.queue.push(nextQuad.value);
        added.push(nextQuad.value);
        await this.store.put(nextQuad.value);
        const quad = this.queue.shift() as Quad;
        removed.push(quad);
        await this.store.del(quad);
      }
      this._done = !!nextQuad.done;
    }
    return [added, removed];
  }

  /**
   * Initializes the stream and populates the window store.
   * @returns array of quads added to store
   */
  public async initStream(): Promise<Quad[]> {
    let added: Quad[] = [];

    if (!this.queue) {
      await this.store.putStream(this.stream);
      this._done = true;
      console.log('Stream fully loaded into store');
      added = await Array.fromAsync(this.store.match());
    } else {
      const iterable =
        Symbol.asyncIterator in this.stream
          ? (this.stream as AsyncIterable<Quad>)
          : eventEmitterToAsyncIterable<Quad>(this.stream);
      this.streamIter = iterable[Symbol.asyncIterator]();

      for (let i = 0; i < (this.windowSize as number) && !this._done; i++) {
        const nextQuad = await this.streamIter.next();
        if (nextQuad.value) {
          this.queue.push(nextQuad.value);
          added.push(nextQuad.value);
          await this.store.put(nextQuad.value);
        }
        this._done = !!nextQuad.done;
      }
    }

    this.streamInitialized = true;
    return added;
  }
}
