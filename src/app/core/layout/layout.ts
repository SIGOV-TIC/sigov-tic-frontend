import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../auth/auth.service';
import { BuscaGlobal } from './busca-global';
import { MenuUsuario } from './menu-usuario';
import { FeedbackBotao } from '../feedback/feedback-botao';

@Component({
  // Mantém as páginas abaixo alcançáveis pela detecção de mudanças após respostas da API.
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLink, RouterLinkActive, MatIconModule, BuscaGlobal, MenuUsuario, FeedbackBotao],
  selector: 'app-layout',
  styleUrl: './layout.scss',
  templateUrl: './layout.html',
})
export class Layout implements OnInit {
  temaClaro = false;

  constructor(
    private router: Router,
    readonly auth: AuthService,
  ) {}

  sair() {
    this.auth.logout().subscribe({ complete: () => this.router.navigate(['/login']), error: () => this.router.navigate(['/login']) });
  }

  ngOnInit() {
    try {
      const salvo = localStorage.getItem('sigov_tema');
      this.temaClaro = salvo === 'light';
    } catch {}
    this.aplicarTema();
  }

  alternarTema() {
    this.temaClaro = !this.temaClaro;
    try {
      localStorage.setItem('sigov_tema', this.temaClaro ? 'light' : 'dark');
    } catch {}
    this.aplicarTema();
  }

  private aplicarTema() {
    document.documentElement.setAttribute('data-theme', this.temaClaro ? 'light' : 'dark');
  }

  get estaNoCadastro(): boolean {
    return this.router.url.startsWith('/cadastro');
  }

  get estaNoProjeto(): boolean {
    return this.router.url.startsWith('/projeto/');
  }

  get estaNoCronograma(): boolean {
    return this.router.url.startsWith('/cronograma');
  }

  get estaNoOrcamento(): boolean {
    return this.router.url.startsWith('/orcamento');
  }

  get estaNosObjetivos(): boolean {
    return this.router.url.startsWith('/objetivos');
  }

  get estaNoDashboard(): boolean {
    return this.router.url.startsWith('/dashboard');
  }

  get estaNoPortfolio(): boolean {
    return this.router.url.startsWith('/portfolio');
  }
}
