import { Component, OnInit, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://tasks-2x63.onrender.com';

interface Task {
  _id: string;
  name: string;
  status: 'completada' | 'ejecutando' | 'acumulada';
  completed: boolean;
  isDeleted: boolean;
  createdAt: string;
  userId: {
    _id: string;
    name: string;
  };
}

@Component({
  selector: 'app-public-tasks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="public-container">
      <header class="public-header">
        <p class="eyebrow">Vista Pública</p>
        <h1 *ngIf="userName()">Tareas de {{ userName() }}</h1>
        <p>Lista de tareas compartida.</p>
      </header>

      <div *ngIf="loading()" class="status-bar">Cargando tareas...</div>
      <div *ngIf="error()" class="status-bar error">{{ error() }}</div>

      <div *ngIf="!loading() && !error() && tasks().length === 0" class="empty-state">
        <p>No hay tareas para mostrar.</p>
      </div>

      <div class="task-list" *ngIf="!loading() && tasks().length > 0">
        <article class="task-card" [class.completed]="task.status === 'completada'" *ngFor="let task of tasks()">
          <div class="task-details">
            <h3>{{ task.name }}</h3>
            <span class="status-badge" [ngClass]="'status-' + task.status">
              {{ task.status }}
            </span>
          </div>
        </article>
      </div>
    </div>
  `,
  styles: [`
    .public-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .public-header {
      margin-bottom: 2rem;
      text-align: center;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 0.75rem;
      color: #4f46e5;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }
    .task-list {
      display: grid;
      gap: 1rem;
    }
    .task-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .task-card.completed {
      border-left: 4px solid #22c55e;
    }
    .task-details h3 {
      margin: 0 0 0.5rem;
      font-size: 1.1rem;
    }
    .status-badge {
      font-size: 0.75rem;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: capitalize;
    }
    .status-ejecutando { background: #dcfce7; color: #166534; }
    .status-acumulada { background: #fef9c3; color: #854d0e; }
    .status-completada { background: #f1f5f9; color: #475569; }
    .status-bar {
      padding: 1rem;
      border-radius: 0.75rem;
      background: #e2e8f0;
      text-align: center;
      margin-bottom: 1rem;
    }
    .status-bar.error {
      background: #fee2e2;
      color: #b91c1c;
    }
  `]
})
export class PublicTasksComponent implements OnInit {
  protected readonly tasks = signal<Task[]>([]);
  protected readonly userName = signal<string>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (userId) {
      void this.loadPublicTasks(userId);
    } else {
      this.error.set('ID de usuario no proporcionado');
      this.loading.set(false);
    }
  }

  private async loadPublicTasks(userId: string) {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/public/${userId}`, {
        cache: 'no-cache'
      });
      
      if (!response.ok) throw new Error('No se pudieron cargar las tareas');
      
      const data = await response.json();
      this.tasks.set(data.tasks);
      this.userName.set(data.userName);
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
