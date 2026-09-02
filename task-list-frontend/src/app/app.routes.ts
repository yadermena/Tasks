import { Routes } from '@angular/router';
import { App } from './app';
import { PublicTasksComponent } from './public-tasks/public-tasks';

export const routes: Routes = [
  { path: '', component: App },
  { path: 'tareas/:userId', component: PublicTasksComponent },
  { path: '**', redirectTo: '' }
];
