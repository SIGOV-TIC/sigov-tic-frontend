import { FaseProjeto, ProjetoResponse } from '../features/projetos/models/projeto';
import { Meta } from '../features/objetivos/services/meta.service';

// Projeto de um ano (2026), com três fases encadeadas; cada teste muda só o que interessa.
export function projeto(extra: Partial<ProjetoResponse> = {}): ProjetoResponse {
  return {
    id: 'p1',
    nome: 'Implantação do ERP',
    sigla: 'ERP',
    dataInicioPrevista: '2026-01-01',
    dataConclusaoPrevista: '2026-12-31',
    orcamentoEstimado: 1_000_000,
    custoRealizado: 400_000,
    fases: [
      fase({ id: 'f1', nome: 'Planejamento', duracaoMeses: 3, dataInicio: '2026-01-01', dataFim: '2026-03-31', situacao: 'CONCLUIDA', percentual: 100 }),
      fase({ id: 'f2', nome: 'Execução', duracaoMeses: 6, dataInicio: '2026-04-01', dataFim: '2026-09-30', situacao: 'EM_ANDAMENTO', percentual: 50 }),
      fase({ id: 'f3', nome: 'Encerramento', duracaoMeses: 3, dataInicio: '2026-10-01', dataFim: '2026-12-31', situacao: 'PENDENTE', percentual: 0 }),
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

export function fase(extra: Partial<FaseProjeto> = {}): FaseProjeto {
  return { nome: 'Fase', duracaoMeses: 1, ...extra };
}

export function meta(extra: Partial<Meta> = {}): Meta {
  return {
    id: 'm1',
    objetivo: 'OE1',
    indicador: 'Serviços digitais',
    unidade: '%',
    valorInicial: 0,
    valorAlvo: 100,
    valorAtual: 50,
    dataInicio: '2026-01-01',
    prazo: '2026-12-31',
    responsavel: 'Escritório',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...extra,
  };
}

// Meio do dia evita virada de data por fuso.
export function dia(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

// Grava a sessão antes de o AuthService ser criado.
export function entrarComo(perfil: 'ADMIN' | 'ESCRITORIO' | 'GESTOR_PROJETO' | 'USER', id = 'u-' + perfil.toLowerCase(), username = id) {
  localStorage.setItem('sigov_sessao', JSON.stringify({ username, roles: ['ROLE_' + perfil], id, nome: 'Pessoa ' + id, perfil }));
}

// Componentes guardam estado em campos comuns e o app roda sem zone.js: depois de uma resposta, pede um novo desenho.
export async function redesenhar(fixture: { componentRef: { changeDetectorRef: { markForCheck(): void } }; whenStable(): Promise<unknown> }) {
  fixture.componentRef.changeDetectorRef.markForCheck();
  await fixture.whenStable();
}

// Páginas que listam projetos: confere se o banco tem projetos e depois lista.
export function responderListagem(api: import('@angular/common/http/testing').HttpTestingController, projetos: ProjetoResponse[]) {
  const pagina = { content: projetos, page: 0, size: projetos.length, totalElements: projetos.length, totalPages: 1 };
  api.match((r) => r.url === '/api/projetos' && r.params.get('size') === '1').forEach((r) => r.flush({ ...pagina, size: 1 }));
  api.match((r) => r.url === '/api/projetos' && r.params.get('size') !== '1').forEach((r) => r.flush(pagina));
}
