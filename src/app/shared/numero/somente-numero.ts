import { Directive, ElementRef, HostListener } from '@angular/core';

// Campo numérico só recebe algarismos, separador decimal e, quando o mínimo admite, o sinal de menos.
// O Firefox deixa digitar letras num input number e entrega o valor vazio sem avisar.
@Directive({ selector: 'input[type=number]' })
export class SomenteNumero {
  constructor(private el: ElementRef<HTMLInputElement>) {}

  private get aceitaNegativo(): boolean {
    const min = this.el.nativeElement.getAttribute('min');
    return min === null || Number(min) < 0;
  }

  aceita(texto: string): boolean {
    const permitidos = this.aceitaNegativo ? /^[0-9.,-]*$/ : /^[0-9.,]*$/;
    return permitidos.test(texto);
  }

  @HostListener('beforeinput', ['$event'])
  aoDigitar(ev: InputEvent) {
    if (ev.data != null && !this.aceita(ev.data)) ev.preventDefault();
  }

  @HostListener('paste', ['$event'])
  aoColar(ev: ClipboardEvent) {
    const texto = ev.clipboardData?.getData('text') ?? '';
    if (!this.aceita(texto.trim())) ev.preventDefault();
  }
}
