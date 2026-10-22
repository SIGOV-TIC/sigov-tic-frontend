import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';
import { ProjetoService } from '../../features/projetos/services/projeto.service';

export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).sessao()) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { voltar: state.url } });
};

// Páginas de administração: quem não é admin volta ao Dashboard.
export const adminGuard: CanActivateFn = () => {
  if (inject(AuthService).ehAdmin()) return true;
  return inject(Router).createUrlTree(['/dashboard']);
};

// Edição de projeto: admin, ou PO e Scrum Master do próprio projeto. Os demais voltam à tela do projeto.
export const edicaoProjetoGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.ehAdmin()) return true;
  const id = route.paramMap.get('id')!;
  const telaDoProjeto = router.createUrlTree(['/projeto', id]);
  return inject(ProjetoService)
    .obter(id)
    .pipe(
      map((p) => (auth.pode('editarProjeto', p) ? true : telaDoProjeto)),
      catchError(() => of(telaDoProjeto)),
    );
};
