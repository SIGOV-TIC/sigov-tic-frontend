import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { Layout } from './layout';
import { MenuUsuario } from './menu-usuario';
import { FeedbackBotao } from '../feedback/feedback-botao';
import { entrarComo } from '../../testing/dados';

function configurar() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  return TestBed.inject(HttpTestingController);
}

describe('Layout', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('menu mostra Novo Projeto ao Escritório e Usuários ao admin', async () => {
    for (const [perfil, novo, usuarios] of [['ESCRITORIO', true, false], ['ADMIN', false, true], ['USER', false, false]] as const) {
      TestBed.resetTestingModule();
      entrarComo(perfil);
      configurar();
      const fixture = TestBed.createComponent(Layout);
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(!!el.querySelector('a[href="/cadastro"]')).toBe(novo);
      expect(!!el.querySelector('a[href="/usuarios"]')).toBe(usuarios);
    }
  });

  it('tema lembrado e alternado', async () => {
    entrarComo('USER');
    localStorage.setItem('sigov_tema', 'light');
    configurar();
    const fixture = TestBed.createComponent(Layout);
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fixture.componentInstance.alternarTema();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('sigov_tema')).toBe('dark');
  });

  it('sair encerra a sessão e vai ao login', async () => {
    entrarComo('USER');
    const api = configurar();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Layout);
    fixture.componentInstance.sair();
    api.expectOne('/api/auth/logout').flush(null);
    expect(localStorage.getItem('sigov_sessao')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});

describe('Menu do usuário', () => {
  afterEach(() => localStorage.clear());

  it('mostra nome, iniciais e perfil; fecha com Esc e clique fora', () => {
    entrarComo('ESCRITORIO', 'u1');
    configurar();
    const menu = TestBed.createComponent(MenuUsuario).componentInstance;
    expect([menu.nome, menu.iniciais, menu.perfil]).toEqual(['Pessoa u1', 'PE', 'Escritório de Projetos']);
    menu.alternar();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.aberto).toBe(false);
    menu.alternar();
    document.body.click();
    expect(menu.aberto).toBe(false);
  });

  it('sair avisa o layout', () => {
    entrarComo('USER');
    configurar();
    const menu = TestBed.createComponent(MenuUsuario).componentInstance;
    const saiu = vi.fn();
    menu.sair.subscribe(saiu);
    menu.aoSair();
    expect(saiu).toHaveBeenCalled();
  });
});

describe('Botão de feedback', () => {
  afterEach(() => localStorage.clear());

  it('envia o texto com a tela atual e o tema', async () => {
    entrarComo('USER');
    localStorage.setItem('sigov_tema', 'light');
    const api = configurar();
    await TestBed.inject(Router).navigateByUrl('/?x=1');
    const botao = TestBed.createComponent(FeedbackBotao).componentInstance;
    botao.abrir();
    botao.texto = '   ';
    botao.enviar();
    api.expectNone('/api/feedback');
    botao.texto = ' Gostei ';
    botao.enviar();
    const req = api.expectOne('/api/feedback');
    expect(req.request.body).toEqual({ texto: 'Gostei', tela: '/', tema: 'light' });
    req.flush({});
    expect(botao.enviado()).toBe(true);
    expect(botao.texto).toBe('');
  });

  it('falha mantém o texto e avisa', () => {
    entrarComo('USER');
    const api = configurar();
    const botao = TestBed.createComponent(FeedbackBotao).componentInstance;
    botao.texto = 'Bug na tela';
    botao.enviar();
    api.expectOne('/api/feedback').flush(null, { status: 500, statusText: 'x' });
    expect(botao.erro()).toBe('Não foi possível enviar. Tente de novo.');
    expect(botao.texto).toBe('Bug na tela');
    expect(botao.enviando()).toBe(false);
  });
});
