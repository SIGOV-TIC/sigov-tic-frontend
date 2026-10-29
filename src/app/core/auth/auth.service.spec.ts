import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService, Sessao } from './auth.service';

const CHAVE = 'sigov_sessao';

const sessoes: Record<string, Sessao> = {
  admin: { username: 'admin', roles: ['ROLE_ADMIN'], id: 'u-admin', perfil: 'ADMIN' },
  escritorio: { username: 'pmo', roles: ['ROLE_ESCRITORIO'], id: 'u-pmo', perfil: 'ESCRITORIO' },
  po: { username: 'ana.po', roles: ['ROLE_GESTOR_PROJETO'], id: 'u-po', perfil: 'GESTOR_PROJETO' },
  sm: { username: 'thiago.sm', roles: ['ROLE_GESTOR_PROJETO'], id: 'u-sm', perfil: 'GESTOR_PROJETO' },
  outro: { username: 'outro', roles: ['ROLE_GESTOR_PROJETO'], id: 'u-outro', perfil: 'GESTOR_PROJETO' },
  leitor: { username: 'diretoria', roles: ['ROLE_USER'], id: 'u-leitor', perfil: 'USER' },
};

const vinculo = { po: { id: 'u-po' }, scrumMaster: { id: 'u-sm' } };

function iniciar(sessao?: Sessao | string) {
  TestBed.resetTestingModule();
  localStorage.clear();
  if (sessao) localStorage.setItem(CHAVE, typeof sessao === 'string' ? sessao : JSON.stringify(sessao));
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { auth: TestBed.inject(AuthService), http: TestBed.inject(HttpTestingController) };
}

describe('AuthService', () => {
  afterEach(() => localStorage.clear());

  describe('quem pode o quê (mesma regra da API)', () => {
    const casos: [keyof typeof sessoes, Record<string, boolean>][] = [
      ['admin', { gerenciarUsuarios: true, criarProjeto: false, editarProjeto: false, acompanharProjeto: false, editarMetas: false }],
      ['escritorio', { gerenciarUsuarios: false, criarProjeto: true, editarProjeto: true, acompanharProjeto: true, editarMetas: true }],
      ['po', { gerenciarUsuarios: false, criarProjeto: false, editarProjeto: false, acompanharProjeto: true, editarMetas: false }],
      ['sm', { gerenciarUsuarios: false, criarProjeto: false, editarProjeto: false, acompanharProjeto: true, editarMetas: false }],
      ['outro', { gerenciarUsuarios: false, criarProjeto: false, editarProjeto: false, acompanharProjeto: false, editarMetas: false }],
      ['leitor', { gerenciarUsuarios: false, criarProjeto: false, editarProjeto: false, acompanharProjeto: false, editarMetas: false }],
    ];

    for (const [perfil, esperado] of casos) {
      it(perfil, () => {
        const { auth } = iniciar(sessoes[perfil]);
        const obtido = Object.fromEntries(Object.keys(esperado).map((acao) => [acao, auth.pode(acao as never, vinculo)]));
        expect(obtido).toEqual(esperado);
      });
    }

    it('PO sem projeto informado não acompanha nada', () => {
      const { auth } = iniciar(sessoes['po']);
      expect(auth.pode('acompanharProjeto')).toBe(false);
      expect(auth.pode('acompanharProjeto', { po: null, scrumMaster: null })).toBe(false);
    });

    it('sem sessão, nada', () => {
      const { auth } = iniciar();
      expect(auth.pode('acompanharProjeto', vinculo)).toBe(false);
      expect(auth.pode('gerenciarUsuarios')).toBe(false);
    });
  });

  describe('sessão', () => {
    it('lê a sessão guardada e o rótulo do perfil', () => {
      const { auth } = iniciar(sessoes['escritorio']);
      expect(auth.sessao()?.username).toBe('pmo');
      expect(auth.ehEscritorio()).toBe(true);
      expect(auth.rotuloPerfil()).toBe('Escritório de Projetos');
    });

    it('sessão antiga sem id ou corrompida pede novo login', () => {
      expect(iniciar({ username: 'x', roles: ['ROLE_USER'] }).auth.sessao()).toBeNull();
      expect(iniciar('{quebrado').auth.sessao()).toBeNull();
    });

    it('login guarda quem entrou a partir da resposta da API', () => {
      const { auth, http } = iniciar();
      auth.login('ana.po', 'segredo').subscribe();
      const req = http.expectOne('/api/auth/login');
      expect(req.request.body).toEqual({ username: 'ana.po', password: 'segredo' });
      req.flush({ username: 'ana.po', roles: ['ROLE_GESTOR_PROJETO'], usuario: { id: 'u-po', nome: 'Ana', perfil: 'GESTOR_PROJETO' } });

      expect(auth.sessao()).toEqual({ username: 'ana.po', roles: ['ROLE_GESTOR_PROJETO'], id: 'u-po', nome: 'Ana', perfil: 'GESTOR_PROJETO' });
      expect(JSON.parse(localStorage.getItem(CHAVE)!).id).toBe('u-po');
    });

    it('logout encerra a sessão mesmo se a API falhar', () => {
      const { auth, http } = iniciar(sessoes['po']);
      auth.logout().subscribe({ error: () => undefined });
      http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Erro' });
      expect(auth.sessao()).toBeNull();
      expect(localStorage.getItem(CHAVE)).toBeNull();
    });

    it('registro envia nome, login e senha', () => {
      const { auth, http } = iniciar();
      auth.registrar('Ana', 'ana', 'senha123').subscribe();
      expect(http.expectOne('/api/auth/registro').request.body).toEqual({ nome: 'Ana', login: 'ana', senha: 'senha123' });
    });
  });
});
