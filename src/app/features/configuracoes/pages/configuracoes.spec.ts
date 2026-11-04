import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Configuracoes } from './configuracoes';
import { AuthService } from '../../../core/auth/auth.service';
import { entrarComo } from '../../../testing/dados';

const FOTO = 'data:image/jpeg;base64,AAAA';

describe('Configurações', () => {
  let tela: Configuracoes;
  let api: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<Configuracoes>>;

  beforeEach(async () => {
    entrarComo('GESTOR_PROJETO', 'u1', 'ana');
    TestBed.configureTestingModule({ imports: [Configuracoes], providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(Configuracoes);
    tela = fixture.componentInstance;
    api = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  function carregarPerfil(extra: object = {}) {
    api
      .expectOne('/api/users/me')
      .flush({ id: 'u1', nome: 'Ana Souza', perfil: 'GESTOR_PROJETO', cargo: 'Product Owner', ...extra });
  }

  it('abre com os dados da sessão e atualiza com os da API', () => {
    expect(tela.nome).toBe('Pessoa u1');
    carregarPerfil({ foto: FOTO });
    expect([tela.nome, tela.cargo, tela.foto()]).toEqual(['Ana Souza', 'Product Owner', FOTO]);
  });

  it('salva nome, cargo e foto e reflete na sessão', () => {
    carregarPerfil();
    tela.nome = ' Ana Lima ';
    tela.cargo = '';
    tela.foto.set(FOTO);
    tela.salvar();
    const req = api.expectOne('/api/users/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nome: 'Ana Lima', cargo: null, foto: FOTO });
    req.flush({ id: 'u1', nome: 'Ana Lima', perfil: 'GESTOR_PROJETO', cargo: null, foto: FOTO });

    expect(tela.salvo()).toBe(true);
    const sessao = TestBed.inject(AuthService).sessao();
    expect([sessao?.nome, sessao?.foto, sessao?.cargo]).toEqual(['Ana Lima', FOTO, undefined]);
    expect(JSON.parse(localStorage.getItem('sigov_sessao')!).foto).toBe(FOTO);
  });

  it('nome em branco não chama a API', () => {
    carregarPerfil();
    tela.nome = '   ';
    tela.salvar();
    api.expectNone('/api/users/me');
    expect(tela.erro()).toBe('Informe o nome.');
  });

  it('mostra a recusa da API e falha de conexão', () => {
    carregarPerfil();
    tela.salvar();
    api.expectOne('/api/users/me').flush({ message: 'A foto deve ter no maximo 200 KB.' }, { status: 400, statusText: 'x' });
    expect(tela.erro()).toBe('A foto deve ter no maximo 200 KB.');
    expect(tela.salvando()).toBe(false);

    tela.salvar();
    api.expectOne('/api/users/me').flush(null, { status: 500, statusText: 'x' });
    expect(tela.erro()).toBe('Não foi possível salvar. Verifique a conexão e tente de novo.');
  });

  function escolher(arquivo: File) {
    const entrada = document.createElement('input');
    Object.defineProperty(entrada, 'files', { value: [arquivo] });
    return tela.escolherFoto({ target: entrada } as unknown as Event);
  }

  it('foto escolhida é reduzida antes de entrar no formulário', async () => {
    carregarPerfil();
    tela.reduzir = async () => FOTO;
    await escolher(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(tela.foto()).toBe(FOTO);
  });

  it('arquivo que não é imagem aceita é recusado', async () => {
    carregarPerfil();
    await escolher(new File(['x'], 'foto.gif', { type: 'image/gif' }));
    expect(tela.foto()).toBe('');
    expect(tela.erro()).toBe('Escolha uma imagem PNG, JPEG ou WebP.');
  });

  it('imagem ilegível mostra erro e remover limpa a foto', async () => {
    carregarPerfil({ foto: FOTO });
    tela.reduzir = () => Promise.reject(new Error('x'));
    await escolher(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(tela.erro()).toBe('Não foi possível ler essa imagem.');
    tela.removerFoto();
    expect(tela.foto()).toBe('');
  });
});
