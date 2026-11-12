import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const sessao = inject(AuthService).sessao();
  if (!sessao) return inject(Router).createUrlTree(['/login'], { queryParams: { voltar: state.url } });
  // Senha temporária: nenhuma tela abre antes da troca.
  if (sessao.trocaSenhaObrigatoria) {
    return inject(Router).createUrlTree(['/primeiro-acesso'], { queryParams: { voltar: state.url } });
  }
  return true;
};

// Tela de primeiro acesso: só para quem está logado com senha temporária.
export const primeiroAcessoGuard: CanActivateFn = () => {
  const sessao = inject(AuthService).sessao();
  if (!sessao) return inject(Router).createUrlTree(['/login']);
  if (!sessao.trocaSenhaObrigatoria) return inject(Router).createUrlTree(['/dashboard']);
  return true;
};

// Destino depois do login ou da troca de senha: só caminhos internos, nunca de volta ao login.
export function destinoSeguro(voltar: string | null): string {
  return voltar && voltar.startsWith('/') && !voltar.startsWith('//') && !voltar.startsWith('/login') && !voltar.startsWith('/primeiro-acesso')
    ? voltar
    : '/dashboard';
}

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
