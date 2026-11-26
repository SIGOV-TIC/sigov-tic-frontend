import { ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { Observable } from 'rxjs';
import { Escolha } from '../../../shared/escolha/escolha';
import { Opcoes, OpcoesService } from '../../../shared/escolha/opcoes.service';
import { NovaSolicitacao, Solicitacao, SolicitacaoService, StatusSolicitacao, TIPOS, TipoSolicitacao } from '../services/solicitacao.service';

type Aba = 'decidir' | 'minhas';
type Filtro = 'TODAS' | StatusSolicitacao;

const ROTULO_STATUS: Record<StatusSolicitacao, string> = {
  PENDENTE: 'Aguardando PMO',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
};

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-solicitacoes',
  imports: [FormsModule, MatIconModule, DatePipe, AsyncPipe, Escolha],
  templateUrl: './solicitacoes.html',
  styleUrl: './solicitacoes.scss',
})
export class Solicitacoes implements OnInit {
  minhas: Solicitacao[] = [];
  pendentes: Solicitacao[] = [];
  carregando = true;
  erro = false;

  readonly decide: boolean;
  aba: Aba;
  filtro: Filtro = 'TODAS';
  readonly filtros: { valor: Filtro; rotulo: string }[] = [
    { valor: 'TODAS', rotulo: 'Todas' },
    { valor: 'PENDENTE', rotulo: 'Aguardando' },
    { valor: 'APROVADA', rotulo: 'Aprovadas' },
    { valor: 'RECUSADA', rotulo: 'Recusadas' },
  ];

  readonly tipos = TIPOS;
  opcoes$?: Observable<Opcoes>;

  constructor(
    private service: SolicitacaoService,
    private opcoesService: OpcoesService,
    auth: AuthService,
  ) {
    this.decide = auth.pode('decidirSolicitacoes');
    this.aba = this.decide ? 'decidir' : 'minhas';
  }

  ngOnInit() {
    this.carregar();
  }

  carregar() {
    this.carregando = true;
    this.erro = false;
    let faltam = this.decide ? 2 : 1;
    const fim = () => {
      if (--faltam === 0) this.carregando = false;
    };
    const falha = () => {
      this.erro = true;
      fim();
    };
    this.service.minhas().subscribe({ next: (s) => ((this.minhas = s), fim()), error: falha });
    if (this.decide) this.service.pendentes().subscribe({ next: (s) => ((this.pendentes = s), fim()), error: falha });
  }

  get lista(): Solicitacao[] {
    if (this.aba === 'decidir') return this.pendentes;
    return this.filtro === 'TODAS' ? this.minhas : this.minhas.filter((s) => s.status === this.filtro);
  }

  contar(f: Filtro): number {
    return f === 'TODAS' ? this.minhas.length : this.minhas.filter((s) => s.status === f).length;
  }

  reais(v: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  }

  rotuloTipo(t?: TipoSolicitacao | null): string {
    return TIPOS.find((x) => x.valor === t)?.rotulo ?? '';
  }

  rotuloStatus(s: StatusSolicitacao): string {
    return ROTULO_STATUS[s];
  }

  // ---- Painel: nova solicitação ou detalhe ----

  nova: NovaSolicitacao | null = null;
  aberta: Solicitacao | null = null;
  enviando = false;
  erroPainel = '';
  justificativa = '';

  abrirNova() {
    this.fechar();
    this.opcoes$ ??= this.opcoesService.carregar();
    this.nova = { tipo: 'NOVO_PROJETO', titulo: '', descricao: '', areaDemandante: '', objetivoEstrategico: '', poSugerido: '', prazoMeses: null, custoEstimado: null };
  }

  abrirDetalhe(s: Solicitacao) {
    this.fechar();
    this.aberta = s;
  }

  @HostListener('document:keydown.escape')
  fechar() {
    this.nova = null;
    this.aberta = null;
    this.erroPainel = '';
    this.justificativa = '';
  }

  get podeDecidirAberta(): boolean {
    return this.decide && this.aberta?.status === 'PENDENTE';
  }

  enviar() {
    const n = this.nova;
    if (!n) return;
    const titulo = n.titulo.trim();
    const descricao = n.descricao.trim();
    if (!titulo || !descricao) {
      this.erroPainel = 'Preencha título e descrição.';
      return;
    }
    this.enviando = true;
    this.erroPainel = '';
    if (n.prazoMeses != null && (n.prazoMeses < 1 || n.prazoMeses > 120)) {
      this.erroPainel = 'O prazo deve ficar entre 1 e 120 meses.';
      return;
    }
    if (n.custoEstimado != null && n.custoEstimado < 0) {
      this.erroPainel = 'O custo não pode ser negativo.';
      return;
    }
    const projeto = n.tipo === 'NOVO_PROJETO';
    this.service.abrir({
      tipo: n.tipo,
      titulo,
      descricao,
      areaDemandante: n.areaDemandante?.trim() || null,
      objetivoEstrategico: projeto ? n.objetivoEstrategico?.trim() || null : null,
      poSugerido: projeto ? n.poSugerido?.trim() || null : null,
      prazoMeses: projeto ? n.prazoMeses : null,
      custoEstimado: projeto ? n.custoEstimado : null,
    }).subscribe({
      next: (s) => {
        this.minhas = [s, ...this.minhas];
        if (this.decide) this.pendentes = [...this.pendentes, s];
        this.enviando = false;
        this.aba = 'minhas';
        this.filtro = 'TODAS';
        this.fechar();
      },
      error: () => {
        this.enviando = false;
        this.erroPainel = 'Não foi possível enviar a solicitação. Tente de novo.';
      },
    });
  }

  decidir(aprovada: boolean) {
    const s = this.aberta;
    if (!s) return;
    this.enviando = true;
    this.erroPainel = '';
    this.service.decidir(s.id, aprovada, this.justificativa.trim()).subscribe({
      next: (d) => {
        this.pendentes = this.pendentes.filter((p) => p.id !== d.id);
        this.minhas = this.minhas.map((m) => (m.id === d.id ? d : m));
        this.enviando = false;
        this.fechar();
      },
      error: () => {
        this.enviando = false;
        this.erroPainel = 'Não foi possível registrar a decisão. Recarregue a página e tente de novo.';
      },
    });
  }
}
