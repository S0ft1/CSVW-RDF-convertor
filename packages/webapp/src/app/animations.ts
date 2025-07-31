import { animation, style, animate, query } from '@angular/animations';

export const fade = animation([
  style({
    opacity: '{{ start }}',
  }),
  animate('{{ time }}', style({ opacity: '{{ end }}' })),
]);

export const dropdownIn = animation([
  style({ height: 0, overflow: 'hidden' }),
  query(':scope > *', style({ opacity: 0 })),
  animate('0.15s ease-out', style({ height: '*' })),
  query(':scope > *', animate('0.25s ease-in-out', style({ opacity: 1 }))),
]);

export const dropdownOut = animation([
  style({ height: '*' }),
  query(':scope > *', animate('0.05s ease-in', style({ opacity: 0 }))),
  query(':scope > *', style({ opacity: 0 })),
  animate('0.05s 0.05s ease-in', style({ height: 0 })),
]);
