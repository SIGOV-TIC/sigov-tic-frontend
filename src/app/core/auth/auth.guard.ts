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
