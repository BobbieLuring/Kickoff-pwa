import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
}