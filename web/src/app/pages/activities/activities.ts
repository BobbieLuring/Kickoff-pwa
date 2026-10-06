import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SOON_TEXTS, STOPS } from '../../itinerary';
import { RoomSections } from '../../room-sections';

/** Fliken Aktiviteter: resplanen med alla stopp och deras status. */
@Component({
  imports: [RouterLink],
  selector: 'app-activities',
  styleUrl: './activities.scss',
  templateUrl: './activities.html',
})
export class Activities {
  private readonly sections = inject(RoomSections);

  /** Blandas en gång när sidan öppnas, så att texterna är slumpade men inte byts medan man tittar. */
  private readonly soonTexts = shuffle(SOON_TEXTS);

  protected readonly stops = computed(() =>
    STOPS.map((stop, i) => {
      const status = this.sections.combinedStatus(stop.keys);
      const text =
        status === 'open'
          ? stop.openText
          : status === 'closed'
            ? 'Avklarat'
            : this.soonTexts[i % this.soonTexts.length];
      return { ...stop, status, text };
    }),
  );

  constructor() {
    this.sections.start();
  }
}

/** En blandad kopia av listan (Fisher–Yates), så att två stopp inte får samma text. */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
