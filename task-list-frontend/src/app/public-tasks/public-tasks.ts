import { Component, OnInit, OnDestroy, signal, Inject, PLATFORM_ID } from '@angular/core';
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
  timerEndsAt?: string | null;
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
            <p *ngIf="task.timerEndsAt && task.status !== 'completada'" class="task-timer" [class.expired]="getTimerLabel(task) === 'Tiempo agotado'">
              Temporizador: {{ getTimerLabel(task) }}
            </p>
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
    .task-timer {
      display: inline-flex;
      margin: 0.75rem 0 0;
      padding: 0.35rem 0.6rem;
      border-radius: 0.5rem;
      background: #ecfdf5;
      color: #047857;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .task-timer.expired { background: #fef2f2; color: #b91c1c; }
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
export class PublicTasksComponent implements OnInit, OnDestroy {
  protected readonly tasks = signal<Task[]>([]);
  protected readonly userName = signal<string>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private timerTick = signal(Date.now());
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.timerIntervalId = setInterval(() => this.timerTick.set(Date.now()), 1000);
    }
    const userId = this.route.snapshot.paramMap.get('userId');
    if (userId) {
      void this.loadPublicTasks(userId);
    } else {
      this.error.set('ID de usuario no proporcionado');
      this.loading.set(false);
    }
  }

  ngOnDestroy() {
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
  }

  protected getTimerLabel(task: Task): string {
    this.timerTick();
    if (!task.timerEndsAt) return '';
    const remainingMs = new Date(task.timerEndsAt).getTime() - Date.now();
    if (remainingMs <= 0) return 'Tiempo agotado';
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`
      : `${minutes}m ${String(seconds).padStart(2, '0')}s`;
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
