import { Component, computed, signal, Inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { LoginComponent } from './login/login';

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'http://localhost:5000' 
  : 'https://tasks-2x63.onrender.com';

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
  canSetExecuting?: boolean;
  canSetCompleted?: boolean;
  canRestoreTask?: boolean;
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
  timerMinutes?: number | null;
  timerEndsAt?: string | null;
  userId: {
    _id: string;
    name: string;
  };
}

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
}

interface CalendarDay {
  date: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

interface AppNotification {
  _id: string;
  title: string;
  message: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnDestroy {
  protected readonly title = signal('Dashboard de usuarios');
  protected readonly users = signal<User[]>([]);
  protected readonly query = signal('');
  protected readonly isUserSearchOpen = signal(false);
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
  protected readonly sharedLoginUserId = signal<string | null>(null);

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
  protected readonly isCalendarOpen = signal(false);
  protected readonly tasks = signal<Task[]>([]); // All tasks for the current user/admin
  protected readonly editingTask = signal<Task | null>(null); // Task being edited
  protected readonly isTaskFormVisible = signal(false); // Visibility of the task form
  protected readonly taskLoading = signal(false);
  protected readonly newTaskName = signal('');
  protected readonly taskQuery = signal('');
  protected readonly selectedTaskUserId = signal<string | 'all'>('all');
  protected readonly taskUserSearch = signal('');

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
  protected readonly taskForm = signal({
    name: '',
    status: 'ejecutando' as Task['status'],
    userId: '',
    timerDays: null as number | null,
    timerHours: null as number | null,
    timerMinutes: null as number | null
  });
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

  protected readonly filteredTaskUsers = computed(() => {
    const term = this.taskUserSearch().trim().toLowerCase();
    if (!term) return this.users();
    return this.users().filter(user => user.name.toLowerCase().includes(term));
  });

  protected readonly currentUserInitials = computed(() => {
    const user = this.currentUser();
    if (!user) return '';
    return this.getUserInitials(user);
  });

  protected readonly filteredUsers = computed(() => {
    const term = this.query().trim().toLowerCase();
    const filter = this.userFilterStatus();
    
    let baseUsers = this.users();

    if (filter === 'editor') {
      baseUsers = baseUsers.filter(u => u.role === 'editor');
    } else if (filter === 'viewer') {
      baseUsers = baseUsers.filter(u => u.role === 'viewer');
    }
    
    if (filter === 'admin') {
      return [];
    }
    
    if (!term) {
      return baseUsers;
    } 

    return baseUsers.filter((user) => {
      return `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(term);
    });
  });

  protected readonly filteredAdminUsers = computed(() => {
    const term = this.query().trim().toLowerCase();
    const filter = this.userFilterStatus();
    
    let adminUsers = this.users().filter(user => user.role === 'admin');
    
    if (filter === 'editor' || filter === 'viewer') {
      return [];
    }

    if (!term) {
      return adminUsers;
    }
    return adminUsers.filter((user) => {
      return `${user.name} ${user.email}`.toLowerCase().includes(term);
    });
  });

  protected readonly filteredEditors = computed(() => this.filteredUsers().filter(u => u.role === 'editor'));
  protected readonly filteredViewers = computed(() => this.filteredUsers().filter(u => u.role === 'viewer'));

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

  protected readonly totalUsersCount = computed(() => this.users().length);
  protected readonly adminCount = computed(() => this.users().filter(u => u.role === 'admin').length);
  protected readonly editorCount = computed(() => this.users().filter(u => u.role === 'editor').length);
  protected readonly viewerCount = computed(() => this.users().filter(u => u.role === 'viewer').length);
  protected readonly userFilterStatus = signal<'all' | 'admin' | 'editor' | 'viewer'>('all');
  protected readonly timerTick = signal(Date.now());
  protected readonly calendarMonth = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly calendarEvents = signal<CalendarEvent[]>([]);
  protected readonly calendarEventTitle = signal('');
  protected readonly calendarEventDate = signal(this.toDateKey(new Date()));
  private timerIntervalId: ReturnType<typeof setInterval> | null = null;
  private notificationIntervalId: ReturnType<typeof setInterval> | null = null;
  protected readonly notifications = signal<AppNotification[]>([]);
  protected readonly isNotificationMenuOpen = signal(false);
  protected readonly unreadNotificationsCount = computed(() => this.notifications().filter(notification => !notification.read).length);

  protected readonly calendarMonthLabel = computed(() => this.calendarMonth().toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric'
  }));

  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const month = this.calendarMonth();
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const daysInPreviousMonth = new Date(month.getFullYear(), month.getMonth(), 0).getDate();
    const todayKey = this.toDateKey(new Date());
    const days: CalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
      const dayOffset = index - startOffset;
      let date: Date;
      let day: number;
      let isCurrentMonth = true;

      if (dayOffset < 0) {
        date = new Date(month.getFullYear(), month.getMonth() - 1, daysInPreviousMonth + dayOffset + 1);
        day = date.getDate();
        isCurrentMonth = false;
      } else if (dayOffset >= daysInMonth) {
        date = new Date(month.getFullYear(), month.getMonth() + 1, dayOffset - daysInMonth + 1);
        day = date.getDate();
        isCurrentMonth = false;
      } else {
        date = new Date(month.getFullYear(), month.getMonth(), dayOffset + 1);
        day = dayOffset + 1;
      }

      const dateKey = this.toDateKey(date);
      days.push({ date: dateKey, day, isCurrentMonth, isToday: dateKey === todayKey });
    }
    return days;
  });

  constructor(@Inject(PLATFORM_ID) private platformId: object, private swPush: SwPush) {
    if (isPlatformBrowser(this.platformId)) {
      // Check for loginAs parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const loginAsId = urlParams.get('loginAs');
      
      if (loginAsId) {
        this.sharedLoginUserId.set(loginAsId);
        // Clear param from URL without refreshing
        const newUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', newUrl);
        void this.loadUsers();
        void this.loadEmpresas();
      } else {
        // On initial load, check if a user was "logged in" from a previous session
        const savedUserId = localStorage.getItem('currentUserId');
        if (savedUserId) {
          // If so, load that user's data and tasks.
          void this.loginById(savedUserId);
        } else {
          void this.loadUsers();
          void this.loadEmpresas();
        }
      }
      this.loadCalendarEvents();
      document.addEventListener('click', this.onDocumentClick.bind(this));
      this.timerIntervalId = setInterval(() => {
        this.timerTick.set(Date.now());
        this.notifyExpiredTasks();
      }, 1000);
      this.notificationIntervalId = setInterval(() => void this.loadNotifications(), 30000);
    } else {
      void this.loadUsers();
      void this.loadEmpresas();
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('click', this.onDocumentClick.bind(this));
      if (this.timerIntervalId) clearInterval(this.timerIntervalId);
      if (this.notificationIntervalId) clearInterval(this.notificationIntervalId);
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

  protected handleLoginSuccess(user: User) {
    this.sharedLoginUserId.set(null);
    this.realUser.set(user);
    this._performLogin(user);
    void this.loadUsers();
    void this.loadEmpresas();
  }

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
    void this.loadNotifications();
    if (user.role === 'admin') {
      void this.registerAdminPushSubscription(user);
    }
    if (user.role === 'admin') {
      void this.loadEmpresas();
    }
    this.isSidebarOpen.set(false);
  }

  private async loadNotifications() {
    const user = this.currentUser();
    if (!user || user.role !== 'admin') return;
    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: { 'x-user-id': user._id }, cache: 'no-cache'
      });
      if (response.ok) this.notifications.set(await response.json());
    } catch {
      // Notification polling must not interrupt the task dashboard.
    }
  }

  protected async markNotificationAsRead(notification: AppNotification) {
    const user = this.currentUser();
    if (!user || notification.read) return;
    await fetch(`${API_BASE}/api/notifications/${notification._id}/read`, {
      method: 'PUT', headers: { 'x-user-id': user._id }
    });
    this.notifications.update(current => current.map(item => item._id === notification._id ? { ...item, read: true } : item));
    setTimeout(() => {
      this.notifications.update(current => current.filter(item => item._id !== notification._id));
    }, 15 * 60 * 1000);
  }

  private async registerAdminPushSubscription(user: User) {
    if (!isPlatformBrowser(this.platformId) || !this.swPush.isEnabled || !('Notification' in window)) return;
    try {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') return;

      const keyResponse = await fetch(`${API_BASE}/api/push/public-key`);
      if (!keyResponse.ok) return;
      const { publicKey } = await keyResponse.json();
      const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user._id },
        body: JSON.stringify(subscription)
      });
    } catch (error) {
      console.warn('No se pudo registrar la suscripción push:', error);
    }
  }


  protected copyShareUrl(user: User) {
    const url = `${window.location.origin}/?loginAs=${user._id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('URL COPIADA AL PORTAPAPELES');
    });
    this.isProfileMenuOpen.set(false);
  }

  protected viewMyTasks(user: User) {
    const url = `${window.location.origin}/tareas/${user._id}`;
    window.open(url, '_blank');
    this.isProfileMenuOpen.set(false);
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
    this.notifications.set([]);
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
      const currentUser = this.currentUser();
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { 'x-user-id': currentUser._id, 'x-user-role': currentUser.role } : {})
        },
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

      this.loadCalendarEvents();
      this.resetForm();
      this.isUserFormVisible.set(false);
    } catch (err) {
      this.error.set(String(err));
    }
  }

  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadCalendarEvents() {
    if (!isPlatformBrowser(this.platformId)) return;
    const storedEvents = localStorage.getItem('task-list-calendar-events');
    if (!storedEvents) return;
    try {
      this.calendarEvents.set(JSON.parse(storedEvents) as CalendarEvent[]);
    } catch {
      localStorage.removeItem('task-list-calendar-events');
    }
  }

