import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { Layout } from './core/layout/layout';
import { respostasApi } from './core/auth/respostas';

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

  readonly naTelaDeLogin = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url.startsWith('/login')),
    ),
    { initialValue: location.pathname.startsWith('/login') },
  );

  constructor() {
    // Ícones de traço fino (Material Symbols); o peso fica em styles.scss.
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }
}
