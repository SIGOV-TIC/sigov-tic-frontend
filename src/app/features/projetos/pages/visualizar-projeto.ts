import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse, StatusProjeto } from '../models/projeto';
import { ProjetoService } from '../services/projeto.service';

@Component({
  selector: 'app-visualizar-projeto',
  imports: [RouterLink, MatIconModule],
  templateUrl: './visualizar-projeto.html',
  styleUrl: './visualizar-projeto.scss',
})
export class VisualizarProjeto implements OnInit {
  projeto!: ProjetoResponse;
  carregando = true;

  constructor(
    private route: ActivatedRoute,
    private projetoService: ProjetoService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.projetoService.obter(id).subscribe((p) => {
      this.projeto = p;
      this.carregando = false;
    });
  }

  get percentualDecorrido(): number {
    if (!this.projeto?.dataInicioPrevista || !this.projeto?.dataConclusaoPrevista) return 0;
    const inicio = new Date(this.projeto.dataInicioPrevista).getTime();
    const fim = new Date(this.projeto.dataConclusaoPrevista).getTime();
    const hoje = Date.now();
    if (fim <= inicio) return 0;
    const pct = ((hoje - inicio) / (fim - inicio)) * 100;
    return Math.round(Math.min(100, Math.max(0, pct)));
  }

  get mesesDecorridos(): number {
    if (!this.projeto?.dataInicioPrevista) return 0;
    const inicio = new Date(this.projeto.dataInicioPrevista);
    const hoje = new Date();
    const diff = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    return Math.max(0, diff);
  }

  get mesesTotais(): number {
    if (!this.projeto?.dataInicioPrevista || !this.projeto?.dataConclusaoPrevista) return 0;
    const inicio = new Date(this.projeto.dataInicioPrevista);
    const fim = new Date(this.projeto.dataConclusaoPrevista);
    const diff = (fim.getFullYear() - inicio.getFullYear()) * 12 + (fim.getMonth() - inicio.getMonth());
    return Math.max(0, diff);
  }

  get totalSquad(): number {
    return (this.projeto?.qtdProprios || 0) + (this.projeto?.qtdTerceiros || 0);
  }

  formatarMoeda(valor?: number): string {
    if (!valor) return '—';
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  statusLabel(status?: StatusProjeto): string {
    const map: Record<string, string> = {
      RASCUNHO: 'Rascunho',
      AGUARDANDO_APROVACAO: 'Aguardando Aprovação',
      APROVADO: 'Aprovado',
      REJEITADO: 'Rejeitado',
    };
    return map[status || ''] || 'Rascunho';
  }

  statusClasse(status?: StatusProjeto): string {
    const map: Record<string, string> = {
      RASCUNHO: 'status-rascunho',
      AGUARDANDO_APROVACAO: 'status-aguardando',
      APROVADO: 'status-aprovado',
      REJEITADO: 'status-rejeitado',
    };
    return map[status || ''] || 'status-rascunho';
  }
}
