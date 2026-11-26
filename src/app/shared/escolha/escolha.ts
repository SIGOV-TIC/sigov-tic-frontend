import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, Input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

const OUTRO = '__outro__';

// Compara sem acento, sem caixa e sem espaço sobrando.
export function chaveDeGrafia(valor: string): string {
  return valor.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Campo que recebe algo já gravado: escolhe-se na lista. Valor novo só por "Outro…", e se ele
// coincidir com um existente em outra grafia, fica o existente.
@Component({
  selector: 'app-escolha',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Escolha), multi: true }],
  templateUrl: './escolha.html',
  styleUrl: './escolha.scss',
})
export class Escolha implements ControlValueAccessor {
  @Input() opcoes: string[] = [];
  @Input() campoId?: string;
  @Input() vazio = 'Selecione…';
  @Input() maxlength = 200;
  @Input() invalido = false;

  readonly OUTRO = OUTRO;
  readonly valor = signal('');
  readonly digitando = signal(false);
  readonly desabilitado = signal(false);
  private readonly campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  private aoMudar: (v: string | null) => void = () => {};
  private aoTocar: () => void = () => {};

  // As opções gravadas e, se ainda não estiver nelas, o valor atual.
  get lista(): string[] {
    const v = this.valor();
    return v && !this.opcoes.includes(v) ? [v, ...this.opcoes] : this.opcoes;
  }

  writeValue(v: string | null): void {
    this.valor.set(v ?? '');
    this.digitando.set(false);
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.aoMudar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.aoTocar = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  escolher(v: string) {
    if (v === OUTRO) {
      this.digitando.set(true);
      this.valor.set('');
      this.aoMudar(null);
      queueMicrotask(() => this.campo()?.nativeElement.focus());
      return;
    }
    this.valor.set(v);
    this.aoMudar(v || null);
    this.aoTocar();
  }

  digitar(v: string) {
    this.valor.set(v);
    this.aoMudar(v.trim() || null);
  }

  confirmar() {
    const v = this.valor().trim();
    const existente = this.opcoes.find((o) => chaveDeGrafia(o) === chaveDeGrafia(v));
    const final = existente ?? v;
    this.valor.set(final);
    this.aoMudar(final || null);
    if (existente || !final) this.digitando.set(false);
    this.aoTocar();
  }

  voltarParaLista() {
    this.digitando.set(false);
    this.valor.set('');
    this.aoMudar(null);
  }
}
