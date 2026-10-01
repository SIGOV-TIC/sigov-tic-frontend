import { Routes } from '@angular/router';
import { CadastroProjeto } from './features/projetos/pages/cadastro-projeto';
import { Portfolio } from './features/projetos/pages/portfolio';
import { VisualizarProjeto } from './features/projetos/pages/visualizar-projeto';
import { Dashboard } from './features/dashboard/pages/dashboard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'cadastro', component: CadastroProjeto },
  { path: 'portfolio', component: Portfolio },
  { path: 'projeto/:id', component: VisualizarProjeto },
];
