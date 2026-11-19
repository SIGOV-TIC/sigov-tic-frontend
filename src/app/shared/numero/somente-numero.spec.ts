import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SomenteNumero } from './somente-numero';

@Component({
  imports: [SomenteNumero],
  template: `<input id="livre" type="number"><input id="positivo" type="number" min="0">`,
})
class Hospede {}

function digitar(el: HTMLInputElement, data: string) {
  const ev = new InputEvent('beforeinput', { data, cancelable: true, inputType: 'insertText' });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}

describe('SomenteNumero', () => {
  let livre: HTMLInputElement;
  let positivo: HTMLInputElement;

  beforeEach(() => {
    const f = TestBed.createComponent(Hospede);
    f.detectChanges();
    livre = f.nativeElement.querySelector('#livre');
    positivo = f.nativeElement.querySelector('#positivo');
  });

  it('recusa letras e o expoente', () => {
    expect(digitar(livre, 'a')).toBe(true);
    expect(digitar(livre, 'e')).toBe(true);
  });

  it('aceita algarismos e separador decimal', () => {
    expect(digitar(livre, '7')).toBe(false);
    expect(digitar(livre, ',')).toBe(false);
    expect(digitar(livre, '.')).toBe(false);
  });

  it('só aceita sinal de menos quando o mínimo permite', () => {
    expect(digitar(livre, '-')).toBe(false);
    expect(digitar(positivo, '-')).toBe(true);
  });
});
