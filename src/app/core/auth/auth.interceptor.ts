import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { respostasApi } from './respostas';

// Envia o cookie de sessão e, se a API recusar, volta para o login.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req.clone({ withCredentials: true })).pipe(
    catchError((erro: HttpErrorResponse) => {
      if ((erro.status === 401 || erro.status === 403) && !req.url.includes('/api/auth/')) {
        auth.encerrar();
        router.navigate(['/login'], { queryParams: { voltar: router.url } });
      }
      return throwError(() => erro);
    }),
    finalize(() => respostasApi.update((n) => n + 1)),
  );
};
