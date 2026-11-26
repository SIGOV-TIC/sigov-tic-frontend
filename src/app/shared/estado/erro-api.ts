import { HttpErrorResponse } from '@angular/common/http';

// Mensagem para quem está olhando a tela, conforme o que realmente falhou.
// `oQue` completa a frase: "Não foi possível carregar {oQue}".
export function mensagemDeErro(erro: unknown, oQue = 'os dados'): string {
  const status = erro instanceof HttpErrorResponse ? erro.status : undefined;
  if (status === 0) return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 403) return `Você não tem permissão para ver ${oQue}.`;
  if (status === 404) return `Não encontramos ${oQue}.`;
  if (status !== undefined && status >= 500) return 'O servidor teve um problema. Tente de novo em instantes.';
  return `Não foi possível carregar ${oQue}. Tente de novo.`;
}