  private saveCalendarEvents(events: CalendarEvent[]) {
    this.calendarEvents.set(events);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('task-list-calendar-events', JSON.stringify(events));
    }
  }

  protected eventsForDate(date: string): CalendarEvent[] {
    return this.calendarEvents().filter(event => event.date === date);
  }

  protected calendarDayEventLabel(date: string): string {
    return this.eventsForDate(date).map(event => event.title).join(' | ');
  }

  protected nextCalendarEvent(): CalendarEvent | null {
    const today = this.toDateKey(new Date());
    return this.calendarEvents()
      .filter(event => event.date >= today)
      .sort((first, second) => first.date.localeCompare(second.date))[0] ?? null;
  }

  protected nextCalendarEventLabel(): string {
    const event = this.nextCalendarEvent();
    if (!event) return '';
    const eventDate = new Date(`${event.date}T00:00:00`).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short'
    });
    return `${eventDate}: ${event.title}`;
  }

  protected previousCalendarMonth() {
    const current = this.calendarMonth();
    this.calendarMonth.set(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  protected nextCalendarMonth() {
    const current = this.calendarMonth();
    this.calendarMonth.set(new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  protected goToCurrentMonth() {
    const today = new Date();
    this.calendarMonth.set(new Date(today.getFullYear(), today.getMonth(), 1));
    this.calendarEventDate.set(this.toDateKey(today));
  }

  protected selectCalendarDate(date: string) {
    this.calendarEventDate.set(date);
  }

  protected updateCalendarEventTitle(value: string) {
    this.calendarEventTitle.set(value);
  }

  protected addCalendarEvent(event: Event) {
    event.preventDefault();
    if (this.currentUser()?.role !== 'admin') return;
    const title = this.calendarEventTitle().trim();
    if (!title || !this.calendarEventDate()) return;
    const newEvent: CalendarEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      date: this.calendarEventDate(),
      title
    };
    this.saveCalendarEvents([...this.calendarEvents(), newEvent]);
    this.calendarEventTitle.set('');
  }

  protected removeCalendarEvent(eventId: string) {
    if (this.currentUser()?.role !== 'admin') return;
    this.saveCalendarEvents(this.calendarEvents().filter(event => event.id !== eventId));
  }

  protected editUser(user: User) {
    // Check if this action is coming from the profile menu (editing the current user)
    const isEditingCurrentUser = this.currentUser()?._id === user._id;

    if (isEditingCurrentUser && user.role !== 'admin' && !user.canEditProfile) {
      this.error.set('No tienes permiso para editar tu perfil.');
      return;
    }

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
    this.taskUserSearch.set('');
    this.isUserFilterDropdownOpen.set(false);
  }

  protected updateTaskUserSearch(value: string) {
    this.taskUserSearch.set(value);
  }

  protected updateTaskQuery(value: string) {
    this.taskQuery.set(value);
  }

  protected getUserCompanies(userId: string): string {
    const user = this.users().find(u => u._id === userId);
    if (!user || !user.companies || user.companies.length === 0) return '';
    return user.companies.map(c => c.name).join(', ');
  }

  protected getUserTimerSummary(userId: string): string {
    this.timerTick();
    const activeTimers = this.tasks().filter(task =>
      task.userId?._id === userId && task.timerEndsAt && task.status !== 'completada' && !task.isDeleted
    );
    if (activeTimers.length === 0) return '';
    return `${activeTimers.length} temporizador${activeTimers.length === 1 ? '' : 'es'} activo${activeTimers.length === 1 ? '' : 's'}`;
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

  protected updateTaskTimer(value: string) {
    const timerMinutes = value ? Math.max(0, Number(value)) : null;
    this.taskForm.update(current => ({ ...current, timerMinutes }));
  }

  protected updateTaskTimerPart(part: 'timerDays' | 'timerHours' | 'timerMinutes', value: string) {
    const timerValue = value ? Math.max(0, Number(value)) : null;
    this.taskForm.update(current => ({ ...current, [part]: timerValue }));
  }

  protected async onTaskSubmit(event: Event) {
    event.preventDefault();
    const user = this.currentUser();
    if (!user) return;

    const { name, status, timerDays, timerHours, timerMinutes } = this.taskForm();
    const totalTimerMinutes = (timerDays ?? 0) * 1440 + (timerHours ?? 0) * 60 + (timerMinutes ?? 0);
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

    if (user.role === 'admin') {
      Object.assign(body, { timerMinutes: totalTimerMinutes || null });
      if (totalTimerMinutes > 0) void this.requestNotificationPermission();
    }

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
    this.taskForm.set({ name: '', status: 'ejecutando', userId: this.currentUser()?._id ?? '', timerDays: null, timerHours: null, timerMinutes: null });
    this.isTaskFormVisible.set(true);
    this.error.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected editTask(task: Task) {
    const user = this.currentUser();
    if (!user) return;

    if (task.status === 'completada') {
      this.error.set('Las tareas completadas no se pueden editar.');
      return;
    }

    // Si el usuario no es administrador:
    if (user.role !== 'admin') {
      // Para editar cualquier tarea, necesita el permiso `canEditTask`.
      if (!user.canEditTask) {
        this.error.set('No tienes permiso para editar tareas.');
        return;
      }
    }
    this.editingTask.set(task);
    const totalTimerMinutes = task.timerMinutes ?? 0;
    this.taskForm.set({
      name: task.name,
      status: task.status,
      userId: task.userId._id,
      timerDays: totalTimerMinutes ? Math.floor(totalTimerMinutes / 1440) : null,
      timerHours: totalTimerMinutes ? Math.floor((totalTimerMinutes % 1440) / 60) : null,
      timerMinutes: totalTimerMinutes ? totalTimerMinutes % 60 : null,
    });
    this.isTaskFormVisible.set(false); // Oculta el formulario superior si está abierto
    this.error.set(null);
  }

  protected cancelEditTask() {
    this.editingTask.set(null);
    this.taskForm.set({ name: '', status: 'ejecutando', userId: '', timerDays: null, timerHours: null, timerMinutes: null });
    this.isTaskFormVisible.set(false);
    this.error.set(null);
  }

  protected getTaskTimerLabel(task: Task): string {
    this.timerTick();
    if (!task.timerEndsAt || task.status === 'completada' || task.isDeleted) return '';
    const remainingMs = new Date(task.timerEndsAt).getTime() - Date.now();
    if (remainingMs <= 0) return 'Tiempo agotado';
    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
  }

  private async requestNotificationPermission() {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) return;
    if (Notification.permission === 'default') await Notification.requestPermission();
  }

  private notifyExpiredTasks() {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in window)) return;
    const expiredTasks = this.tasks().filter(task =>
      task.timerEndsAt && task.status !== 'completada' && !task.isDeleted && new Date(task.timerEndsAt).getTime() <= Date.now()
    );

    for (const task of expiredTasks) {
      const notificationKey = `task-timer-notified:${task._id}:${task.timerEndsAt}`;
      if (localStorage.getItem(notificationKey)) continue;
      localStorage.setItem(notificationKey, 'true');
      if (Notification.permission !== 'granted') continue;
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        void navigator.serviceWorker.ready.then(registration => registration.showNotification('Temporizador agotado', {
          body: `La tarea "${task.name}" ha llegado a su límite.`,
          tag: notificationKey,
          icon: '/icons/icon-192.svg'
        }));
      } else {
        new Notification('Temporizador agotado', {
          body: `La tarea "${task.name}" ha llegado a su límite.`
        });
      }
    }
  }

  protected async updateTaskStatus(task: Task, status: Task['status']) {
    if (task.status === status) return;
    const user = this.currentUser();
    if (!user) return; // No debería ocurrir si la UI está bien guardada

    if (task.status === 'completada') {
      this.error.set('Las tareas completadas no se pueden modificar.');
      return;
    }

    // Si el usuario no es administrador:
    if (user.role !== 'admin') {
      if (!user.canEditTask) {
        this.error.set('No tienes permiso para cambiar el estado de la tarea.');
        return;
      }
      if (status === 'ejecutando' && !user.canSetExecuting) {
        this.error.set('No tienes permiso para cambiar la tarea a ejecución.');
        return;
      }
      if (status === 'completada' && !user.canSetCompleted) {
        this.error.set('No tienes permiso para completar la tarea.');
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
      if (user.canSetExecuting) headers['x-user-can-set-executing'] = 'true';
      if (user.canSetCompleted) headers['x-user-can-set-completed'] = 'true';

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
    const user = this.currentUser();
    if (!user) return;

    if (user.role !== 'admin' && !user.canDelete) {
      this.error.set('No tienes permiso para eliminar tareas.');
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar la tarea "${taskToDelete.name}"?`)) {
      return;
    }

    try {
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
      if (!user || (user.role !== 'admin' && !user.canRestoreTask)) {
        return;
      }

      const headers: HeadersInit = {
        'x-user-id': user._id,
        'x-user-role': user.role,
        'Content-Type': 'application/json', // Aseguramos que el servidor sepa que esperamos JSON
      };
      if (user.canRestoreTask) headers['x-user-can-restore'] = 'true';

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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUser()?._id ?? '',
          'x-user-role': this.currentUser()?.role ?? ''
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUser()?._id ?? '',
          'x-user-role': this.currentUser()?.role ?? ''
        },
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUser()?._id ?? '',
          'x-user-role': this.currentUser()?.role ?? ''
        },
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

  protected async toggleTaskPermission(user: User, permission: 'canSetExecuting' | 'canSetCompleted' | 'canRestoreTask') {
    const value = !user[permission];
    try {
      const response = await fetch(`${API_BASE}/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.currentUser()?._id ?? '',
          'x-user-role': this.currentUser()?.role ?? ''
        },
        body: JSON.stringify({ [permission]: value })
      });

      if (!response.ok) throw new Error('No se pudo actualizar el permiso');
      const updatedUser = await response.json();
      this.users.update(current => current.map(item => item._id === updatedUser._id ? updatedUser : item));
      this.permissionsModalUser.set(updatedUser);
      if (this.currentUser()?._id === updatedUser._id) this.currentUser.set(updatedUser);
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

      this.realUser.set(loggedInUser);
      this._performLogin(loggedInUser);
      this.closeLoginModal();
    } catch (err) {
      // Display the error in the modal, removing the "Error: " prefix.
      this.loginError.set(String(err).replace('Error: ', ''));
    }
  }
}
