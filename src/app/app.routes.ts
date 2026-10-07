import { Routes } from '@angular/router';
import { CadastroProjeto } from './features/projetos/pages/cadastro-projeto';
import { Portfolio } from './features/projetos/pages/portfolio';
import { VisualizarProjeto } from './features/projetos/pages/visualizar-projeto';
import { Cronograma } from './features/cronograma/pages/cronograma';
import { Dashboard } from './features/dashboard/pages/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'cadastro', component: CadastroProjeto },
  { path: 'portfolio', component: Portfolio },
  { path: 'cronograma', component: Cronograma },
  { path: 'projeto/:id', component: VisualizarProjeto },
  { path: 'projeto/:id/editar', component: CadastroProjeto },
];
