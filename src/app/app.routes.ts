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
import { Configuracoes } from './features/configuracoes/pages/configuracoes';
import { StatusReport } from './features/status-report/pages/status-report';
import { Dados } from './features/dados/pages/dados';
import { PrimeiroAcesso } from './features/primeiro-acesso/primeiro-acesso';
import { adminGuard, authGuard, criacaoProjetoGuard, edicaoProjetoGuard, primeiroAcessoGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  { path: 'primeiro-acesso', component: PrimeiroAcesso, canActivate: [primeiroAcessoGuard] },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'cadastro', component: CadastroProjeto, canActivate: [criacaoProjetoGuard] },
      { path: 'portfolio', component: Portfolio },
      { path: 'cronograma', component: Cronograma },
      { path: 'orcamento', component: Orcamento },
      { path: 'objetivos', component: Objetivos },
      { path: 'status-report', component: StatusReport },
      { path: 'dados', component: Dados },
      { path: 'projeto/:id', component: VisualizarProjeto },
      { path: 'projeto/:id/editar', component: CadastroProjeto, canActivate: [edicaoProjetoGuard] },
      { path: 'configuracoes', component: Configuracoes },
      { path: 'usuarios', component: Usuarios, canActivate: [adminGuard] },
    ],
  },
];
