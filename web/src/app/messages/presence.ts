import { inject, Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from '../supabase';

/**
 * Vilka spelare som har appen öppen just nu (Supabase Realtime Presence).
 * Går på samma anslutning som topplistans ringklocka, så det kostar ingen extra anslutning.
 */
@Injectable({ providedIn: 'root' })
export class Presence {
  private readonly supabase = inject(Supabase).client;
  private channel: RealtimeChannel | null = null;

  /** Spelar-id för alla som är online i rummet. */
  readonly online = signal<ReadonlySet<string>>(new Set());

  /** Startar en gång, när spelaren är i ett rum. */
  async start(myPlayerId: string) {
    if (this.channel) return;
    const { data: roomId } = await this.supabase.rpc('my_presence_key');
    if (!roomId || this.channel) return;

    const channel = this.supabase.channel(`presence:${roomId}`, {
      config: { presence: { key: myPlayerId } },
    });
    this.channel = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        this.online.set(new Set(Object.keys(channel.presenceState())));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && document.visibilityState === 'visible') channel.track({});
      });

    // "Online" betyder att appen syns på skärmen, inte bara att den ligger i bakgrunden.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') channel.track({});
      else channel.untrack();
    });
  }
}
