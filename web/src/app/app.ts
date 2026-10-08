import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './layout/header/header';
import { BottomNav } from './layout/bottom-nav/bottom-nav';
import { Install } from './install/install';
import { InstallGuide } from './install/install-guide/install-guide';
import { PlayerSession } from './player-session';
import { AdminSession } from './admin-session';
import { MessageBubbles } from './messages/message-bubbles/message-bubbles';
import { MessageCompose } from './messages/message-compose/message-compose';
import { Messages } from './messages/messages';
import { Presence } from './messages/presence';

@Component({
  imports: [RouterOutlet, Header, BottomNav, InstallGuide, MessageBubbles, MessageCompose],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly install = inject(Install);
  private readonly player = inject(PlayerSession);
  private readonly admin = inject(AdminSession);
  private readonly route = inject(ActivatedRoute);

  /** Route-data för sidan som visas. */
  private readonly data = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((): Data => {
        let r = this.route.snapshot;
        while (r.firstChild) r = r.firstChild;
        return r.data;
      }),
    ),
    { initialValue: { outsideRoom: true } as Data },
  );

  /** True on pages marked `data: { outsideRoom: true }`, e.g. the start screen. */
  protected readonly outsideRoom = computed(() => this.data()['outsideRoom'] === true);

  /**
   * Texten till höger i headern: på adminsidor admins namn ("Admin" innan inloggning),
   * i rummet spelarens namn, annars inget.
   */
  protected readonly headerText = computed(() => {
    if (this.data()['adminPage']) return this.admin.name() ?? 'Admin';
    return this.outsideRoom() ? '' : (this.player.current()?.username ?? '');
  });

  constructor() {
    // Så fort spelaren är i ett rum: onlineprickarna och meddelanden (även missade) startar.
    const presence = inject(Presence);
    const messages = inject(Messages);
    effect(() => {
      const me = this.player.current();
      if (this.outsideRoom() || !me) return;
      presence.start(me.id);
      messages.start();
    });
  }
}
