import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Header } from './layout/header/header';
import { BottomNav } from './layout/bottom-nav/bottom-nav';
import { Install } from './install/install';
import { InstallGuide } from './install/install-guide/install-guide';

@Component({
  imports: [RouterOutlet, Header, BottomNav, InstallGuide],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly install = inject(Install);
  private readonly route = inject(ActivatedRoute);

  /** True on pages marked `data: { outsideRoom: true }`, e.g. the start screen. */
  protected readonly outsideRoom = toSignal(
    inject(Router).events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => {
        let r = this.route.snapshot;
        while (r.firstChild) r = r.firstChild;
        return r.data['outsideRoom'] === true;
      }),
    ),
    { initialValue: true },
  );
}
