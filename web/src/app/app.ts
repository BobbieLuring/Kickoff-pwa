import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header/header';
import { BottomNav } from './layout/bottom-nav/bottom-nav';

@Component({
  imports: [RouterOutlet, Header, BottomNav],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {}