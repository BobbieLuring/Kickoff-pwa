import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Data, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './layout/header/header';
import { BottomNav } from './layout/bottom-nav/bottom-nav';
import { Install } from './install/install';
import { InstallGuide } from './install/install-guide/install-guide';
import { PlayerSession } from './player-session';
import { AdminSession } from './admin-session';

@Component({
  imports: [RouterOutlet, Header, BottomNav, InstallGuide],
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
}
