import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { EstadoTela } from './estado';
import { mensagemDeErro } from './erro-api';

@Component({
  imports: [EstadoTela],
  template: `
    <app-estado [tipo]="tipo" [mensagem]="mensagem" (tentar)="tentativas = tentativas + 1">
      <a class="acao">Cadastrar</a>
    </app-estado>
  `,
})
class Hospedeiro {
  tipo: 'carregando' | 'vazio' | 'erro' = 'carregando';
  mensagem = '';
  tentativas = 0;
}

describe('mensagemDeErro', () => {
  const http = (status: number) => new HttpErrorResponse({ status });

  it.each([
    [0, 'Sem conexão com o servidor. Verifique sua internet e tente de novo.'],
    [401, 'Sua sessão expirou. Entre novamente.'],
    [403, 'Você não tem permissão para ver os projetos.'],
    [404, 'Não encontramos os projetos.'],
    [500, 'O servidor teve um problema. Tente de novo em instantes.'],
    [503, 'O servidor teve um problema. Tente de novo em instantes.'],
    [400, 'Não foi possível carregar os projetos. Tente de novo.'],
  ])('status %i', (status, esperado) => {
    expect(mensagemDeErro(http(status), 'os projetos')).toBe(esperado);
  });

  it('erro que não vem do HTTP cai na mensagem geral', () => {
    expect(mensagemDeErro(new Error('x'))).toBe('Não foi possível carregar os dados. Tente de novo.');
  });
});

describe('EstadoTela', () => {
  function montar(tipo: 'carregando' | 'vazio' | 'erro', mensagem = '') {
    const fixture = TestBed.createComponent(Hospedeiro);
    fixture.componentInstance.tipo = tipo;
    fixture.componentInstance.mensagem = mensagem;
    fixture.detectChanges();
    return fixture;
  }

  it('carregando mostra o texto padrão, sem botão nem conteúdo extra', () => {
    const el: HTMLElement = montar('carregando').nativeElement;
    expect(el.textContent).toContain('Carregando...');
    expect(el.querySelector('button')).toBeNull();
    expect(el.querySelector('.acao')).toBeNull();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
  });

  it('erro mostra a mensagem como alerta e o botão avisa quem usa', () => {
    const fixture = montar('erro', 'O servidor teve um problema.');
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('O servidor teve um problema.');
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(fixture.componentInstance.tentativas).toBe(1);
  });

  it('vazio mostra o conteúdo projetado', () => {
    const el: HTMLElement = montar('vazio', 'Nada por aqui').nativeElement;
    expect(el.textContent).toContain('Nada por aqui');
    expect(el.querySelector('.acao')).not.toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });
});
