import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { chaveDeGrafia, Escolha } from './escolha';

@Component({
  imports: [Escolha, FormsModule],
  template: `<app-escolha [opcoes]="opcoes" [(ngModel)]="valor" />`,
})
class Hospede {
  opcoes = ['Atendimento', 'Infraestrutura'];
  valor: string | null = null;
}

async function abrir(valor: string | null = null) {
  const f = TestBed.createComponent(Hospede);
  f.componentInstance.valor = valor;
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  const escolha = f.debugElement.children[0].componentInstance as Escolha;
  return { f, escolha, el: f.nativeElement as HTMLElement };
}

describe('Escolha', () => {
  it('lista as opções gravadas e o Outro', async () => {
    const { el } = await abrir();
    const textos = [...el.querySelectorAll('option')].map((o) => o.textContent?.trim());
    expect(textos).toEqual(['Selecione…', 'Atendimento', 'Infraestrutura', 'Outro…']);
  });

  it('valor antigo fora da lista continua aparecendo', async () => {
    const { escolha } = await abrir('Diretoria antiga');
    expect(escolha.lista[0]).toBe('Diretoria antiga');
  });

  it('escolher da lista grava o valor', async () => {
    const { f, escolha } = await abrir();
    escolha.escolher('Infraestrutura');
    expect(f.componentInstance.valor).toBe('Infraestrutura');
  });

  it('valor novo que já existe com outra grafia vira o existente', async () => {
    const { f, escolha } = await abrir();
    escolha.escolher('__outro__');
    escolha.digitar('  infraestrutura ');
    escolha.confirmar();
    expect(f.componentInstance.valor).toBe('Infraestrutura');
    expect(escolha.digitando()).toBe(false);
  });

  it('valor realmente novo fica como digitado', async () => {
    const { f, escolha } = await abrir();
    escolha.escolher('__outro__');
    escolha.digitar('Cobrança ');
    escolha.confirmar();
    expect(f.componentInstance.valor).toBe('Cobrança');
  });

  it('grafia ignora acento, caixa e espaços', () => {
    expect(chaveDeGrafia(' Eficiência   Operacional')).toBe(chaveDeGrafia('eficiencia operacional'));
  });
});
