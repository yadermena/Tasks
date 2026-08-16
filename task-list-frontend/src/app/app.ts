import { Component, computed, signal, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

const API_BASE = 'http://127.0.0.1:5000';

type UserRole = 'admin' | 'editor' | 'viewer';

interface User {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  companies?: {
    _id: string;
    name: string;
  }[];
  canDelete?: boolean;
  canEditProfile?: boolean;
  canEditTask?: boolean;
  createdAt: string;
}

interface Empresa {
  _id: string;
  name: string;
  rubro: string;
  assignedUser?: string | null;
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
export class App implements OnDestroy {
  protected readonly title = signal('Dashboard de usuarios');
  protected readonly users = signal<User[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly isSidebarOpen = signal(false);
  protected readonly form = signal({ name: '', email: '', role: 'viewer' as UserRole, password: '', companyIds: [] as string[]});
  protected readonly isUserFormVisible = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingUser = signal<User | null>(null);
  protected readonly permissionsModalUser = signal<User | null>(null);
  protected readonly adminView = signal<'tasks' | 'users' | 'empresas' | 'configuraciones'>('users');
  // Signals for admin login modal
  protected readonly loginModalUser = signal<User | null>(null);
  protected readonly passwordInput = signal('');
  protected readonly loginError = signal<string | null>(null);
  protected readonly previousAdminView = signal<'tasks' | 'users' | 'empresas' | 'configuraciones' | null>(null);
  protected readonly isProfileMenuOpen = signal(false);
  protected readonly selectedEmpresa = signal<Empresa | null>(null);

  // Signals for companies
  protected readonly empresas = signal<Empresa[]>([]);
  protected readonly empresaForm = signal({ name: '', rubro: '' });
  protected readonly editingEmpresaId = signal<string | null>(null);
  protected readonly isEmpresaFormVisible = signal(false);
  protected readonly isCompanyDropdownOpen = signal(false);
  protected readonly isUserFilterDropdownOpen = signal(false);
  protected readonly empresaQuery = signal('');

  protected readonly realUser = signal<User | null>(null);
  // Signals for the "logged-in" user and their tasks
  protected readonly currentUser = signal<User | null>(null);
  protected readonly tasks = signal<Task[]>([]); // All tasks for the current user/admin
  protected readonly editingTask = signal<Task | null>(null); // Task being edited
  protected readonly isTaskFormVisible = signal(false); // Visibility of the task form
  protected readonly taskLoading = signal(false);
  protected readonly newTaskName = signal('');
  protected readonly taskQuery = signal('');
  protected readonly selectedTaskUserId = signal<string | 'all'>('all');

  protected readonly tasksForSummary = computed(() => {
    const allTasks = this.tasks();
    const selectedUserId = this.selectedTaskUserId();

    if (this.currentUser()?.role === 'admin' && selectedUserId !== 'all') {
      return allTasks.filter(task => task.userId?._id === selectedUserId);
    }
    return allTasks;
  });

  protected readonly completedTasksCount = computed(() => this.tasksForSummary().filter(t => t.status === 'completada').length);
  protected readonly runningTasksCount = computed(() => this.tasksForSummary().filter(t => t.status === 'ejecutando' && !t.isDeleted).length);
  protected readonly accumulatedTasksCount = computed(() => this.tasksForSummary().filter(t => t.status === 'acumulada' && !t.isDeleted).length);
  protected readonly currentFilterStatus = signal<'all' | Task['status'] | 'eliminadas'>('all');
  protected readonly taskForm = signal({ name: '', status: 'ejecutando' as Task['status'], userId: '' }); // Form for adding/editing tasks
  protected readonly deletedTasksCount = computed(() => this.tasksForSummary().filter(t => t.isDeleted).length);

  protected getUserInitials(user: User): string {
    if (!user?.name) return '';
    const parts = user.name.trim().split(' ').filter(p => p);
    if (parts.length > 1 && parts[parts.length - 1]) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return parts[0]?.charAt(0).toUpperCase() ?? '';
  }

  protected readonly avatarColors = computed(() => {
    const users = this.users();
    const initialsCount = new Map<string, number>();
    for (const user of users) {
      const initials = this.getUserInitials(user);
      if (initials) {
        initialsCount.set(initials, (initialsCount.get(initials) || 0) + 1);
      }
    }

    const userColors = new Map<string, { background: string; text: string }>();
    const colors = [
      { background: '#e0e7ff', text: '#3730a3' }, // Default: indigo
      { background: '#d1fae5', text: '#065f46' }, // green
      { background: '#fef3c7', text: '#92400e' }, // amber
      { background: '#fee2e2', text: '#991b1b' }, // red
      { background: '#e0f2fe', text: '#075985' }, // sky
      { background: '#fce7f3', text: '#9d174d' }, // pink
      { background: '#e5e7eb', text: '#1f2937' }, // gray
    ];

    for (const user of users) {
      const initials = this.getUserInitials(user);
      if (initials && initialsCount.get(initials)! > 1) {
        const charCodeSum = initials.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const colorIndex = (charCodeSum % (colors.length - 1)) + 1;
        userColors.set(user._id, colors[colorIndex]);
      } else {
        userColors.set(user._id, colors[0]);
      }
    }
    return userColors;
  });

  protected readonly selectedCompaniesText = computed(() => {
    const selectedIds = this.form().companyIds;
    if (selectedIds.length === 0) {
      return 'Seleccionar empresas';
    }
    const allEmpresas = this.empresas();
    if (allEmpresas.length === 0) return 'Cargando...';

    const selectedNames = allEmpresas
      .filter(e => selectedIds.includes(e._id))
      .map(e => e.name);

    if (selectedNames.length > 2) {
      return `${selectedNames.slice(0, 2).join(', ')} y ${selectedNames.length - 2} más`;
    }
    return selectedNames.join(', ');
  });

  protected readonly selectedTaskUserName = computed(() => {
    const selectedId = this.selectedTaskUserId();
    if (selectedId === 'all') {
      return 'Todos los usuarios';
    }
    const user = this.users().find(u => u._id === selectedId);
    return user?.name ?? 'Todos los usuarios';
  });

  protected readonly currentUserInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    return this.getUserInitials(user);
  });

  protected readonly filteredUsers = computed(() => {
    const term = this.query().trim().toLowerCase();
    const nonAdminUsers = this.users().filter(user => user.role !== 'admin');
    if (!term) {
      return nonAdminUsers;
    } 

    return nonAdminUsers.filter((user) => {
      return `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(term);
    });
  });

  protected readonly filteredAdminUsers = computed(() => {
    const term = this.query().trim().toLowerCase();
    const adminUsers = this.users().filter(user => user.role === 'admin');
    if (!term) {
      return adminUsers;
    }
    return adminUsers.filter((user) => {
      return `${user.name} ${user.email}`.toLowerCase().includes(term);
    });
  });

  protected readonly switchableUsers = computed(() => {
    const realUser = this.realUser();
    // When an admin is logged in, they can switch to any user but themselves.
    if (realUser?.role === 'admin') {
      return this.users().filter(user => user._id !== realUser._id);
    }
    // When not logged in, or a non-admin is logged in, the list is unfiltered.
    // The login modal will handle authentication.
    return this.users();
  });

  protected readonly filteredEmpresas = computed(() => {
    const term = this.empresaQuery().trim().toLowerCase();
    if (!term) {
      return this.empresas();
    }
    return this.empresas().filter((empresa) => {
      return `${empresa.name} ${empresa.rubro}`.toLowerCase().includes(term);
    });
  });

  protected readonly filteredTasks = computed(() => {
    const term = this.taskQuery().trim().toLowerCase();
    const allTasks = this.tasks();
    const filterStatus = this.currentFilterStatus();
    const selectedUserId = this.selectedTaskUserId();

    // Filter by selected user first (if admin)
    let userTasks = allTasks;
    if (this.currentUser()?.role === 'admin' && selectedUserId !== 'all') {
      userTasks = allTasks.filter(task => task.userId?._id === selectedUserId);
    }

    let filteredByStatus = userTasks;
    if (filterStatus !== 'all') {
      if (filterStatus === 'ejecutando' || filterStatus === 'acumulada') {
        filteredByStatus = userTasks.filter(task => task.status === filterStatus && !task.isDeleted);
      } else if (filterStatus === 'completada') {
        filteredByStatus = userTasks.filter(task => task.status === filterStatus);
      } else if (filterStatus === 'eliminadas') {
        filteredByStatus = userTasks.filter(task => task.isDeleted);
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
        void this.loginById(savedUserId);
      } else {
        // Otherwise, just load the admin dashboard.
        void this.loadUsers();
        void this.loadEmpresas();
      }
      document.addEventListener('click', this.onDocumentClick.bind(this));
    } else {
      void this.loadUsers();
      void this.loadEmpresas();
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('click', this.onDocumentClick.bind(this));
    }
  }

  private onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.isCompanyDropdownOpen()) {
      if (!target.closest('.custom-dropdown')) {
        this.isCompanyDropdownOpen.set(false);
      }
    }
    // La variable 'target' estaba fuera de alcance aquí.
    if (this.isUserFilterDropdownOpen() && !target.closest('.user-task-filter')) {
      this.isUserFilterDropdownOpen.set(false);
    }
  }

  protected updateQuery(value: string) {
    this.query.set(value);
  }

  protected updateField(field: 'name' | 'email' | 'role' | 'password', value: string) {
    this.form.update((current) => ({...current, [field]: value}));
  }

  protected updateCompanySelection(companyId: string, isSelected: boolean) {
    this.form.update(current => {
      const companyIds = isSelected
        ? [...current.companyIds, companyId]
        : current.companyIds.filter(id => id !== companyId);
      return { ...current, companyIds };
    });
  }

  protected async onSubmit(event: Event) {
    event.preventDefault();
    await this.saveUser();
  }

  protected openAddUserForm(isAdmin: boolean = false) {
    this.resetForm();
    this.isUserFormVisible.set(true);
    if (isAdmin) {
      this.form.update(f => ({ ...f, role: 'admin' }));
    }
  }

  protected toggleSidebar() {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }

  // --- User "Session" Management ---

  protected login(user: User) {
    this.loginModalUser.set(user);
    this.passwordInput.set('');
    this.loginError.set(null);
    this.isSidebarOpen.set(false);
  }

  private _performLogin(user: User) {
    localStorage.setItem('currentUserId', user._id);
    this.currentUser.set(user);
    void this.loadTasks(); // Load tasks for the newly "logged-in" user
    if (user.role === 'admin') {
      void this.loadEmpresas();
    }
    this.isSidebarOpen.set(false);
  }


  protected async loginById(userId: string) {
    this.loading.set(true);
    try {
      // A better implementation would have a `/api/users/:id` endpoint.
      // For now, we load all users and find the one we need.
      const res = await fetch(`${API_BASE}/api/users`, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Could not load users to find session user.');
      const allUsers: User[] = await res.json();
      const user = allUsers.find(u => u._id === userId);
      if (user) {
        this.realUser.set(user); // This is the "real" user session
        this._performLogin(user); // Directly perform login, bypassing password check for session restoration
        // Always set all users in the sidebar, regardless of role
        this.users.set(allUsers);
        // If the user is an admin, set their default view to tasks.
        // This is only for the initial load, subsequent admin navigation is handled by setAdminView.
        if (user.role === 'admin') {
          this.adminView.set('tasks'); 
        }
      } else {
        this.logout(); // User not found, so log out.
      }
    } catch (err) {
      this.error.set(String(err));
      this.logout();
    } finally {
      this.loading.set(false);
    }
  }

  protected logout() {
    const realUser = this.realUser();
    const currentUser = this.currentUser(); // cache it before it's set to null

    // If we are impersonating (current user is not the real user),
    // then "logout" means going back to the real user's view.
    if (realUser && realUser._id !== this.currentUser()?._id) {
        this._performLogin(realUser);
        this.adminView.set('users');
        // When an admin returns to their panel, they should see all users.
        void this.loadUsers();
        return;
    }

    // Otherwise, perform a full logout.
    localStorage.removeItem('currentUserId');
    this.currentUser.set(null);
    this.realUser.set(null); // Clear real user on full logout
    this.tasks.set([]);
    this.adminView.set('users');
    this.selectedEmpresa.set(null);
    this.isSidebarOpen.set(false);
    // After full logout, always load all users for the login screen.
    void this.loadUsers();
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
    const { name, email, role, password, companyIds } = this.form();
    if (!name.trim() || !email.trim()) {
      this.error.set('Completa nombre y correo para guardar');
      return;
    }

    if (!this.editingId() && !password.trim()) {
      this.error.set('La clave es obligatoria para crear un nuevo usuario.');
      return;
    }

    try {
      const method = this.editingId() ? 'PUT' : 'POST';
      const url = this.editingId() ? `${API_BASE}/api/users/${this.editingId()}` : `${API_BASE}/api/users`;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password, companyIds })
      });

      if (!response.ok) {
        // Try to get a specific message from the JSON response body
        let errorMessage = 'No se pudo guardar el usuario';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) {
          // The response was not JSON, or there was another error.
          // The generic error message will be used.
        }
        throw new Error(errorMessage);
      }

      const savedUser = await response.json();
      if (this.editingId()) {
        this.users.update((current) => current.map((user) => (user._id === savedUser._id ? savedUser : user))
        );
      } else {
        this.users.update((current) => [savedUser, ...current]);
      }

      // After saving a user, company assignments might have changed.
      // Reload the companies to get the updated `assignedUser` info.
      void this.loadEmpresas();

      this.resetForm();
      this.isUserFormVisible.set(false);
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected editUser(user: User) {
    // Check if this action is coming from the profile menu (editing the current user)
    const isEditingCurrentUser = this.currentUser()?._id === user._id;

    if (isEditingCurrentUser) {
      this.isProfileMenuOpen.set(false);
      // If the "real" user is an admin, they are the one who can see the admin panel.
      // We need to switch to the correct view to show the user edit form.
      if (this.realUser()?.role === 'admin') {
        const currentView = this.adminView();
        // Admin users are edited in 'configuraciones', others in 'users'
        const targetView = user.role === 'admin' ? 'configuraciones' : 'users';

        if (currentView !== targetView) {
          this.previousAdminView.set(currentView);
        } else {
          this.previousAdminView.set(null);
        }
        this.setAdminView(targetView);
      }
    }

    // Common logic for all user edits
    this.editingId.set(user._id);
    this.editingUser.set(user);
    this.form.set({ name: user.name, email: user.email, role: user.role, password: '', companyIds: user.companies?.map(c => c._id) ?? [] });
    this.isUserFormVisible.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit() {
    this.resetForm();
    this.isUserFormVisible.set(false);
  }

  protected backToPreviousAdminView() {
    const previousView = this.previousAdminView();
    this.cancelEdit();
    if (previousView) {
      this.setAdminView(previousView);
    }
  }

  protected resetForm() {
    this.editingId.set(null);
    this.editingUser.set(null);
    this.form.set({ name: '', email: '', role: 'viewer', password: '', companyIds: []});
    this.error.set(null);
    this.previousAdminView.set(null);
  }

  protected async deleteUser(user: User) {
    if (user.role === 'admin') {
      const adminCount = this.users().filter(u => u.role === 'admin').length;
      if (adminCount <= 3) {
        this.error.set('Primero asigna el rol a otro usuario, agrega un nuevo administrador en crear usuario');
        return;
      }
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar al usuario "${user.name}"?`)) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/users/${user._id}`, { method: 'DELETE' });
      if (!response.ok) {
        let errorMessage = 'No se pudo eliminar el usuario';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) {
          // The response was not JSON, or there was another error.
          // The generic error message will be used.
        }
        throw new Error(errorMessage);
      }

      this.users.update((current) => current.filter((item) => item._id !== user._id));

      // If the deleted user had companies assigned, they are now unassigned.
      // Reload the companies list to reflect this change.
      void this.loadEmpresas();
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected trackById(index: number, user: User) {
    return user._id;
  }

  protected trackEmpresaById(index: number, empresa: Empresa) {
    return empresa._id;
  }

  // --- Company Management Methods ---

  protected setAdminView(view: 'tasks' | 'users' | 'empresas' | 'configuraciones') {
    this.adminView.set(view);
  }

  protected selectEmpresa(empresa: Empresa) {
    if (this.selectedEmpresa()?._id === empresa._id) {
      this.selectedEmpresa.set(null);
    } else {
      this.selectedEmpresa.set(empresa);
    }
    this.isSidebarOpen.set(false);
  }

  protected updateEmpresaQuery(value: string) {
    this.empresaQuery.set(value);
  }

  protected updateEmpresaField(field: 'name' | 'rubro', value: string) {
    this.empresaForm.update((current) => ({...current, [field]: value}));
  }

  protected async onEmpresaSubmit(event: Event) {
    event.preventDefault();
    await this.saveEmpresa();
  }

  protected async loadEmpresas() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await fetch(`${API_BASE}/api/empresas`, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error('No se pudieron cargar las empresas');
      }
      this.empresas.set(await response.json());
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected async saveEmpresa() {
    const { name, rubro } = this.empresaForm();
    if (!name.trim() || !rubro.trim()) {
      this.error.set('Completa Nombre y Rubro para guardar');
      return;
    }

    try {
      const method = this.editingEmpresaId() ? 'PUT' : 'POST';
      const url = this.editingEmpresaId() ? `${API_BASE}/api/empresas/${this.editingEmpresaId()}` : `${API_BASE}/api/empresas`;
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), rubro: rubro.trim() })
      });

      if (!response.ok) {
        // Try to get a specific message from the JSON response body
        let errorMessage = 'No se pudo guardar la empresa';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) {
          // The response was not JSON, or there was another error.
          // The generic error message will be used.
        }
        throw new Error(errorMessage);
      }

      const savedEmpresa = await response.json();
      if (this.editingEmpresaId()) {
        this.empresas.update((current) => current.map((empresa) => (empresa._id === savedEmpresa._id ? savedEmpresa : empresa)));
      } else {
        this.empresas.update((current) => [savedEmpresa, ...current]);
      }

      this.resetEmpresaForm();
      this.isEmpresaFormVisible.set(false);
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected openAddEmpresaForm() {
    this.resetEmpresaForm();
    this.isEmpresaFormVisible.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected editEmpresa(empresa: Empresa) {
    this.editingEmpresaId.set(empresa._id);
    this.empresaForm.set({ name: empresa.name, rubro: empresa.rubro });
    this.isEmpresaFormVisible.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEditEmpresa() {
    this.resetEmpresaForm();
    this.isEmpresaFormVisible.set(false);
  }

  protected resetEmpresaForm() {
    this.editingEmpresaId.set(null);
    this.empresaForm.set({ name: '', rubro: '' });
    this.error.set(null);
  }

  protected async deleteEmpresa(empresa: Empresa) {
    if (!confirm(`¿Estás seguro de que quieres eliminar la empresa "${empresa.name}"?`)) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/empresas/${empresa._id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error('No se pudo eliminar la empresa');
      }
      this.empresas.update((current) => current.filter((item) => item._id !== empresa._id));
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected trackTaskById(index: number, task: Task) {
    return task._id;
  }

  protected selectTaskUser(userId: string | 'all') {
    this.selectedTaskUserId.set(userId);
    this.isUserFilterDropdownOpen.set(false);
  }

  protected updateTaskQuery(value: string) {
    this.taskQuery.set(value);
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

  // --- Task Management Methods ---

  protected updateTaskFormField(field: 'name' | 'status' | 'userId', value: string) {
    this.taskForm.update(current => ({ ...current, [field]: value }));
  }

  protected async onTaskSubmit(event: Event) {
    event.preventDefault();
    const user = this.currentUser();
    if (!user) return;

    const { name, status } = this.taskForm();
    if (!name.trim()) {
      this.error.set('El nombre de la tarea es obligatorio.');
      return;
    }

    const isEditing = !!this.editingTask();
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing ? `${API_BASE}/api/tasks/${this.editingTask()?._id}` : `${API_BASE}/api/tasks`;

    const body: { name: string; status: string; userId?: string } = {
      name: name.trim(),
      status: status,
    };

    // Only admins can assign/re-assign tasks.
    if (user.role === 'admin' && this.taskForm().userId) {
      body.userId = this.taskForm().userId;
    }

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-user-id': user._id,
        'x-user-role': user.role,
      };

      if (user.canEditTask) {
        headers['x-user-can-edit-task'] = 'true';
      }

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        let errorMessage = 'No se pudo crear la tarea';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.message || errorMessage;
        } catch (jsonError) { /* ignore if not JSON */ }
        throw new Error(errorMessage);
      }

      const savedTask = await response.json();
      if (isEditing) {
        this.tasks.update(current => current.map(t => (t._id === savedTask._id ? savedTask : t)));
      } else {
        this.tasks.update(current => [savedTask, ...current]);
      }
      this.cancelEditTask(); // Reset form and hide it
    } catch (err) {
      this.error.set(String(err));
    }
  }

  protected openAddTaskForm() {
    this.editingTask.set(null);
    this.taskForm.set({ name: '', status: 'ejecutando', userId: this.currentUser()?._id ?? '' });
    this.isTaskFormVisible.set(true);
    this.error.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected editTask(task: Task) {
    const user = this.currentUser();
    if (!user) return;

    // Si el usuario no es administrador:
    if (user.role !== 'admin') {
      // No puede editar tareas completadas.
      if (task.status === 'completada') {
        this.error.set('Solo un administrador puede editar una tarea completada.');
        return;
      }
      // Para tareas no completadas, necesita el permiso canEditTask.
      if (!user.canEditTask) {
        this.error.set('No tienes permiso para editar tareas.');
        return;
      }
    }
    this.editingTask.set(task);
    this.taskForm.set({
      name: task.name,
      status: task.status,
      userId: task.userId._id,
    });
    this.isTaskFormVisible.set(false); // Oculta el formulario superior si está abierto
    this.error.set(null);
  }

  protected cancelEditTask() {
    this.editingTask.set(null);
    this.taskForm.set({ name: '', status: 'ejecutando', userId: '' });
    this.isTaskFormVisible.set(false);
    this.error.set(null);
  }

  protected async updateTaskStatus(task: Task, status: Task['status']) {
    if (task.status === status) return;
    const user = this.currentUser();
    if (!user) return; // No debería ocurrir si la UI está bien guardada

    // Si el usuario no es administrador:
    if (user.role !== 'admin') {
      // No puede cambiar el estado de tareas completadas.
      if (task.status === 'completada') {
        this.error.set('Solo un administrador puede cambiar el estado de una tarea completada.');
        return;
      }
      // Para tareas no completadas, necesita el permiso canEditTask.
      if (!user.canEditTask) {
        this.error.set('No tienes permiso para cambiar el estado de la tarea.');
        return;
      }
    }
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'x-user-id': user._id,
      };
      if (user.role === 'admin') {
        headers['x-user-role'] = 'admin';
      }
      if (user.canEditTask) {
        headers['x-user-can-edit-task'] = 'true';
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

      // If a non-admin user with edit permissions completes a task,
      // update their local state to reflect the revoked permission.
      if (status === 'completada' && user.role !== 'admin' && user.canEditTask) {
        this.currentUser.update(current =>
          current ? { ...current, canEditTask: false } : null
        );
      }
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

  protected async toggleProfileEditPermission(user: User) {
    const canEditProfile = !user.canEditProfile;
    try {
      const response = await fetch(`${API_BASE}/api/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canEditProfile })
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
      this.error.set(String(err));
      this.closePermissionsModal();
    }
  }

  protected async toggleTaskEditPermission(user: User) {
    const canEditTask = !user.canEditTask;
    try {
      const response = await fetch(`${API_BASE}/api/users/${user._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canEditTask })
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
      this.error.set(String(err));
      this.closePermissionsModal();
    }
  }

  // --- Admin Login Modal Methods ---

  protected closeLoginModal() {
    this.loginModalUser.set(null);
    this.passwordInput.set('');
    this.loginError.set(null);
  }

  protected async attemptLogin() {
    const user = this.loginModalUser();
    if (!user) return;

    this.loginError.set(null);

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password: this.passwordInput() })
      });

      if (!response.ok) {
        let errorMessage = 'Clave incorrecta'; // Default error
        try {
          // The server might send a specific error message in JSON format
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (jsonError) {
          // If the response isn't JSON, it's likely an HTML error page from the server.
          // We can log it for debugging but show a more generic message to the user.
          console.error('Server returned a non-JSON error response. This might be an HTML error page. Body:', await response.text().catch(() => 'Could not read error body.'));
          errorMessage = `Error del servidor (${response.status}). Verifique la consola del backend.`;
        }
        throw new Error(errorMessage);
      }

      const loggedInUser = await response.json();

      // The `user` from `loginModalUser()` has the company info populated.
      // A non-admin user must have a company to log in. This can either be
      // pre-assigned to their profile or selected manually from the sidebar.
      if (user.role !== 'admin' && (!user.companies || user.companies.length === 0) && this.selectedEmpresa() === null) {
        this.loginError.set('Este usuario no tiene una empresa asignada. Por favor, seleccione una empresa para ingresar.');
        return; // Don't proceed
      }

      this._performLogin(loggedInUser);
      this.closeLoginModal();
    } catch (err) {
      // Display the error in the modal, removing the "Error: " prefix.
      this.loginError.set(String(err).replace('Error: ', ''));
    }
  }
}
