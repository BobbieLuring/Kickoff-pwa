import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Supabase } from './supabase';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly supabase = inject(Supabase);
  protected readonly status = signal('Laddar…');

  constructor() {
    this.supabase.client
      .from('ping')
      .select('message')
      .eq('id', 1)
      .single()
      .then(({ data, error }) => this.status.set(error ? `Fel: ${error.message}` : data.message));
  }
}