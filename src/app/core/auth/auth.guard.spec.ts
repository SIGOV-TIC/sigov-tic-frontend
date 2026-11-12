import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, convertToParamMap, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { adminGuard, authGuard, criacaoProjetoGuard, destinoSeguro, edicaoProjetoGuard, primeiroAcessoGuard } from './auth.guard';

function rodar(guard: typeof authGuard, roles: string[] | null, url = '/projeto/p1/editar', trocaSenhaObrigatoria = false) {
  TestBed.resetTestingModule();
  localStorage.clear();
  if (roles) localStorage.setItem('sigov_sessao', JSON.stringify({ username: 'x', roles, id: 'u1', trocaSenhaObrigatoria }));
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  const route = { paramMap: convertToParamMap({ id: 'p1' }) } as ActivatedRouteSnapshot;
  const resultado = TestBed.runInInjectionContext(() => guard(route, { url } as RouterStateSnapshot));
  const router = TestBed.inject(Router);
  return resultado instanceof UrlTree ? router.serializeUrl(resultado) : resultado;
}

describe('guards', () => {
  afterEach(() => localStorage.clear());

  it('sem sessão vai para o login, lembrando de onde veio', () => {
    expect(rodar(authGuard, null, '/orcamento')).toBe('/login?voltar=%2Forcamento');
    expect(rodar(authGuard, ['ROLE_USER'])).toBe(true);
  });

  it('administração só para o admin', () => {
    expect(rodar(adminGuard, ['ROLE_ADMIN'])).toBe(true);
    expect(rodar(adminGuard, ['ROLE_ESCRITORIO'])).toBe('/dashboard');
  });

  it('cadastro de projeto só para o Escritório', () => {
    expect(rodar(criacaoProjetoGuard, ['ROLE_ESCRITORIO'])).toBe(true);
    expect(rodar(criacaoProjetoGuard, ['ROLE_ADMIN'])).toBe('/portfolio');
  });

  it('edição do projeto inteiro só para o Escritório; PO volta à tela do projeto', () => {
    expect(rodar(edicaoProjetoGuard, ['ROLE_ESCRITORIO'])).toBe(true);
    expect(rodar(edicaoProjetoGuard, ['ROLE_GESTOR_PROJETO'])).toBe('/projeto/p1');
  });

  it('senha temporária só deixa abrir o primeiro acesso', () => {
    expect(rodar(authGuard, ['ROLE_ESCRITORIO'], '/orcamento', true)).toBe('/primeiro-acesso?voltar=%2Forcamento');
    expect(rodar(primeiroAcessoGuard, ['ROLE_ESCRITORIO'], '/', true)).toBe(true);
  });

  it('primeiro acesso sem senha temporária vai ao Dashboard; sem sessão, ao login', () => {
    expect(rodar(primeiroAcessoGuard, ['ROLE_ESCRITORIO'])).toBe('/dashboard');
    expect(rodar(primeiroAcessoGuard, null)).toBe('/login');
  });

  it.each([
    ['/orcamento?pagina=2', '/orcamento?pagina=2'],
    ['//outro.site', '/dashboard'],
    ['https://outro.site', '/dashboard'],
    ['/login', '/dashboard'],
    ['/primeiro-acesso', '/dashboard'],
    [null, '/dashboard'],
  ])('destino %s vira %s', (voltar, esperado) => {
    expect(destinoSeguro(voltar)).toBe(esperado);
  });
});
