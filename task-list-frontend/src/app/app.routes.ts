import { Routes } from '@angular/router';
import { App } from './app';
import { PublicTasksComponent } from './public-tasks/public-tasks';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: App, data: { adminView: 'users' } },
  { path: 'tareas', pathMatch: 'full', component: App, data: { adminView: 'tasks' } },
  { path: 'tareas/estado/ejecutando', pathMatch: 'full', component: App, data: { adminView: 'tasks', filterStatus: 'ejecutando' } },
  { path: 'tareas/estado/acumulada', pathMatch: 'full', component: App, data: { adminView: 'tasks', filterStatus: 'acumulada' } },
  { path: 'tareas/estado/completada', pathMatch: 'full', component: App, data: { adminView: 'tasks', filterStatus: 'completada' } },
  { path: 'tareas/estado/eliminadas', pathMatch: 'full', component: App, data: { adminView: 'tasks', filterStatus: 'eliminadas' } },
  { path: 'usuarios', pathMatch: 'full', component: App, data: { adminView: 'users' } },
  { path: 'empresas', pathMatch: 'full', component: App, data: { adminView: 'empresas' } },
  { path: 'configuraciones', pathMatch: 'full', component: App, data: { adminView: 'configuraciones' } },
  { path: 'tareas/:userId', component: PublicTasksComponent, pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
