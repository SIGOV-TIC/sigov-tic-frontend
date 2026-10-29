import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { VisualizarProjeto } from './visualizar-projeto';
import { ProjetoResponse } from '../models/projeto';
import { entrarComo, projeto, redesenhar } from '../../../testing/dados';

function comPapeis(): ProjetoResponse {
  return projeto({
    po: { id: 'u-po', nome: 'Ana' },
    scrumMaster: { id: 'u-sm', nome: 'Thiago' },
    pontoAtencao: 'Fornecedor atrasado',
    recomendacao: 'Manter o cutover',
    atualizacoes: [
      { id: 'a1', data: '2026-06-10', texto: 'Homologação concluída', autor: 'Ana' },
      { id: 'a2', data: '2026-05-02', texto: 'Kickoff', autor: 'Thiago' },
    ],
  });
}

async function abrir(perfil: 'ESCRITORIO' | 'GESTOR_PROJETO' | 'USER', id: string) {
  entrarComo(perfil, id);
  TestBed.configureTestingModule({
    imports: [VisualizarProjeto],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
    ],
  });
  const fixture = TestBed.createComponent(VisualizarProjeto);
  const api = TestBed.inject(HttpTestingController);
  await fixture.whenStable();
  api.expectOne('/api/projetos/p1').flush(comPapeis());
  await redesenhar(fixture);
  const tela = fixture.componentInstance;
  const el = fixture.nativeElement as HTMLElement;
  const texto = () => el.textContent ?? '';
  return { fixture, api, tela, el, texto };
}

