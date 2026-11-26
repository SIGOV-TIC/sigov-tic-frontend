import { Routes } from '@angular/router';
import { adminGuard, authGuard, criacaoProjetoGuard, edicaoProjetoGuard, primeiroAcessoGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.Login) },
  { path: 'primeiro-acesso', loadComponent: () => import('./features/primeiro-acesso/primeiro-acesso').then((m) => m.PrimeiroAcesso), canActivate: [primeiroAcessoGuard] },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/pages/dashboard').then((m) => m.Dashboard) },
      { path: 'cadastro', loadComponent: () => import('./features/projetos/pages/cadastro-projeto').then((m) => m.CadastroProjeto), canActivate: [criacaoProjetoGuard] },
      { path: 'portfolio', loadComponent: () => import('./features/projetos/pages/portfolio').then((m) => m.Portfolio) },
      { path: 'cronograma', loadComponent: () => import('./features/cronograma/pages/cronograma').then((m) => m.Cronograma) },
      { path: 'orcamento', loadComponent: () => import('./features/orcamento/pages/orcamento').then((m) => m.Orcamento) },
      { path: 'objetivos', loadComponent: () => import('./features/objetivos/pages/objetivos').then((m) => m.Objetivos) },
      { path: 'status-report', loadComponent: () => import('./features/status-report/pages/status-report').then((m) => m.StatusReport) },
      { path: 'dados', loadComponent: () => import('./features/dados/pages/dados').then((m) => m.Dados) },
      { path: 'projeto/:id', loadComponent: () => import('./features/projetos/pages/visualizar-projeto').then((m) => m.VisualizarProjeto) },
      { path: 'projeto/:id/editar', loadComponent: () => import('./features/projetos/pages/cadastro-projeto').then((m) => m.CadastroProjeto), canActivate: [edicaoProjetoGuard] },
      { path: 'configuracoes', loadComponent: () => import('./features/configuracoes/pages/configuracoes').then((m) => m.Configuracoes) },
      { path: 'solicitacoes', loadComponent: () => import('./features/solicitacoes/pages/solicitacoes').then((m) => m.Solicitacoes) },
      { path: 'usuarios', loadComponent: () => import('./features/usuarios/pages/usuarios').then((m) => m.Usuarios), canActivate: [adminGuard] },
    ],
  },
];
