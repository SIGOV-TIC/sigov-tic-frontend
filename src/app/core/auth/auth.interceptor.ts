import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { respostasApi } from './respostas';

// Mesmo código que a API manda enquanto a conta tem senha temporária.
export const TROCA_SENHA_OBRIGATORIA = 'TROCA_SENHA_OBRIGATORIA';

// Envia o cookie de sessão e, se a API recusar, volta para o login.
// Recusa por senha temporária não encerra a sessão: leva à tela de troca.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req.clone({ withCredentials: true })).pipe(
    catchError((erro: HttpErrorResponse) => {
      if (erro.status === 403 && erro.error?.codigo === TROCA_SENHA_OBRIGATORIA) {
        auth.exigirTrocaSenha();
        if (!router.url.startsWith('/primeiro-acesso')) {
          router.navigate(['/primeiro-acesso'], { queryParams: { voltar: router.url } });
        }
      } else if ((erro.status === 401 || erro.status === 403) && !req.url.includes('/api/auth/')) {
        auth.encerrar();
        router.navigate(['/login'], { queryParams: { voltar: router.url } });
      }
      return throwError(() => erro);
    }),
    finalize(() => respostasApi.update((n) => n + 1)),
  );
};
