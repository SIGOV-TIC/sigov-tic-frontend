import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  selector: 'app-layout',
  styleUrl: './layout.scss',
  templateUrl: './layout.html',
})
export class Layout implements OnInit {
  temaClaro = false;

  constructor(private router: Router) {}

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

  get estaNoDashboard(): boolean {
    return this.router.url.startsWith('/dashboard');
  }

  get estaNoPortfolio(): boolean {
    return this.router.url.startsWith('/portfolio');
  }
}
