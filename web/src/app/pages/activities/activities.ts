import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RoomSections, STATUS_LABELS } from '../../room-sections';

/** Aktiviteterna under fliken Aktiviteter, i ordning. `key` är nyckeln i tabellen sections. */
const ACTIVITIES = [
  { key: 'who', title: 'Vem svarade?', path: '/aktiviteter/vem-svarade' },
  { key: 'order', title: 'Sortera', path: '/aktiviteter/sortera' },
];

@Component({
  imports: [RouterLink],
  selector: 'app-activities',
  styleUrl: './activities.scss',
  templateUrl: './activities.html',
})
export class Activities {
  private readonly sections = inject(RoomSections);

  protected readonly statusLabels = STATUS_LABELS;

  protected readonly items = computed(() =>
    ACTIVITIES.map((a) => ({ ...a, status: this.sections.status(a.key) })),
  );

  constructor() {
    this.sections.start();
  }
}