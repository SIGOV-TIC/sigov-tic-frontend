import { ChangeDetectionStrategy, Component, ElementRef, HostListener, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth/auth.service';

@Component({
  // Segue o padrão Eager das demais partes do layout.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-menu-usuario',
  imports: [MatIconModule],
  templateUrl: './menu-usuario.html',
  styleUrl: './menu-usuario.scss',
})
export class MenuUsuario {
  readonly sair = output<void>();
  aberto = false;

  constructor(
    readonly auth: AuthService,
    private host: ElementRef<HTMLElement>,
  ) {}

  get nome(): string {
    const s = this.auth.sessao();
    return s?.nome || s?.username || '';
  }

  get iniciais(): string {
    return this.nome.slice(0, 2).toUpperCase();
  }

  get perfil(): string {
    return this.auth.rotuloPerfil();
  }

  alternar() {
    this.aberto = !this.aberto;
  }

  @HostListener('document:click', ['$event'])
  aoClicarFora(e: MouseEvent) {
    if (this.aberto && !this.host.nativeElement.contains(e.target as Node)) this.aberto = false;
  }

  @HostListener('document:keydown.escape')
  aoEsc() {
    this.aberto = false;
  }

  aoSair() {
    this.aberto = false;
    this.sair.emit();
  }
}
