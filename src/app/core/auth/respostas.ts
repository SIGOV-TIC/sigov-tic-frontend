import { signal } from '@angular/core';

// Conta respostas da API. O App lê este signal, então cada resposta agenda a atualização da tela
// (o app roda sem zone.js e as páginas guardam estado em campos comuns).
export const respostasApi = signal(0);
