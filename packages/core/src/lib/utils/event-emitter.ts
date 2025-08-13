import { type EventEmitter } from 'node:events';

/**
 * Converts an event emitter to an async iterable.
 * @param emitter The event emitter to convert
 * @param dataEvent The name of the event that emits data (default: 'data')
 * @param endEvent The name of the event that signals completion (default: 'end')
 * @param errorEvent The name of the event that signals an error (default: 'error')
 * @returns An async iterable that yields data from the event emitter
 */
export async function* eventEmitterToAsyncIterable<T>(
  emitter: EventEmitter,
  dataEvent: string | string[] = 'data',
  endEvent = 'end',
  errorEvent = 'error',
): AsyncIterable<T> {
  const dataQueue: T[] = [];
  let isEnded = false;
  let error: Error | null = null;
  let resolveNext: ((value: IteratorResult<T>) => void) | null = null;

  // Set up event listeners
  const onData = (data: T) => {
    if (resolveNext) {
      resolveNext({ value: data, done: false });
      resolveNext = null;
    } else {
      dataQueue.push(data);
    }
  };

  const onEnd = () => {
    isEnded = true;
    if (resolveNext) {
      resolveNext({ value: undefined, done: true });
      resolveNext = null;
    }
  };

  const onError = (err: Error) => {
    error = err;
    if (resolveNext) {
      resolveNext({ value: undefined, done: true });
      resolveNext = null;
    }
  };

  dataEvent = Array.isArray(dataEvent) ? dataEvent : [dataEvent];
  for (const event of dataEvent) {
    emitter.on(event, onData);
  }
  emitter.on(endEvent, onEnd);
  emitter.on(errorEvent, onError);

  try {
    while (!isEnded && !error) {
      if (dataQueue.length > 0) {
        const data = dataQueue.shift();
        if (data !== undefined) {
          yield data;
        }
      } else {
        const result = await new Promise<IteratorResult<T>>((resolve) => {
          resolveNext = resolve;
        });

        if (error) {
          throw error;
        }

        if (result.done) {
          break;
        }

        yield result.value;
      }
    }

    if (error) {
      throw error;
    }
  } finally {
    // Clean up event listeners
    for (const event of dataEvent) {
      emitter.off(event, onData);
    }
    emitter.off(endEvent, onEnd);
    emitter.off(errorEvent, onError);
  }
}
