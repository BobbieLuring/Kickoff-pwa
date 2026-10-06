import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SortList } from '../../layout/sort-list/sort-list';
import { Supabase } from '../../supabase';

type RoundPhase = 'closed' | 'open' | 'finished';

interface OrderItem {
  id: string;
  label: string;
}

interface CorrectItem extends OrderItem {
  value: string;
}

interface OrderRound {
  id: string;
  title: string;
  phase: RoundPhase;
  items?: OrderItem[];
  my_order?: string[] | null;
  correct?: CorrectItem[];
  correct_pairs?: number;
  points?: number;
}

const ERRORS: Record<string, string> = {
  not_open: 'Rundan är stängd nu.',
  invalid_order: 'Något stämmer inte med ordningen. Ladda om sidan.',
};

@Component({
  imports: [RouterLink, SortList],
  selector: 'app-order',
  styleUrl: './order.scss',
  templateUrl: './order.html',
})
export class Order implements OnInit {
  private readonly supabase = inject(Supabase).client;

  protected readonly rounds = signal<OrderRound[]>([]);
  /** Spelarens ordning per runda. Skrivs inte över när sidan laddas om. */
  protected readonly drafts = signal<Record<string, OrderItem[]>>({});
  /** Rundor där spelaren valt att ändra en redan skickad ordning. */
  protected readonly editing = signal<Record<string, boolean>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    // Kolla var 5:e sekund så att vyn byts när värden öppnar eller stänger en runda.
    const timer = setInterval(() => {
      if (this.rounds().some((r) => r.phase !== 'finished')) this.load();
    }, 5000);
    const onVisible = () => document.visibilityState === 'visible' && this.load();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  ngOnInit() {
    this.load();
  }

  protected setDraft(roundId: string, items: OrderItem[]) {
    this.drafts.update((d) => ({ ...d, [roundId]: items }));
  }

  protected edit(roundId: string) {
    this.editing.update((e) => ({ ...e, [roundId]: true }));
  }

  /** Spelarens plats för ett namn i en avslutad runda, eller null om hen inte skickade. */
  protected myPosition(round: OrderRound, itemId: string): number | null {
    const index = round.my_order?.indexOf(itemId) ?? -1;
    return index >= 0 ? index + 1 : null;
  }

  protected async submit(round: OrderRound) {
    const draft = this.drafts()[round.id];
    if (!draft) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const { data, error } = await this.supabase.rpc('order_submit', {
        p_round_id: round.id,
        p_item_ids: draft.map((i) => i.id),
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string };
      if (result.ok) {
        this.editing.update((e) => ({ ...e, [round.id]: false }));
      } else {
        this.error.set(ERRORS[result.error ?? ''] ?? 'Något gick fel.');
      }
    } catch {
      this.error.set('Något gick fel. Försök igen.');
    } finally {
      await this.load();
      this.busy.set(false);
    }
  }

  private async load() {
    const { data, error } = await this.supabase.rpc('order_state');
    if (error) {
      this.error.set('Kunde inte hämta rundorna.');
      return;
    }
    const rounds = (data as { rounds: OrderRound[] }).rounds;

    // Starta med den skickade ordningen, annars den blandade. Rör aldrig en befintlig draft.
    this.drafts.update((d) => {
      const next = { ...d };
      for (const r of rounds) {
        if (r.phase !== 'open' || next[r.id] || !r.items) continue;
        const items = r.items;
        next[r.id] = r.my_order
          ? r.my_order.map((id) => items.find((i) => i.id === id)!).filter(Boolean)
          : items;
      }
      return next;
    });

    this.rounds.set(rounds);
  }
}