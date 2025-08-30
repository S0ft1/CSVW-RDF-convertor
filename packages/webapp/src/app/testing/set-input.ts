import { InputSignal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';

export type RecursivePartial<T> = {
  [K in keyof T]?: T[K] extends object ? RecursivePartial<T[K]> : T[K];
};

type SignalInputsOf<Comp> = {
  [K in keyof Comp]: Comp[K] extends InputSignal<infer Val> ? Val : never;
};

/**
 * Sets the input value of a component fixture.
 * @param fixture The component fixture.
 * @param key The key of the input to set.
 * @param value The value to set the input to.
 */
export function setInput<
  Component,
  Key extends Extract<keyof SignalInputsOf<Component>, string>,
>(
  fixture: ComponentFixture<Component>,
  key: Key,
  value: RecursivePartial<SignalInputsOf<Component>[Key]>,
) {
  fixture.componentRef.setInput(key, value);
}
