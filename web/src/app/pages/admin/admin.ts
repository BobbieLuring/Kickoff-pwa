import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminSession } from '../../admin-session';

@Component({
  imports: [],
  selector: 'app-admin',
  styleUrl: './admin.scss',
  templateUrl: './admin.html',
})
export class Admin implements OnInit {
  private readonly admin = inject(AdminSession);
  private readonly router = inject(Router);

  protected readonly email = signal('');

  async ngOnInit() {
    this.email.set((await this.admin.email()) ?? '');
  }

  protected async signOut() {
    await this.admin.signOut();
    this.router.navigateByUrl('/start');
  }
}
