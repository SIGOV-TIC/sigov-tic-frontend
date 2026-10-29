import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).sessao()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { voltar: state.url } });
};

// Páginas de administração: quem não é admin volta ao Dashboard.
export const adminGuard: CanActivateFn = () => {
  if (inject(AuthService).ehAdmin()) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

// Cadastro de projeto: só o Escritório de Projetos.
export const criacaoProjetoGuard: CanActivateFn = () => {
  if (inject(AuthService).pode('criarProjeto')) return true;
  return inject(Router).createUrlTree(['/portfolio']);
};

// Edição de todos os campos do projeto: só o Escritório de Projetos. Os demais voltam à tela do projeto.
export const edicaoProjetoGuard: CanActivateFn = (route) => {
  if (inject(AuthService).pode('editarProjeto')) return true;
  return inject(Router).createUrlTree(['/projeto', route.paramMap.get('id')]);
};
