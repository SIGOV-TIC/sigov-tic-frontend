import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { CadastroProjeto } from './cadastro-projeto';
import { entrarComo, fase, projeto } from '../../../testing/dados';

async function abrir(id?: string) {
  entrarComo('ESCRITORIO', 'u-pmo');
  TestBed.configureTestingModule({
    imports: [CadastroProjeto],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
    ],
  });
  const fixture = TestBed.createComponent(CadastroProjeto);
  const api = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  await fixture.whenStable();
  api.expectOne('/api/users/gestores').flush([
    { id: 'u-ana', nome: 'Ana', login: 'ana', perfil: 'GESTOR_PROJETO', ativo: true },
    { id: 'u-bia', nome: 'Bia', login: 'bia', perfil: 'GESTOR_PROJETO', ativo: true },
  ]);
  return { tela: fixture.componentInstance, api, router, fixture };
}

describe('Cadastro de projeto', () => {
  afterEach(() => localStorage.clear());

  it('aponta os obrigatórios que faltam', async () => {
    const { tela } = await abrir();
    expect(tela.validarEtapas()).toEqual(['Nome do Projeto', 'Sigla', 'Área Solicitante', 'Descrição']);
    tela.concluirEtapas();
    expect(tela.etapasConcluidas).toBe(false);
    Object.assign(tela.projeto, { nome: 'ERP', sigla: 'ERP', areaSolicitante: 'DTI', descricao: 'Unificar' });
    tela.concluirEtapas();
    expect(tela.etapasConcluidas).toBe(true);
    expect(tela.prontoParaSalvar).toBe(true);
  });

  describe('fases', () => {
    it('cada fase começa no dia seguinte ao fim da anterior', async () => {
      const { tela } = await abrir();
      tela.projeto.dataInicioPrevista = '2026-01-01';
      tela.novaFase = { nome: 'Planejamento', duracaoMeses: 1, dataFim: '2026-03-31' };
      tela.adicionarFase();
      tela.novaFase = { nome: ' Execução ', duracaoMeses: 1, dataFim: '2026-09-30' };
      tela.adicionarFase();
      expect(tela.projeto.fases).toEqual([
        { nome: 'Planejamento', duracaoMeses: 3, dataInicio: '2026-01-01', dataFim: '2026-03-31' },
        { nome: 'Execução', duracaoMeses: 6, dataInicio: '2026-04-01', dataFim: '2026-09-30' },
      ]);
      expect(tela.novaFase.nome).toBe('');
    });

    it('recusa fase sem nome, sem fim ou terminando antes de começar', async () => {
      const { tela } = await abrir();
      tela.projeto.dataInicioPrevista = '2026-01-01';
      tela.novaFase = { nome: '', duracaoMeses: 1, dataFim: '2026-02-01' };
      tela.adicionarFase();
      expect(tela.erroFase).toBe('Informe o nome e a data de fim da fase.');
      tela.novaFase = { nome: 'X', duracaoMeses: 1, dataFim: '2025-12-01' };
      tela.adicionarFase();
      expect(tela.erroFase).toBe('A data de fim precisa ser a partir de 01/01/2026.');
      expect(tela.projeto.fases).toHaveLength(0);
    });

    it('fase sem data de fim bloqueia o envio', async () => {
      const { tela } = await abrir();
      tela.projeto.fases = [fase({ nome: 'Antiga' })];
      expect(tela.validarEtapas()).toContain('Data de fim das fases');
    });
  });

  it('enviar para aprovação cria com o status certo e volta ao Portfólio', async () => {
    const { tela, api, router } = await abrir();
    Object.assign(tela.projeto, { nome: 'ERP', sigla: 'ERP', poId: 'u-ana' });
    tela.confirmarSalvar();
    const req = api.expectOne('/api/projetos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({ status: 'AGUARDANDO_APROVACAO', poId: 'u-ana' });
    req.flush({ id: 'novo' });
    expect(router.navigate).toHaveBeenCalledWith(['/portfolio']);
  });

  it('rascunho grava com status de rascunho', async () => {
    const { tela, api } = await abrir();
    Object.assign(tela.projeto, { nome: 'ERP', sigla: 'ERP' });
    tela.salvarRascunho();
    expect(api.expectOne('/api/projetos').request.body.status).toBe('RASCUNHO');
  });

  describe('edição', () => {
    it('carrega o projeto, mantém o id das fases e o PO como opção mesmo se a conta saiu da lista', async () => {
      const { tela, api } = await abrir('p1');
      api.expectOne('/api/projetos/p1').flush(projeto({ po: { id: 'u-antigo', nome: 'Carlos' }, scrumMaster: null }));
      expect(tela.modoEdicao).toBe(true);
      expect(tela.projeto.poId).toBe('u-antigo');
      expect(tela.projeto.fases!.map((f) => f.id)).toEqual(['f1', 'f2', 'f3']);
      expect(tela.opcoesGestor.map((g) => g.nome)).toEqual(['Ana', 'Bia', 'Carlos']);
      expect(tela.nomeGestor('u-antigo')).toBe('Carlos');
      expect('id' in tela.projeto).toBe(false);
    });

    it('fases antigas sem fim recebem as datas planejadas', async () => {
      const { tela, api } = await abrir('p1');
      api.expectOne('/api/projetos/p1').flush(projeto({ fases: [fase({ nome: 'A', duracaoMeses: 2 })] }));
      expect(tela.projeto.fases![0]).toMatchObject({ dataInicio: '2026-01-01', dataFim: '2026-02-28' });
    });

    it('salvar com pendência leva à etapa do campo; sem pendência grava e volta ao projeto', async () => {
      const { tela, api, router } = await abrir('p1');
      api.expectOne('/api/projetos/p1').flush(projeto({ areaSolicitante: 'DTI', descricao: '' }));
      tela.etapaAtual = 4;
      tela.salvarEdicao();
      expect(tela.etapaAtual).toBe(2);
      api.expectNone('/api/projetos/p1');

      tela.projeto.descricao = 'Unificar sistemas';
      tela.salvarEdicao();
      const req = api.expectOne('/api/projetos/p1');
      expect(req.request.method).toBe('PUT');
      req.flush({});
      expect(router.navigate).toHaveBeenCalledWith(['/projeto', 'p1']);
    });
  });

  it('orçamento não fica negativo', async () => {
    const { tela } = await abrir();
    tela.ajustarOrcamento(-1000);
    expect(tela.projeto.orcamentoEstimado).toBe(0);
    tela.ajustarOrcamento(50_000);
    expect(tela.projeto.orcamentoEstimado).toBe(50_000);
  });

  it('busca nas sugestões ignora maiúsculas', async () => {
    const { tela } = await abrir();
    expect(tela.filtrar('lgpd', tela.nomes)).toEqual(['Adequação à LGPD']);
    expect(tela.filtrar('', tela.siglas)).toBe(tela.siglas);
  });
});
