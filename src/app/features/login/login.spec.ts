import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  let login: Login;
  let api: HttpTestingController;
  let router: Router;

  function criar(voltar?: string) {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(voltar ? { voltar } : {}) } } },
      ],
    });
    login = TestBed.createComponent(Login).componentInstance;
    api = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  }

  afterEach(() => localStorage.clear());

  it('exige usuário e senha sem chamar a API', () => {
    criar();
    login.usuario = '  ';
    login.senha = 'x';
    login.enviar();
    expect(login.erro()).toBe('Informe usuário e senha.');
    api.expectNone('/api/auth/login');
  });

  it('cadastro exige nome e senha de 8 caracteres', () => {
    criar();
    login.alternarModo();
    login.usuario = 'ana';
    login.senha = '12345678';
    login.enviar();
    expect(login.erro()).toBe('Preencha nome, usuário e senha.');
    login.nome = 'Ana';
    login.senha = '1234567';
    login.enviar();
    expect(login.erro()).toBe('A senha precisa ter pelo menos 8 caracteres.');
  });

  it('entra e volta para a página de onde veio', () => {
    criar('/orcamento?pagina=2');
    login.usuario = ' ana ';
    login.senha = 'segredo';
    login.enviar();
    const req = api.expectOne('/api/auth/login');
    expect(req.request.body).toEqual({ username: 'ana', password: 'segredo' });
    req.flush({ username: 'ana', roles: ['ROLE_USER'], usuario: { id: 'u1', nome: 'Ana', perfil: 'USER' } });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/orcamento?pagina=2');
  });

  it.each(['https://outro.site', '/login', 'dashboard'])('destino %s não é seguido; vai ao Dashboard', (voltar) => {
    criar(voltar);
    login.usuario = 'ana';
    login.senha = 'segredo';
    login.enviar();
    api.expectOne('/api/auth/login').flush({ username: 'ana', roles: ['ROLE_USER'], usuario: { id: 'u1', nome: 'Ana', perfil: 'USER' } });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it.each([
    [401, 'entrar', 'Usuário ou senha incorretos.'],
    [0, 'entrar', 'Não foi possível conectar ao servidor. Tente de novo em alguns segundos.'],
    [503, 'entrar', 'Não foi possível conectar ao servidor. Tente de novo em alguns segundos.'],
    [409, 'cadastrar', 'Esse usuário já existe. Escolha outro.'],
    [400, 'cadastrar', 'Não foi possível criar a conta. Confira os dados.'],
  ])('erro %i ao %s', (status, modo, mensagem) => {
    criar();
    if (modo === 'cadastrar') login.alternarModo();
    login.nome = 'Ana';
    login.usuario = 'ana';
    login.senha = 'segredo123';
    login.enviar();
    expect(login.entrando()).toBe(true);
    api.expectOne(modo === 'cadastrar' ? '/api/auth/registro' : '/api/auth/login').flush(null, { status, statusText: 'x' });
    expect(login.erro()).toBe(mensagem);
    expect(login.entrando()).toBe(false);
  });
});
