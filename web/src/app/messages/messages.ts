import { inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from '../supabase';

export interface IncomingMessage {
  id: number;
  sender_id: string;
  sender_name: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
  wait_seconds?: number;
}

/** Högst två bubblor syns samtidigt; resten väntar i kön. */
const MAX_VISIBLE = 2;
const SHOW_MS = 5000;
/** Missade meddelanden: alla ska köas, så gränsen är bara ett skydd mot något orimligt. */
const TAKE_LIMIT = 50;

/** Tar emot meddelanden till spelaren och visar dem som bubblor, två åt gången. */
@Injectable({ providedIn: 'root' })
export class Messages {
  private readonly supabase = inject(Supabase).client;
  private channel: RealtimeChannel | null = null;

  private readonly queue: IncomingMessage[] = [];
  /** Id:n vi redan tagit emot, så att samma meddelande aldrig visas två gånger. */
  private readonly received = new Set<number>();

  /** Bubblorna som syns just nu. */
  readonly visible = signal<IncomingMessage[]>([]);

  /** Startar en gång, när spelaren är i ett rum. Hämtar även missade meddelanden. */
  start() {
    if (this.channel) return;
    this.take();

    // Ringklockan: policyn gör att bara mottagaren får besked om sina egna meddelanden.
    this.channel = this.supabase
      .channel('player-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'player_messages' }, () =>
        this.take(),
      )
      .subscribe();

    // Telefoner tappar anslutningen när skärmen är släckt, så hämta när appen visas igen.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.take();
    });
  }

  async send(recipientId: string, text: string): Promise<SendResult> {
    const { data, error } = await this.supabase.rpc('send_message', {
      p_recipient_id: recipientId,
      p_text: text,
    });
    if (error) return { ok: false };
    return data as SendResult;
  }

  dismiss(id: number) {
    this.visible.update((v) => v.filter((m) => m.id !== id));
    this.pump();
  }

  private async take() {
    const { data, error } = await this.supabase.rpc('messages_take', { p_limit: TAKE_LIMIT });
    if (error || !data) return;
    for (const m of data as IncomingMessage[]) {
      if (this.received.has(m.id)) continue;
      this.received.add(m.id);
      this.queue.push(m);
    }
    this.pump();
  }

  /** Flyttar meddelanden från kön till skärmen så länge det finns plats. */
  private pump() {
    while (this.visible().length < MAX_VISIBLE && this.queue.length) {
      const message = this.queue.shift()!;
      this.visible.update((v) => [...v, message]);
      setTimeout(() => this.dismiss(message.id), SHOW_MS);
    }
  }
}
