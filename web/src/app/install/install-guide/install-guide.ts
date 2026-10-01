import { Component, inject } from '@angular/core';
import { Install } from '../install';

@Component({
  selector: 'app-install-guide',
  templateUrl: './install-guide.html',
  styleUrl: './install-guide.scss',
})
export class InstallGuide {
  protected readonly install = inject(Install);
}