import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { respostasApi } from './respostas';

describe('authInterceptor', () => {
  let http: HttpClient;
  let api: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.setItem('sigov_sessao', JSON.stringify({ username: 'ana', roles: ['ROLE_USER'], id: 'u1' }));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    api = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => localStorage.clear());

  it('manda o cookie de sessão e conta a resposta', () => {
    const antes = respostasApi();
    http.get('/api/projetos').subscribe();
    const req = api.expectOne('/api/projetos');
    expect(req.request.withCredentials).toBe(true);
    req.flush([]);
    expect(respostasApi()).toBe(antes + 1);
  });

  it.each([401, 403])('resposta %i encerra a sessão e volta ao login', (status) => {
    http.get('/api/metas').subscribe({ error: () => undefined });
    api.expectOne('/api/metas').flush(null, { status, statusText: 'Negado' });
    expect(auth.sessao()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.any(Object) }));
  });

  it('senha errada no login não derruba a sessão', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    api.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Negado' });
    expect(auth.sessao()).not.toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('erro de servidor segue para a tela tratar', () => {
    let status = 0;
    http.get('/api/projetos').subscribe({ error: (e) => (status = e.status) });
    api.expectOne('/api/projetos').flush(null, { status: 500, statusText: 'Erro' });
    expect(status).toBe(500);
    expect(auth.sessao()).not.toBeNull();
  });
});
