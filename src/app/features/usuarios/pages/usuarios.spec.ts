import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Usuarios } from './usuarios';
import { Usuario } from '../services/usuario.service';
import { entrarComo } from '../../../testing/dados';

const contas: Usuario[] = [
  { id: 'u1', login: 'admin', nome: 'Zélia Admin', perfil: 'ADMIN', ativo: true },
  { id: 'u2', login: 'ana', nome: 'Ana', perfil: 'GESTOR_PROJETO', ativo: true },
  { id: 'u3', login: 'bruno', nome: 'Bruno', perfil: 'GESTOR_PROJETO', ativo: false },
  { id: 'u4', login: 'carla', nome: 'Carla', perfil: 'USER', ativo: true },
];

describe('Usuários', () => {
  let tela: Usuarios;
  let api: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<Usuarios>>;

  beforeEach(async () => {
    entrarComo('ADMIN', 'u1', 'admin');
    TestBed.configureTestingModule({ imports: [Usuarios], providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(Usuarios);
    tela = fixture.componentInstance;
    api = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    api.expectOne('/api/users').flush(contas);
    fixture.componentRef.changeDetectorRef.markForCheck();
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  it('lista ativas primeiro, por nome, e conta gestores ativos', () => {
    expect(tela.lista.map((u) => u.login)).toEqual(['ana', 'carla', 'admin', 'bruno']);
    expect(tela.totalAtivas).toBe(3);
    expect(tela.gestoresAtivos).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Carla');
  });

  it('reconhece a própria conta', () => {
    expect(tela.ehVoce(contas[0])).toBe(true);
    expect(tela.ehVoce(contas[1])).toBe(false);
  });

  it('conta nova precisa de nome, login e senha de 6 caracteres', () => {
    tela.novaConta();
    tela.salvar();
    expect(tela.erroEdicao).toBe('Preencha nome e login.');
    Object.assign(tela.edicao!, { nome: 'Dani', login: 'dani' });
    tela.salvar();
    expect(tela.erroEdicao).toBe('Defina uma senha inicial.');
    tela.edicao!.senha = '123';
    tela.salvar();
    expect(tela.erroEdicao).toBe('A senha precisa ter pelo menos 6 caracteres.');
    api.expectNone('/api/users');
  });

  it('cria a conta e acrescenta à lista', () => {
    tela.novaConta();
    Object.assign(tela.edicao!, { nome: ' Dani ', login: ' dani ', senha: 'segredo1' });
    tela.salvar();
    const req = api.expectOne('/api/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Dani', login: 'dani', perfil: 'GESTOR_PROJETO', ativo: true, senha: 'segredo1' });
    req.flush({ id: 'u5', login: 'dani', nome: 'Dani', perfil: 'GESTOR_PROJETO', ativo: true });
    expect(tela.usuarios).toHaveLength(5);
    expect(tela.edicao).toBeNull();
  });

  it('editar sem trocar senha não envia senha', () => {
    tela.editar(contas[1]);
    tela.edicao!.perfil = 'ESCRITORIO';
    tela.salvar();
    const req = api.expectOne('/api/users/u2');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.senha).toBeUndefined();
    req.flush({ ...contas[1], perfil: 'ESCRITORIO' });
    expect(tela.usuarios.find((u) => u.id === 'u2')!.perfil).toBe('ESCRITORIO');
  });

  it('login repetido avisa sem fechar o painel', () => {
    tela.novaConta();
    Object.assign(tela.edicao!, { nome: 'Ana 2', login: 'ana', senha: 'segredo1' });
    tela.salvar();
    api.expectOne('/api/users').flush(null, { status: 409, statusText: 'Conflito' });
    expect(tela.erroEdicao).toBe('Já existe uma conta com esse login.');
    expect(tela.edicao).not.toBeNull();
    expect(tela.salvando).toBe(false);
  });

  it('Esc fecha o painel', () => {
    tela.novaConta();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(tela.edicao).toBeNull();
  });
});
