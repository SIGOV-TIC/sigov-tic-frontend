import { Routes } from '@angular/router';
import { CadastroProjeto } from './features/projetos/pages/cadastro-projeto';
import { Portfolio } from './features/projetos/pages/portfolio';

export const routes: Routes = [
  { path: '', redirectTo: 'portfolio', pathMatch: 'full' },
  { path: 'cadastro', component: CadastroProjeto },
  { path: 'portfolio', component: Portfolio },
];
