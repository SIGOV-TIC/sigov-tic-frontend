import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormTrocaSenha, problemaNovaSenha } from './form-troca-senha';
import { AuthService } from '../auth.service';
import { redesenhar } from '../../../testing/dados';

describe('problemaNovaSenha', () => {
  it.each([
    ['', 'nova-senha-1', 'nova-senha-1', 'Informe a senha atual.'],
    ['atual-1', 'curta1', 'curta1', 'A nova senha deve ter entre 8 e 72 caracteres.'],
    ['atual-1', 'a1'.repeat(37), 'a1'.repeat(37), 'A nova senha deve ter entre 8 e 72 caracteres.'],
    ['atual-1', 'so-letras-aqui', 'so-letras-aqui', 'A nova senha deve ter letras e números.'],
    ['atual-1', '1234567890', '1234567890', 'A nova senha deve ter letras e números.'],
    ['atual-1', 'Ana12345', 'Ana12345', 'A nova senha não pode ser igual ao login.'],
    ['mesma-senha-1', 'mesma-senha-1', 'mesma-senha-1', 'A nova senha deve ser diferente da atual.'],
    ['atual-1', 'nova-senha-1', 'nova-senha-2', 'A confirmação não confere com a nova senha.'],
    ['atual-1', 'nova-senha-1', 'nova-senha-1', ''],
    ['atual-1', 'ação-çé-9ü', 'ação-çé-9ü', ''],
  ])('atual %j, nova %j, confirmação %j', (atual, nova, confirmacao, esperado) => {
    expect(problemaNovaSenha(atual, nova, confirmacao, 'ana12345')).toBe(esperado);
  });
});

describe('FormTrocaSenha', () => {
  let form: FormTrocaSenha;
  let api: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<FormTrocaSenha>>;

  beforeEach(async () => {
    localStorage.setItem(
      'sigov_sessao',
      JSON.stringify({ username: 'ana', roles: ['ROLE_ESCRITORIO'], id: 'u1', trocaSenhaObrigatoria: true }),
    );
    TestBed.configureTestingModule({ imports: [FormTrocaSenha], providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(FormTrocaSenha);
    form = fixture.componentInstance;
    api = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  function preencher(atual = 'temporaria-1', nova = 'nova-senha-1', confirmacao = nova) {
    form.senhaAtual = atual;
    form.novaSenha = nova;
    form.confirmacao = confirmacao;
  }

  it('regra quebrada aparece sem chamar a API', () => {
    preencher('temporaria-1', 'curta1');
    form.enviar();
    expect(form.erro()).toBe('A nova senha deve ter entre 8 e 72 caracteres.');
    api.expectNone('/api/users/me/senha');
  });

  it('troca, limpa os campos, avisa e tira a senha temporária da sessão', () => {
    let avisos = 0;
    form.trocada.subscribe(() => avisos++);
    preencher();
    form.enviar();
    const req = api.expectOne('/api/users/me/senha');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ senhaAtual: 'temporaria-1', novaSenha: 'nova-senha-1' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(avisos).toBe(1);
    expect(form.concluida()).toBe(true);
    expect([form.senhaAtual, form.novaSenha, form.confirmacao]).toEqual(['', '', '']);
    expect(TestBed.inject(AuthService).sessao()?.trocaSenhaObrigatoria).toBe(false);
    expect(JSON.parse(localStorage.getItem('sigov_sessao')!).trocaSenhaObrigatoria).toBe(false);
  });

  it('senha atual errada mostra as tentativas que restam', async () => {
    preencher('errada-1');
    form.enviar();
    api
      .expectOne('/api/users/me/senha')
      .flush({ status: 400, message: 'Senha atual incorreta. Restam 4 tentativas antes do bloqueio.' }, { status: 400, statusText: 'Bad Request' });
    await redesenhar(fixture);

    expect(fixture.nativeElement.querySelector('[role=alert]').textContent).toContain('Restam 4 tentativas');
    expect(form.bloqueada()).toBe(false);
  });

  it('bloqueio por excesso de tentativas desliga o botão até a próxima tela', async () => {
    preencher('errada-1');
    form.enviar();
    api.expectOne('/api/users/me/senha').flush(
      { status: 429, message: 'Troca de senha bloqueada por excesso de tentativas. Tente de novo em 15 minutos.' },
      { status: 429, statusText: 'Too Many Requests' },
    );
    await redesenhar(fixture);

    expect(form.erro()).toContain('Tente de novo em 15 minutos');
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBe(true);
    expect(TestBed.inject(AuthService).sessao()?.trocaSenhaObrigatoria).toBe(true);
  });

  it('servidor fora do ar não confunde com senha errada', () => {
    preencher();
    form.enviar();
    api.expectOne('/api/users/me/senha').flush(null, { status: 0, statusText: '' });
    expect(form.erro()).toBe('Não foi possível conectar ao servidor. Tente de novo em alguns segundos.');
  });
});
