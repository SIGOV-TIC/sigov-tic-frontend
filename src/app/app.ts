import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Layout } from './core/layout/layout';
import { respostasApi } from './core/auth/respostas';

function telaSemLayout(url: string): boolean {
  return url.startsWith('/login') || url.startsWith('/primeiro-acesso');
}

@Component({
  // Mantém as páginas abaixo alcançáveis pela detecção de mudanças após respostas da API.
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet, Layout],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private router = inject(Router);
  readonly respostasApi = respostasApi;

  // Login e primeiro acesso abrem sozinhos, sem menu lateral nem cabeçalho.
  readonly semLayout = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => telaSemLayout(this.router.url)),
    ),
    { initialValue: telaSemLayout(location.pathname) },
  );

  constructor() {
    // Ícones de traço fino (Material Symbols); o peso fica em styles.scss.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }
}
