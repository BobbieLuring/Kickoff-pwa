import { NgTemplateOutlet } from '@angular/common';
import { Component, contentChild, model, TemplateRef } from '@angular/core';

/**
 * En lista som sorteras med ↑/↓ på varje rad. Sidan som använder den bestämmer
 * hur raden ser ut med en <ng-template let-item>, t.ex. bara ett namn eller inmatningsfält.
 */
@Component({
  selector: 'app-sort-list',
  imports: [NgTemplateOutlet],
  templateUrl: './sort-list.html',
  styleUrl: './sort-list.scss',
})
export class SortList<T> {
  /** Raderna i nuvarande ordning. Uppdateras när någon flyttar en rad. */
  readonly items = model.required<T[]>();

  protected readonly row = contentChild.required(TemplateRef<{ $implicit: T; index: number }>);

  protected move(index: number, delta: number) {
    const target = index + delta;
    const next = [...this.items()];
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    this.items.set(next);
  }
}