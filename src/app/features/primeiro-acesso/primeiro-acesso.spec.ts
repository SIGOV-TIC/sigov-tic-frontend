import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { PrimeiroAcesso } from './primeiro-acesso';
import { AuthService } from '../../core/auth/auth.service';

describe('PrimeiroAcesso', () => {
  let tela: PrimeiroAcesso;
  let api: HttpTestingController;
  let router: Router;
  let fixture: ReturnType<typeof TestBed.createComponent<PrimeiroAcesso>>;

  async function criar(voltar?: string) {
    localStorage.setItem(
      'sigov_sessao',
      JSON.stringify({ username: 'pmo', roles: ['ROLE_ESCRITORIO'], id: 'u2', nome: 'Paula', trocaSenhaObrigatoria: true }),
    );
    TestBed.configureTestingModule({
      imports: [PrimeiroAcesso],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(voltar ? { voltar } : {}) } } },
      ],
    });
    fixture = TestBed.createComponent(PrimeiroAcesso);
    tela = fixture.componentInstance;
    api = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    await fixture.whenStable();
  }

  afterEach(() => localStorage.clear());

  it('chama a pessoa pelo nome e pede a senha temporária', async () => {
    await criar();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Paula, sua conta foi aberta com uma senha temporária');
    expect(texto).toContain('Senha temporária');
    expect(fixture.nativeElement.querySelector('button[type=submit]').textContent).toContain('Salvar e entrar');
  });

  it('depois da troca segue para a página que a pessoa queria abrir', async () => {
    await criar('/orcamento');
    tela.seguir();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/orcamento');
  });

  it('sem destino, segue para o Dashboard', async () => {
    await criar();
    tela.seguir();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('Sair encerra a sessão e volta ao login', async () => {
    await criar();
    tela.sair();
    api.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    expect(TestBed.inject(AuthService).sessao()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});
