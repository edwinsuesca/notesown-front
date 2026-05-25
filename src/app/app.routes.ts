import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './core/auth/auth.guard';
import { EmptyRouteComponent } from './shared/components/empty-route/empty-route.component';

export const routes: Routes = [
  { path: '', redirectTo: '/app', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'app',
    loadComponent: () => import('./shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'search',
        loadComponent: () => import('./notes/search/search.component').then(m => m.SearchComponent),
      },
      {
        path: 'recent-read',
        loadComponent: () => import('./notes/recents/recents.component').then(m => m.RecentsComponent),
        data: { mode: 'read' },
      },
      {
        path: 'recent-modified',
        loadComponent: () => import('./notes/recents/recents.component').then(m => m.RecentsComponent),
        data: { mode: 'modified' },
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
      },
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      { path: ':bookId', component: EmptyRouteComponent },
      { path: ':bookId/:noteId', component: EmptyRouteComponent },
    ],
  },
  { path: '**', redirectTo: '/app' },
];
