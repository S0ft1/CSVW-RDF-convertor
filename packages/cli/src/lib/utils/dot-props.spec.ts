import { dotProps } from './dot-props.js';

describe('dotProps', () => {
  it('should convert dot notation properties to nested objects', () => {
    const actual = {
      a: 1,
      'b.c': 2,
      'b.d.e': 3,
      'f.g.h.i': 4,
    };
    dotProps(actual);
    expect(actual).toEqual({
      a: 1,
      b: {
        c: 2,
        d: {
          e: 3,
        },
      },
      f: {
        g: {
          h: {
            i: 4,
          },
        },
      },
    });
  });
});
