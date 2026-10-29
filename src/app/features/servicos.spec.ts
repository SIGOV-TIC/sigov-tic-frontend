import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MetaService } from './objetivos/services/meta.service';
import { UsuarioService } from './usuarios/services/usuario.service';
import { RetratoService } from './dashboard/services/retrato.service';
import { FeedbackService } from '../core/feedback/feedback.service';

// Rotas e métodos que cada serviço usa na API.
describe('serviços da API', () => {
  let api: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(HttpTestingController);
  });

  afterEach(() => api.verify());

  function espera(metodo: string, url: string) {
    const req = api.expectOne((r) => r.urlWithParams === url);
    expect(req.request.method).toBe(metodo);
    return req;
  }

  it('metas', () => {
    const s = TestBed.inject(MetaService);
    const meta = { objetivo: 'OE1', indicador: 'X', valorInicial: 0, valorAlvo: 10, prazo: '2026-12-31' };
    s.listar().subscribe();
    espera('GET', '/api/metas');
    s.criar(meta).subscribe();
    expect(espera('POST', '/api/metas').request.body).toEqual(meta);
    s.atualizar('m1', meta).subscribe();
    espera('PUT', '/api/metas/m1');
    s.excluir('m1').subscribe();
    espera('DELETE', '/api/metas/m1');
  });

  it('usuários', () => {
    const s = TestBed.inject(UsuarioService);
    const conta = { login: 'ana', nome: 'Ana', perfil: 'USER', ativo: true };
    s.gestores().subscribe();
    espera('GET', '/api/users/gestores');
    s.listar().subscribe();
    espera('GET', '/api/users');
    s.criar({ ...conta, senha: 'segredo1' }).subscribe();
    espera('POST', '/api/users');
    s.atualizar('u1', conta).subscribe();
    expect(espera('PUT', '/api/users/u1').request.body.senha).toBeUndefined();
  });

  it('retratos do painel', () => {
    const s = TestBed.inject(RetratoService);
    s.listar().subscribe();
    espera('GET', '/api/retratos?dias=120');
    s.registrarHoje({ prazoOk: 1, prazoTotal: 2, custoOk: 1, custoTotal: 2, metasOk: 0, metasTotal: 1, alertas: 1 }).subscribe();
    espera('PUT', '/api/retratos/hoje');
  });

  it('feedback leva tela e tema; usuário e data são da API', () => {
    TestBed.inject(FeedbackService).enviar('Ficou ótimo', '/dashboard', 'escuro').subscribe();
    expect(espera('POST', '/api/feedback').request.body).toEqual({ texto: 'Ficou ótimo', tela: '/dashboard', tema: 'escuro' });
  });
});
