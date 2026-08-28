import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const API_BASE = 'http://localhost:5000';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  companies?: {
    _id: string;
    name: string;
  }[];
  canDelete?: boolean;
  canEditProfile?: boolean;
  canEditTask?: boolean;
  canAccumulateTask?: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  loginSuccess = output<User>();

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected updateField(field: 'email' | 'password', value: string) {
    if (this.error()) this.error.set(null);
    if (field === 'email') this.email.set(value);
    if (field === 'password') this.password.set(value);
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();

    if (this.loading()) return;

    const emailVal = this.email().trim();
    const passwordVal = this.password();

    if (!emailVal || !passwordVal) {
      this.error.set('Por favor, ingresa tu correo y contraseña.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passwordVal })
      });

      if (!response.ok) {
        let errorMessage = 'Correo o contraseña incorrectos.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `Error del servidor (${response.status}).`;
        }
        throw new Error(errorMessage);
      }

      const user: User = await response.json();
      this.loginSuccess.emit(user);
    } catch (err) {
      this.error.set(String(err).replace('Error: ', ''));
    } finally {
      this.loading.set(false);
    }
  }
}
