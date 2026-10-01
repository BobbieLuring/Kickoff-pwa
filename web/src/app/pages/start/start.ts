import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  imports: [FormsModule],
  selector: 'app-start',
  styleUrl: './start.scss',
  templateUrl: './start.html',
})
export class Start {
  protected readonly code = signal('');
}
