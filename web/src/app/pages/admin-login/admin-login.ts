import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminSession } from '../../admin-session';

@Component({
  imports: [FormsModule, RouterLink],
  selector: 'app-admin-login',
  styleUrl: './admin-login.scss',
  templateUrl: './admin-login.html',
})
export class AdminLogin {
  private readonly admin = inject(AdminSession);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const error = await this.admin.signIn(this.email().trim(), this.password());
      if (error) {
        this.error.set(error);
      } else {
        this.router.navigateByUrl('/admin');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
