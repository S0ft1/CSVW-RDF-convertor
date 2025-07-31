import { Injectable } from '@angular/core';
import { fromEvent, map, merge, scan, share, startWith } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GlobalEventService {
  public dragEnter = fromEvent(window, 'dragenter').pipe(share());
  public dragLeave = fromEvent(window, 'dragleave').pipe(share());
  public drop = fromEvent(window, 'drop').pipe(share());
  public dragging = merge(
    this.dragLeave.pipe(map(() => -1)),
    this.dragEnter.pipe(map(() => 1)),
    this.drop.pipe(map(() => 0))
  ).pipe(
    scan((acc, val) => val && acc + val),
    map((x) => x > 0),
    startWith(false),
    share()
  );

  constructor() {}
}
