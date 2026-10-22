import { Routes } from '@angular/router';
import { CadastroProjeto } from './features/projetos/pages/cadastro-projeto';
import { Portfolio } from './features/projetos/pages/portfolio';
import { VisualizarProjeto } from './features/projetos/pages/visualizar-projeto';
import { Cronograma } from './features/cronograma/pages/cronograma';
import { Dashboard } from './features/dashboard/pages/dashboard';
import { Orcamento } from './features/orcamento/pages/orcamento';
import { Objetivos } from './features/objetivos/pages/objetivos';
import { Login } from './features/login/login';
import { Usuarios } from './features/usuarios/pages/usuarios';
import { adminGuard, authGuard, edicaoProjetoGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'cadastro', component: CadastroProjeto, canActivate: [adminGuard] },
      { path: 'portfolio', component: Portfolio },
      { path: 'cronograma', component: Cronograma },
      { path: 'orcamento', component: Orcamento },
      { path: 'objetivos', component: Objetivos },
      { path: 'projeto/:id', component: VisualizarProjeto },
      { path: 'projeto/:id/editar', component: CadastroProjeto, canActivate: [edicaoProjetoGuard] },
      { path: 'usuarios', component: Usuarios, canActivate: [adminGuard] },
    ],
  },
];
