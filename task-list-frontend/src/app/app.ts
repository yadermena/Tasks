import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const API_BASE = 'http://127.0.0.1:5000'; // apuntar al backend (puerto 5000)

type TaskStatus = 'completada' | 'ejecutando' | 'acumulada' | 'anulado';

interface Task {
  _id: string;
  name: string;
  status: TaskStatus;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  isDeleted: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('MIS TAREAS');
  protected readonly tasks = signal<Task[]>([]);
  protected readonly query = signal('');
  protected readonly inputValue = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly filterMode = signal<'all' | 'completada' | 'ejecutando' | 'acumulada'>('all');
  protected readonly showFilterWindow = signal(true);
  protected readonly showPageSizeDropdown = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);

  protected readonly filteredTasks = computed(() => {
    const term = this.query().trim().toLowerCase();
    const tasks = this.tasks().filter((task) => task.name.toLowerCase().includes(term));

    switch (this.filterMode()) {
      case 'all':
        return tasks.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
      case 'completada':
        return tasks.filter(
          (task) => task.status === 'completada' || (task.isDeleted === true && task.completed === true)
        );
      case 'ejecutando':
        return tasks.filter((task) => task.status === 'ejecutando' && !task.isDeleted);
      case 'acumulada':
        return tasks.filter((task) => task.status === 'acumulada' && !task.isDeleted);
      default:
        return tasks.filter((task) => !task.isDeleted);
    }
  });

  protected readonly pagedTasks = computed(() => {
    const tasks = this.filteredTasks();
    const start = this.pageIndex() * this.pageSize();
    return tasks.slice(start, start + this.pageSize());
  });

  protected readonly totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.filteredTasks().length / this.pageSize()));
  });

  constructor() {
    void this.loadTasks(true);
  }

  protected trackById(index: number, task: Task) {
    return task._id;
  }

  protected updateQuery(value: string) {
    this.query.set(value);
    this.pageIndex.set(0);
  }

  protected updateInput(value: string) {
    this.inputValue.set(value);
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();
    await this.addTask();
  }

  protected toggleFilterWindow() {
    this.showFilterWindow.set(!this.showFilterWindow());
  }

  protected togglePageSizeDropdown() {
    this.showPageSizeDropdown.set(!this.showPageSizeDropdown());
  }

  protected applyFilterMode(mode: 'all' | 'completada' | 'ejecutando' | 'acumulada') {
    this.filterMode.set(mode);
    this.pageIndex.set(0);
    this.showFilterWindow.set(false);
    void this.loadTasks(mode === 'all' || mode === 'completada');
  }

  protected setPageSize(value: string) {
    this.pageSize.set(Number(value));
    this.pageIndex.set(0);
    this.showPageSizeDropdown.set(false);
  }

  protected gotoFirstPage() {
    this.pageIndex.set(0);
  }

  protected gotoPreviousPage() {
    this.pageIndex.set(Math.max(0, this.pageIndex() - 1));
  }

  protected gotoNextPage() {
    this.pageIndex.set(Math.min(this.totalPages() - 1, this.pageIndex() + 1));
  }

  protected async loadTasks(includeDeleted = false) {
    this.loading.set(true);
    this.error.set(null);

    try {
      const url = `${API_BASE}/api/tasks${includeDeleted ? '?includeDeleted=true' : ''}`;
        const response = await fetch(url);
      if (!response.ok) {
        throw new Error('No se pudieron cargar las tareas');
      }

      const tasks = await response.json();
      const normalized = tasks.map((task: any) => ({
        ...task,
        status: task.status === 'anulado' ? 'completada' : task.status
      }));
      this.tasks.set(normalized);
      this.pageIndex.set(0);
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async addTask() {
    const name = this.inputValue().trim();
    if (!name) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        throw new Error('No se pudo crear la tarea');
      }

      const task = await response.json();
      this.tasks.update((tasks) => [...tasks, task]);
      this.inputValue.set('');
      this.query.set('');
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected isTaskBlocked(task: Task) {
    return task.completed === false && task.status !== 'completada' && task.status !== 'ejecutando';
  }

  protected displayStatus(task: Task) {
    return task.status === 'anulado' ? 'completada' : task.status;
  }

  protected async deleteTask(task: Task) {
    if (!task.completed || task.isDeleted) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/tasks/${task._id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('No se pudo eliminar la tarea');
      }

      const updatedTask = await response.json();
      this.tasks.update((tasks) =>
        tasks.map((item) => (item._id === updatedTask._id ? updatedTask : item))
      );
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected async setTaskStatus(task: Task, status: TaskStatus, isDeleted = false) {
    try {
      const response = await fetch(`${API_BASE}/api/tasks/${task._id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, completed: status === 'completada' })
      });

      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado de la tarea');
      }

      const updatedTask = await response.json();
      this.tasks.update((tasks) =>
        tasks.map((item) => (item._id === updatedTask._id ? updatedTask : item))
      );
    } catch (err) {
      this.error.set(String(err));
    }
  }
}
