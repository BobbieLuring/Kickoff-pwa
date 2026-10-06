import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GAMES } from '../../games/games';
import { RoomSections, STATUS_LABELS } from '../../room-sections';

/** Spel-fliken: listan med spelen. */
@Component({
  imports: [RouterLink],
  selector: 'app-game',
  styleUrl: './game.scss',
  templateUrl: './game.html',
})
export class Game {
  private readonly sections = inject(RoomSections);

  protected readonly statusLabels = STATUS_LABELS;

  protected readonly items = computed(() =>
    GAMES.map((g) => ({ ...g, status: this.sections.status(g.key) })),
  );

  constructor() {
    this.sections.start();
  }
}