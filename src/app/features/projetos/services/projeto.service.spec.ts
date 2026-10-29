import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjetoService } from './projeto.service';
import { PROJETOS_EXEMPLO } from './projetos-exemplo';

describe('ProjetoService', () => {
  let service: ProjetoService;
  let api: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjetoService);
    api = TestBed.inject(HttpTestingController);
  });

  afterEach(() => api.verify());

  it('lista paginado, com no máximo 100 por página', () => {
    service.listar(2, 500).subscribe();
    const req = api.expectOne((r) => r.url === '/api/projetos');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('100');
  });

  it('Escritório grava o projeto inteiro com PUT', () => {
    service.atualizar('p1', { nome: 'ERP', sigla: 'ERP' }).subscribe();
    expect(api.expectOne('/api/projetos/p1').request.method).toBe('PUT');
  });

  it('PO grava o acompanhamento com PATCH', () => {
    const corpo = { pontoAtencao: 'Atraso', fases: [{ id: 'f1', percentual: 40 }] };
    service.atualizarAcompanhamento('p1', corpo).subscribe();
    const req = api.expectOne('/api/projetos/p1/acompanhamento');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(corpo);
  });

  it('atualização sem data deixa a API usar o dia de hoje', () => {
    service.registrarAtualizacao('p1', 'Kickoff').subscribe();
    const req = api.expectOne('/api/projetos/p1/atualizacoes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ texto: 'Kickoff', data: null });
    service.removerAtualizacao('p1', 'a1').subscribe();
    expect(api.expectOne('/api/projetos/p1/atualizacoes/a1').request.method).toBe('DELETE');
  });

  it('atividades ficam sob a fase', () => {
    const atividade = { titulo: 'Testes' };
    service.criarAtividade('p1', 'f2', atividade).subscribe();
    expect(api.expectOne('/api/projetos/p1/fases/f2/atividades').request.method).toBe('POST');
    service.salvarAtividade('p1', 'f2', 't1', atividade).subscribe();
    expect(api.expectOne('/api/projetos/p1/fases/f2/atividades/t1').request.method).toBe('PUT');
    service.removerAtividade('p1', 'f2', 't1').subscribe();
    expect(api.expectOne('/api/projetos/p1/fases/f2/atividades/t1').request.method).toBe('DELETE');
  });

  describe('projetos de exemplo', () => {
    const pagina = (total: number) => ({ content: [], page: 0, size: 1, totalElements: total, totalPages: 1 });

    it('banco com projetos: não grava nada e lista uma vez só', () => {
      service.seedSeNecessario();
      service.listar().subscribe();
      api.expectOne((r) => r.url === '/api/projetos' && r.params.get('size') === '1').flush(pagina(3));
      api.expectOne((r) => r.url === '/api/projetos' && r.params.get('size') === '20').flush(pagina(3));
    });

    it('banco vazio: grava os exemplos antes de listar', () => {
      service.seedSeNecessario();
      service.listar().subscribe();
      api.expectOne((r) => r.params.get('size') === '1').flush(pagina(0));
      for (let i = 0; i < PROJETOS_EXEMPLO.length; i++) {
        const req = api.expectOne((r) => r.method === 'POST');
        req.flush({ ...req.request.body, id: `p${i}` });
      }
      api.expectOne((r) => r.method === 'GET' && r.params.get('size') === '20').flush(pagina(PROJETOS_EXEMPLO.length));
    });

    it('falha na verificação permite tentar de novo', () => {
      service.seedSeNecessario();
      service.listar().subscribe({ error: () => undefined });
      api.expectOne((r) => r.params.get('size') === '1').flush(null, { status: 500, statusText: 'Erro' });
      service.seedSeNecessario();
      service.listar().subscribe();
      api.expectOne((r) => r.params.get('size') === '1').flush(pagina(1));
      api.expectOne((r) => r.params.get('size') === '20').flush(pagina(1));
    });
  });
});