describe('Tela do projeto', () => {
  afterEach(() => localStorage.clear());

  describe('o que cada perfil vê', () => {
    it('Escritório edita tudo: botão Editar, recomendação e acompanhamento', async () => {
      const { tela, el } = await abrir('ESCRITORIO', 'u-pmo');
      expect(tela.podeEditar).toBe(true);
      expect(tela.podeAcompanhar).toBe(true);
      expect(el.querySelector('a[href="/projeto/p1/editar"]')).not.toBeNull();
      expect(el.querySelector('[aria-label="Editar Recomendação"]')).not.toBeNull();
    });

    it('PO acompanha: atualizações e ponto de atenção, sem Editar nem recomendação', async () => {
      const { tela, el } = await abrir('GESTOR_PROJETO', 'u-po');
      expect(tela.podeEditar).toBe(false);
      expect(tela.podeAcompanhar).toBe(true);
      expect(el.querySelector('a[href="/projeto/p1/editar"]')).toBeNull();
      expect(el.querySelector('[aria-label="Editar Recomendação"]')).toBeNull();
      expect(el.querySelector('[aria-label="Editar Ponto de Atenção"]')).not.toBeNull();
      expect(el.querySelector('[aria-label="Registrar atualização"]')).not.toBeNull();
    });

    it('gestor de outro projeto e visualizador só leem', async () => {
      for (const [perfil, id] of [['GESTOR_PROJETO', 'u-outro'], ['USER', 'u-leitor']] as const) {
        TestBed.resetTestingModule();
        const { tela, el, texto } = await abrir(perfil, id);
        expect(tela.podeAcompanhar).toBe(false);
        expect(el.querySelectorAll('.btn-icone')).toHaveLength(0);
        expect(texto()).toContain('Homologação concluída');
      }
    });
  });

  it('atualizações aparecem com data e autor, mais recente primeiro', async () => {
    const { el } = await abrir('USER', 'u-leitor');
    const itens = [...el.querySelectorAll('.atu-lista li')].map((li) => li.textContent!.replace(/\s+/g, ' ').trim());
    expect(itens[0]).toContain('10/06/2026');
    expect(itens[0]).toContain('Homologação concluída');
    expect(itens[0]).toContain('Ana');
    expect(itens[1]).toContain('Kickoff');
  });

  describe('gravação', () => {
    it('PO grava o ponto de atenção pelo acompanhamento, só com o andamento das fases', async () => {
      const { tela, api } = await abrir('GESTOR_PROJETO', 'u-po');
      tela.editarCampo('pontoAtencao');
      tela.textoEdicao = '  Novo risco  ';
      tela.salvarCampo();
      const req = api.expectOne('/api/projetos/p1/acompanhamento');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.pontoAtencao).toBe('Novo risco');
      expect(req.request.body.fases[1]).toEqual({ id: 'f2', situacao: 'EM_ANDAMENTO', percentual: 50, dataInicio: '2026-04-01', dataFim: '2026-09-30' });
      expect(Object.keys(req.request.body)).toEqual(['pontoAtencao', 'fases']);
    });

    it('Escritório grava o projeto inteiro', async () => {
      const { tela, api } = await abrir('ESCRITORIO', 'u-pmo');
      tela.editarCampo('recomendacao');
      tela.textoEdicao = 'Replanejar';
      tela.salvarCampo();
      const req = api.expectOne('/api/projetos/p1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.recomendacao).toBe('Replanejar');
    });

    it('concluir a fase libera a seguinte', async () => {
      const { tela, api } = await abrir('GESTOR_PROJETO', 'u-po');
      tela.concluirFase(1);
      const fases = api.expectOne('/api/projetos/p1/acompanhamento').request.body.fases;
      expect(fases[1]).toMatchObject({ situacao: 'CONCLUIDA', percentual: 100 });
      expect(fases[2]).toMatchObject({ situacao: 'EM_ANDAMENTO' });
    });

    it('fase sem data de fim ou com fim antes do início não é salva', async () => {
      const { tela, api } = await abrir('GESTOR_PROJETO', 'u-po');
      tela.abrirFase(1, { currentTarget: { querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }) }) } } as never);
      tela.editarFase();
      tela.rascunhoFase!.dataFim = '';
      tela.salvarFase();
      expect(tela.erroFase).toBe('Informe a data de fim da fase.');
      tela.rascunhoFase!.dataFim = '2026-01-01';
      tela.salvarFase();
      expect(tela.erroFase).toBe('A data de fim precisa ser posterior à data de início.');
      api.expectNone('/api/projetos/p1/acompanhamento');
    });

    it('percentual da fase é limitado a 0–100', async () => {
      const { tela } = await abrir('GESTOR_PROJETO', 'u-po');
      const f = { nome: 'X', duracaoMeses: 1, percentual: 140 };
      tela.ajustarPercentual(f);
      expect(f.percentual).toBe(100);
      f.percentual = Number.NaN;
      tela.ajustarPercentual(f);
      expect(f.percentual).toBe(0);
    });
  });

  describe('atualizações', () => {
    it('registra com a data escolhida e mantém a ordem por data', async () => {
      const { tela, api } = await abrir('GESTOR_PROJETO', 'u-po');
      tela.abrirNovaAtualizacao();
      tela.novaAtualizacao!.texto = ' Contrato aditivado ';
      tela.novaAtualizacao!.data = '2026-05-20';
      tela.registrarAtualizacao();
      const req = api.expectOne('/api/projetos/p1/atualizacoes');
      expect(req.request.body).toEqual({ texto: 'Contrato aditivado', data: '2026-05-20' });
      req.flush({ id: 'a3', data: '2026-05-20', texto: 'Contrato aditivado', autor: 'Ana' });
      expect(tela.projeto.atualizacoes!.map((a) => a.id)).toEqual(['a1', 'a3', 'a2']);
      expect(tela.novaAtualizacao).toBeNull();
    });

    it('texto vazio não é enviado', async () => {
      const { tela, api } = await abrir('GESTOR_PROJETO', 'u-po');
      tela.abrirNovaAtualizacao();
      tela.novaAtualizacao!.texto = '   ';
      tela.registrarAtualizacao();
      api.expectNone('/api/projetos/p1/atualizacoes');
    });

    it('remove da lista quando a API confirma', async () => {
      const { tela, api } = await abrir('GESTOR_PROJETO', 'u-po');
      tela.removerAtualizacao('a2');
      api.expectOne('/api/projetos/p1/atualizacoes/a2').flush(null);
      expect(tela.projeto.atualizacoes!.map((a) => a.id)).toEqual(['a1']);
    });
  });

  describe('atividades da fase', () => {
    async function naFase() {
      const ctx = await abrir('GESTOR_PROJETO', 'u-po');
      ctx.tela.faseSelecionada = 1;
      return ctx;
    }

    it('cria pendente, sem campos em branco', async () => {
      const { tela, api } = await naFase();
      tela.novaAtividade();
      tela.rascunhoAtividade!.titulo = ' Testes integrados ';
      tela.salvarAtividade();
      const req = api.expectOne('/api/projetos/p1/fases/f2/atividades');
      expect(req.request.body).toEqual({ titulo: 'Testes integrados', responsavel: null, prazo: null, percentual: null, situacao: 'PENDENTE' });
      req.flush({ id: 't1', titulo: 'Testes integrados', situacao: 'PENDENTE' });
      expect(tela.faseAberta!.atividades!.map((a) => a.id)).toEqual(['t1']);
      expect(tela.rascunhoAtividade).toBeNull();
    });

    it('concluir com um clique grava 100% e reabrir volta para em andamento', async () => {
      const { tela, api } = await naFase();
      tela.faseAberta!.atividades = [{ id: 't1', titulo: 'Deploy', situacao: 'EM_ANDAMENTO', percentual: 40 }];
      tela.alternarConclusao(tela.faseAberta!.atividades[0]);
      const req = api.expectOne('/api/projetos/p1/fases/f2/atividades/t1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toMatchObject({ situacao: 'CONCLUIDA', percentual: 100 });
      req.flush({ id: 't1', titulo: 'Deploy', situacao: 'CONCLUIDA', percentual: 100 });
      expect(tela.faseAberta!.atividades![0].situacao).toBe('CONCLUIDA');

      tela.alternarConclusao(tela.faseAberta!.atividades![0]);
      expect(api.expectOne('/api/projetos/p1/fases/f2/atividades/t1').request.body).toMatchObject({ situacao: 'EM_ANDAMENTO', percentual: null });
    });

    it('remove a atividade', async () => {
      const { tela, api } = await naFase();
      tela.faseAberta!.atividades = [{ id: 't1', titulo: 'Deploy', situacao: 'PENDENTE' }];
      tela.removerAtividade(tela.faseAberta!.atividades[0]);
      expect(api.expectOne('/api/projetos/p1/fases/f2/atividades/t1').request.method).toBe('DELETE');
    });

    it('atrasada é a não concluída com prazo vencido', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 6, 1, 12));
      const { tela } = await naFase();
      expect(tela.atividadeAtrasada({ id: 'a', titulo: 'x', situacao: 'PENDENTE', prazo: '2026-06-30' })).toBe(true);
      expect(tela.atividadeAtrasada({ id: 'b', titulo: 'x', situacao: 'CONCLUIDA', prazo: '2026-06-30' })).toBe(false);
      expect(tela.atividadeAtrasada({ id: 'c', titulo: 'x', situacao: 'PENDENTE', prazo: '2026-07-01' })).toBe(false);
      vi.useRealTimers();
    });

    it('falha ao salvar avisa e mantém o formulário', async () => {
      const { tela, api } = await naFase();
      tela.novaAtividade();
      tela.rascunhoAtividade!.titulo = 'Deploy';
      tela.salvarAtividade();
      api.expectOne('/api/projetos/p1/fases/f2/atividades').flush(null, { status: 500, statusText: 'Erro' });
      expect(tela.rascunhoAtividade).not.toBeNull();
    });
  });

  it('erro ao carregar mostra a mensagem de falha', async () => {
    entrarComo('USER', 'u1');
    TestBed.configureTestingModule({
      imports: [VisualizarProjeto],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'p1' }) } } },
      ],
    });
    const fixture = TestBed.createComponent(VisualizarProjeto);
    await fixture.whenStable();
    TestBed.inject(HttpTestingController).expectOne('/api/projetos/p1').flush(null, { status: 404, statusText: 'x' });
    await redesenhar(fixture);
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os dados');
  });
});
