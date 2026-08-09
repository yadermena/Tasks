import { Component, computed, signal, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

const API_BASE = 'http://127.0.0.1:5000';

type UserRole = 'admin' | 'editor' | 'viewer';

interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  canDelete?: boolean;
  createdAt: string;
}

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
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  protected readonly title = signal('Dashboard de usuarios');
  protected readonly users = signal<User[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly form = signal({ name: '', email: '', role: 'viewer' as UserRole });
  protected readonly editingId = signal<string | null>(null);
  protected readonly permissionsModalUser = signal<User | null>(null);

  // Signals for the "logged-in" user and their tasks
  protected readonly currentUser = signal<User | null>(null);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly taskLoading = signal(false);
  protected readonly newTaskName = signal('');
  protected readonly taskQuery = signal('');

  // Signals for task summary
  protected readonly completedTasksCount = computed(() => this.tasks().filter(t => t.status === 'completada').length);
  protected readonly runningTasksCount = computed(() => this.tasks().filter(t => t.status === 'ejecutando' && !t.isDeleted).length);
  protected readonly accumulatedTasksCount = computed(() => this.tasks().filter(t => t.status === 'acumulada' && !t.isDeleted).length);
  protected readonly currentFilterStatus = signal<'all' | Task['status'] | 'eliminadas'>('all');
  protected readonly deletedTasksCount = computed(() => this.tasks().filter(t => t.isDeleted).length);

  protected readonly filteredUsers = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) {
      return this.users();
    }

    return this.users().filter((user) => {
      return `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(term);
    });
  });

  protected readonly filteredTasks = computed(() => {
    const term = this.taskQuery().trim().toLowerCase();
    const allTasks = this.tasks();
    const filterStatus = this.currentFilterStatus();

    let filteredByStatus = allTasks;
    if (filterStatus !== 'all') {
      if (filterStatus === 'ejecutando' || filterStatus === 'acumulada') {
        filteredByStatus = allTasks.filter(task => task.status === filterStatus && !task.isDeleted);
      } else if (filterStatus === 'completada') {
        filteredByStatus = allTasks.filter(task => task.status === filterStatus);
      } else if (filterStatus === 'eliminadas') {
        filteredByStatus = allTasks.filter(task => task.isDeleted);
      }
    }

    if (!term) {
      return filteredByStatus;
    }
    return filteredByStatus.filter(task => {
      const taskNameMatch = task.name.toLowerCase().includes(term);
      const userNameMatch = this.currentUser()?.role === 'admin' && task.userId?.name.toLowerCase().includes(term);
      return taskNameMatch || !!userNameMatch;
    });
  });

  constructor(@Inject(PLATFORM_ID) private platformId: object) {
    if (isPlatformBrowser(this.platformId)) {
      // On initial load, check if a user was "logged in" from a previous session
      const savedUserId = localStorage.getItem('currentUserId');
      if (savedUserId) {
        // If so, load that user's data and tasks.
        // This makes it feel like a real session.
        this.loginById(savedUserId);
      } else {
        // Otherwise, just load the admin dashboard.
        void this.loadUsers();
      }
    } else {
      void this.loadUsers();
    }
  }

  protected updateQuery(value: string) {
    this.query.set(value);
  }

  protected updateField(field: 'name' | 'email' | 'role', value: string) {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();
    await this.saveUser();
  }

  // --- User "Session" Management ---

  protected login(user: User) {
    localStorage.setItem('currentUserId', user._id);
    this.currentUser.set(user);
    void this.loadTasks(); // Load tasks for the newly "logged-in" user
  }

  protected async loginById(userId: string) {
    this.loading.set(true);
    try {
      // A better implementation would have a `/api/users/:id` endpoint.
      // For now, we load all users and find the one we need.
      const res = await fetch(`${API_BASE}/api/users`, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Could not load users to find session user.');
      const users = await res.json();
      this.users.set(users);
      const user = this.users().find(u => u._id === userId);
      if (user) {
        this.login(user);
      } else {
        this.logout(); // User not found, so log out.
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected logout() {
    localStorage.removeItem('currentUserId');
    this.currentUser.set(null);
    this.tasks.set([]); // Clear tasks
  }

  protected async loadUsers() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await fetch(`${API_BASE}/api/users`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('No se pudieron cargar los usuarios');
      }

      this.users.set(await response.json());
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async saveUser() {
    const { name, email, role } = this.form();
    if (!name.trim() || !email.trim()) {
      this.error.set('Completa nombre y correo para guardar');
      return;
    }

    try {
      const method = this.editingId() ? 'PUT' : 'POST';
      const url = this.editingId() ? `${API_BASE}/api/users/${this.editingId()}` : `${API_BASE}/api/users`;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role })
      });

      if (!response.ok) {
        throw new Error('No se pudo guardar el usuario');
      }

      const savedUser = await response.json();
      if (this.editingId()) {
        this.users.update((current) => current.map((user) => (user._id === savedUser._id ? savedUser : user)));
      } else {
        this.users.update((current) => [savedUser, ...current]);
      }

      this.resetForm();
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected editUser(user: User) {
    this.editingId.set(user._id);
    this.form.set({ name: user.name, email: user.email, role: user.role });
  }

  protected cancelEdit() {
    this.resetForm();
  }

  protected resetForm() {
    this.editingId.set(null);
    this.form.set({ name: '', email: '', role: 'viewer' });
    this.error.set(null);
  }

  protected async deleteUser(user: User) {
    try {
      const response = await fetch(`${API_BASE}/api/users/${user._id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('No se pudo eliminar el usuario');
      }

      this.users.update((current) => current.filter((item) => item._id !== user._id));
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected trackById(index: number, user: User) {
    return user._id;
  }

  protected trackTaskById(index: number, task: Task) {
    return task._id;
  }

  protected updateTaskQuery(value: string) {
    this.taskQuery.set(value);
  }

  // --- Task Management Methods ---

  protected updateNewTaskName(name: string) {
    this.newTaskName.set(name);
  }

  protected async loadTasks() {
    const user = this.currentUser();
    if (!user) return;

    this.taskLoading.set(true);
    this.error.set(null);
    try {
      const headers: HeadersInit = { 'x-user-id': user._id };
      // Si el usuario es admin, enviamos su rol para que el backend
      // nos devuelva todas las tareas.
      if (user.role === 'admin') {
        headers['x-user-role'] = 'admin';
      }

      let url = `${API_BASE}/api/tasks`;
      if (user.role === 'admin') {
        url += '?includeDeleted=true';
      }

      const response = await fetch(url, { headers, cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('No se pudieron cargar las tareas del usuario.');
      }
      this.tasks.set(await response.json());
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.taskLoading.set(false);
    }
  }

  protected async addTask(event: Event) {
    event.preventDefault();
    const user = this.currentUser();
    const name = this.newTaskName().trim();
    if (!user || !name) return;

    try {
      const response = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user._id
        },
        body: JSON.stringify({ name })
      });
      if (!response.ok) throw new Error('No se pudo crear la tarea');
      const createdTask = await response.json();
      this.tasks.update(current => [createdTask, ...current]);
      this.newTaskName.set('');
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected async updateTaskStatus(task: Task, status: Task['status']) {
    if (task.status === status) return;

    try {
      const user = this.currentUser();
      if (!user) return;

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-user-id': user._id,
      };
      if (user.role === 'admin') {
        headers['x-user-role'] = 'admin';
      }

      const response = await fetch(`${API_BASE}/api/tasks/${task._id}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        let errorMessage = 'No se pudo actualizar el estado de la tarea';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) { /* ignore if not JSON */ }
        throw new Error(errorMessage);
      }

      const updatedTask = await response.json();
      this.tasks.update(current =>
        current.map(t => t._id === updatedTask._id ? updatedTask : t)
      );
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected async deleteTask(taskToDelete: Task) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la tarea "${taskToDelete.name}"?`)) {
      return;
    }

    try {
      const user = this.currentUser();
      if (!user) return;

    const headers: HeadersInit = { 'x-user-id': user._id };
      if (user.role === 'admin') {
        headers['x-user-role'] = 'admin';
    }
    if (user.canDelete) {
      headers['x-user-can-delete'] = 'true';
      }

      const response = await fetch(`${API_BASE}/api/tasks/${taskToDelete._id}`, { method: 'DELETE', headers });
      if (!response.ok) {
        let errorMessage = 'No se pudo eliminar la tarea';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) { /* ignore if not JSON */ }
        throw new Error(errorMessage);
      }

      if (user.role === 'admin') {
        const updatedTask = await response.json();
        this.tasks.update(current => current.map(t => (t._id === updatedTask._id ? updatedTask : t)));
      } else {
        this.tasks.update(current => current.filter(t => t._id !== taskToDelete._id));
      }
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected async restoreTask(taskToRestore: Task) {
    if (!confirm(`¿Estás seguro de que quieres restaurar la tarea "${taskToRestore.name}"?`)) {
      return;
    }

    try {
      const user = this.currentUser();
      if (!user || user.role !== 'admin') {
        return;
      }

      const headers: HeadersInit = {
        'x-user-id': user._id,
        'x-user-role': 'admin',
        'Content-Type': 'application/json', // Aseguramos que el servidor sepa que esperamos JSON
      };

      const response = await fetch(`${API_BASE}/api/tasks/${taskToRestore._id}/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}), // Enviamos un cuerpo JSON vacío para compatibilidad
      });

      if (!response.ok) {
        console.error('Restore task failed:', response.status, response.statusText); // Log de depuración
        let errorMessage = 'No se pudo restaurar la tarea';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) { /* ignore if not JSON */ }
        throw new Error(errorMessage);
      }

      const updatedTask = await response.json();
      this.tasks.update(current => current.map(t => (t._id === updatedTask._id ? updatedTask : t)));
    } catch (err) {
      this.error.set(String(err));
      console.error('Error in restoreTask:', err); // Log de depuración
    }
  }

  protected setFilterStatus(status: 'all' | Task['status'] | 'eliminadas') {
    this.currentFilterStatus.set(status);
  }

  protected openPermissionsModal(user: User) {
    this.permissionsModalUser.set(user);
  }

  protected closePermissionsModal() {
    this.permissionsModalUser.set(null);
  }

  protected async toggleDeletePermission(user: User) {
    const canDelete = !user.canDelete;
    try {
      const response = await fetch(`${API_BASE}/api/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canDelete })
      });

      if (!response.ok) {
        throw new Error('No se pudo actualizar el permiso');
      }

      const updatedUser = await response.json();
      // Update user in the main list
      this.users.update(current =>
        current.map(u => u._id === updatedUser._id ? updatedUser : u)
      );
      // Also update the user in the modal to reflect the change
      this.permissionsModalUser.set(updatedUser);

      // If the currently logged-in user is the one being edited, update their state too.
      if (this.currentUser()?._id === updatedUser._id) {
        this.currentUser.set(updatedUser);
      }
    } catch (err) {
      // Display error in the modal if possible, or globally
      this.error.set(String(err));
      // Close modal on error to avoid inconsistent state
      this.closePermissionsModal();
    }
  }
}
