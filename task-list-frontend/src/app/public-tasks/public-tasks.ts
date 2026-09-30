import { Component, OnInit, OnDestroy, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

const SHOW_BACK_BUTTON_KEY = 'task-list-show-back-button';
const BACK_BUTTON_POSITION_KEY = 'task-list-back-button-position';

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
  timerMinutes?: number | null;
  timerEndsAt?: string | null;
  userId: {
    _id: string;
    name: string;
  };
}

interface CalendarEvent {
  date: string;
  title: string;
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
        <p *ngIf="nextEventLabel()" class="next-event">Próximo evento: {{ nextEventLabel() }}</p>
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
            <p class="task-created">Creada: {{ getTaskCreatedDate(task.createdAt) }}</p>
            <span class="status-badge" [ngClass]="'status-' + task.status">
              {{ task.status }}
            </span>
            <p *ngIf="task.timerEndsAt" class="task-timing">{{ getTaskTimerPeriod(task) }}</p>
            <p *ngIf="task.timerEndsAt && task.status !== 'completada'" class="task-timer" [class.expired]="getTimerLabel(task) === 'Tiempo agotado'">
              Temporizador: {{ getTimerLabel(task) }}
            </p>
          </div>
        </article>
      </div>
      <button
        *ngIf="showBackButton()"
        type="button"
        class="floating-back-button"
        [style.left.px]="backButtonPosition()?.left ?? null"
        [style.top.px]="backButtonPosition()?.top ?? null"
        [style.right]="backButtonPosition() ? 'auto' : null"
        [style.bottom]="backButtonPosition() ? 'auto' : null"
        (pointerdown)="startBackButtonDrag($event)"
        (pointermove)="moveBackButton($event)"
        (pointerup)="endBackButtonDrag($event)"
        (pointercancel)="endBackButtonDrag($event)"
        (click)="onBackButtonClick()"
        aria-label="Regresar a la pantalla anterior"
        title="Regresar">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  `,
  styles: [`
    .public-container {
      max-width: 800px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .floating-back-button {
      position: fixed;
      right: 1rem;
      bottom: 1rem;
      z-index: 10;
      display: grid;
      width: 52px;
      height: 52px;
      padding: 0;
      place-items: center;
      border: 1px solid rgba(79, 70, 229, 0.4);
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.28);
      color: #3730a3;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.16);
      opacity: 0.42;
      cursor: grab;
      touch-action: none;
      backdrop-filter: blur(5px);
    }
    .floating-back-button:hover {
      opacity: 0.82;
    }
    .floating-back-button:active {
      cursor: grabbing;
    }
    .floating-back-button svg {
      width: 27px;
      height: 27px;
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
    .next-event {
      display: inline-block;
      margin: 0.75rem 0 0;
      padding: 0.55rem 0.8rem;
      border-radius: 0.6rem;
      background: #eef2ff;
      color: #3730a3;
      font-weight: 700;
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
    .task-created,
    .task-timing {
      margin: 0.2rem 0 0;
      color: #64748b;
      font-size: 0.7rem;
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
  protected readonly nextEventLabel = signal('');
  protected readonly showBackButton = signal(true);
  protected readonly backButtonPosition = signal<{ left: number; top: number } | null>(null);
  private backButtonDragStart: { pointerId: number; pointerX: number; pointerY: number; left: number; top: number } | null = null;
  private backButtonWasDragged = false;
  private timerTick = signal(Date.now());
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.showBackButton.set(localStorage.getItem(SHOW_BACK_BUTTON_KEY) !== 'false');
      try {
        const savedPosition = JSON.parse(localStorage.getItem(BACK_BUTTON_POSITION_KEY) ?? 'null') as { left?: number; top?: number } | null;
        if (savedPosition && Number.isFinite(savedPosition.left) && Number.isFinite(savedPosition.top)) {
          this.backButtonPosition.set({
            left: Math.max(0, Math.min(savedPosition.left!, window.innerWidth - 52)),
            top: Math.max(0, Math.min(savedPosition.top!, window.innerHeight - 52))
          });
        }
      } catch {
        this.backButtonPosition.set(null);
      }
      this.timerIntervalId = setInterval(() => this.timerTick.set(Date.now()), 1000);
      this.loadNextCalendarEvent();
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

  protected goBack() {
    if (typeof window === 'undefined') return;
    const referrer = document.referrer;
    if (referrer && new URL(referrer).origin === window.location.origin) {
      window.history.back();
    } else {
      window.location.assign('/');
    }
  }

  protected onBackButtonClick() {
    if (this.backButtonWasDragged) {
      this.backButtonWasDragged = false;
      return;
    }
    this.goBack();
  }

  protected startBackButtonDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    const button = event.currentTarget as HTMLButtonElement;
    const rect = button.getBoundingClientRect();
    this.backButtonDragStart = {
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      left: rect.left,
      top: rect.top
    };
    this.backButtonWasDragged = false;
    button.setPointerCapture(event.pointerId);
  }

  protected moveBackButton(event: PointerEvent) {
    const start = this.backButtonDragStart;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - start.pointerX;
    const deltaY = event.clientY - start.pointerY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) this.backButtonWasDragged = true;
    if (!this.backButtonWasDragged) return;

    const left = Math.max(0, Math.min(start.left + deltaX, window.innerWidth - 52));
    const top = Math.max(0, Math.min(start.top + deltaY, window.innerHeight - 52));
    const position = { left, top };
    this.backButtonPosition.set(position);
    localStorage.setItem(BACK_BUTTON_POSITION_KEY, JSON.stringify(position));
  }

  protected endBackButtonDrag(event: PointerEvent) {
    if (this.backButtonDragStart?.pointerId === event.pointerId) {
      this.backButtonDragStart = null;
    }
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

  protected getTaskCreatedDate(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    return this.formatTaskDate(date);
  }

  protected getTaskTimerPeriod(task: Task): string {
    if (!task.timerEndsAt) return '';
    const end = new Date(task.timerEndsAt);
    const start = new Date(end.getTime() - (task.timerMinutes ?? 0) * 60 * 1000);
    const format = (date: Date) => `${this.formatTaskDate(date)} ${new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)}`;
    return `Inicio: ${format(start)} · Fin: ${format(end)}`;
  }

  private formatTaskDate(date: Date): string {
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${String(date.getDate()).padStart(2, '0')}_${months[date.getMonth()]}_${date.getFullYear()}`;
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

  private loadNextCalendarEvent() {
    if (!isPlatformBrowser(this.platformId)) return;
    const storedEvents = localStorage.getItem('task-list-calendar-events');
    if (!storedEvents) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const nextEvent = (JSON.parse(storedEvents) as CalendarEvent[])
        .filter(event => event.date >= today)
        .sort((first, second) => first.date.localeCompare(second.date))[0];
      if (!nextEvent) return;
      const eventDate = new Date(`${nextEvent.date}T00:00:00`).toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      });
      this.nextEventLabel.set(`${eventDate}: ${nextEvent.title}`);
    } catch {
      this.nextEventLabel.set('');
    }
  }
}
