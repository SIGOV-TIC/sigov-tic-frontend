import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Atividade, Atualizacao, ProjetoResponse, SituacaoFase } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { analisarProjeto, Estado, ICONE_ESTADO, progressoProjeto, ROTULO_ESTADO } from '../../projetos/utils/saude';
import { calcularDesvio, fracaoDecorrida, TOLERANCIA_DESVIO } from '../../projetos/utils/desvio';
import { situacaoFase } from '../../projetos/utils/fase';

// Quinzena do relatório: 1 a 15, ou 16 ao fim do mês.
interface Quinzena {
  chave: string; // 2026-10-2
  ini: string;
  fim: string;
  rotulo: string;
}

interface AtividadeNaFase {
  atividade: Atividade;
  fase: string;
}

// Dias depois do fim da quinzena que entram em "próximas entregas".
const HORIZONTE_DIAS = 15;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function quinzenaDe(ano: number, mes: number, metade: 1 | 2): Quinzena {
  const ultimo = new Date(ano, mes + 1, 0).getDate();
  const ini = new Date(ano, mes, metade === 1 ? 1 : 16);
  const fim = new Date(ano, mes, metade === 1 ? 15 : ultimo);
  return {
    chave: `${ano}-${mes + 1}-${metade}`,
    ini: iso(ini),
    fim: iso(fim),
    rotulo: `${ini.getDate()} a ${fim.getDate()} de ${MESES[mes]} ${ano}`,
  };
}

@Component({
  // Dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-status-report',
  imports: [RouterLink, FormsModule, MatIconModule, NgTemplateOutlet],
  templateUrl: './status-report.html',
  styleUrl: './status-report.scss',
})
export class StatusReport implements OnInit {
  projetos: ProjetoResponse[] = [];
  projeto: ProjetoResponse | null = null;
  carregando = true;
  erro = false;

  // A quinzena atual e as cinco anteriores.
  readonly quinzenas: Quinzena[] = (() => {
    const hoje = new Date();
    let ano = hoje.getFullYear();
    let mes = hoje.getMonth();
    let metade: 1 | 2 = hoje.getDate() > 15 ? 2 : 1;
    const lista: Quinzena[] = [];
    for (let i = 0; i < 6; i++) {
      lista.push(quinzenaDe(ano, mes, metade));
      if (metade === 2) metade = 1;
      else {
        metade = 2;
        mes -= 1;
        if (mes < 0) {
          mes = 11;
          ano -= 1;
        }
      }
    }
    return lista;
  })();
  quinzena = this.quinzenas[0];
  readonly emissao = iso(new Date());

  constructor(
    private projetoService: ProjetoService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.quinzena = this.quinzenas.find((q) => q.chave === params.get('quinzena')) ?? this.quinzenas[0];
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 100).subscribe({
      next: (pagina) => {
        this.projetos = [...pagina.content].sort((a, b) => a.sigla.localeCompare(b.sigla));
        const id = params.get('projeto');
        this.selecionar(this.projetos.find((p) => p.id === id)?.id ?? this.projetos[0]?.id);
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  // A lista não traz tudo o que o relatório usa de forma garantida; o projeto vem completo pelo id.
  selecionar(id?: string) {
    if (!id) {
      this.carregando = false;
      return;
    }
    this.carregando = true;
    this.projetoService.obter(id).subscribe({
      next: (p) => {
        this.projeto = p;
        this.carregando = false;
        this.gravarNaUrl();
      },
      error: () => {
        this.carregando = false;
        this.erro = true;
      },
    });
  }

  mudarQuinzena() {
    this.gravarNaUrl();
  }

  private gravarNaUrl() {
    this.router.navigate([], {
      queryParams: { projeto: this.projeto?.id, quinzena: this.quinzena.chave },
      replaceUrl: true,
    });
  }

  imprimir() {
    window.print();
  }

  // Data de referência: o fim da quinzena, ou hoje se ela ainda não acabou.
  private get referencia(): string {
    return this.quinzena.fim < this.emissao ? this.quinzena.fim : this.emissao;
  }

  get estado(): Estado {
    return (this.projeto && analisarProjeto(this.projeto)?.estado) || 'A_INICIAR';
  }

  get rotuloEstado(): string {
    return ROTULO_ESTADO[this.estado];
  }

  get iconeEstado(): string {
    return ICONE_ESTADO[this.estado];
  }

  get avanco(): number {
    return this.projeto ? progressoProjeto(this.projeto) : 0;
  }

  get esperado(): number | null {
    const f = this.projeto ? fracaoDecorrida(this.projeto) : null;
    return f == null ? null : Math.round(f * 100);
  }

  get indices() {
    return this.projeto ? calcularDesvio(this.projeto) : null;
  }

  // Índice fora da tolerância de 10% para baixo.
  abaixo(indice: number | null | undefined): boolean {
    return indice != null && indice < 1 - TOLERANCIA_DESVIO / 100;
  }

  get atualizacoesDoPeriodo(): Atualizacao[] {
    return (this.projeto?.atualizacoes ?? []).filter((a) => a.data >= this.quinzena.ini && a.data <= this.quinzena.fim);
  }

  get fases() {
    const p = this.projeto;
    if (!p) return [];
    const analise = analisarProjeto(p);
    return (p.fases ?? []).map((f, i) => ({
      fase: f,
      situacao: situacaoFase(p, i) as SituacaoFase,
      estado: analise?.estados[i],
    }));
  }

  private get atividades(): AtividadeNaFase[] {
    return (this.projeto?.fases ?? []).flatMap((f) => (f.atividades ?? []).map((atividade) => ({ atividade, fase: f.nome })));
  }

  get atrasadas(): AtividadeNaFase[] {
    const ref = this.referencia;
    return this.atividades
      .filter(({ atividade: a }) => a.situacao !== 'CONCLUIDA' && !!a.prazo && a.prazo < ref)
      .sort((x, y) => x.atividade.prazo!.localeCompare(y.atividade.prazo!));
  }

  get proximas(): AtividadeNaFase[] {
    const ref = this.referencia;
    const [a, m, d] = ref.split('-').map(Number);
    const limite = iso(new Date(a, m - 1, d + HORIZONTE_DIAS));
    return this.atividades
      .filter(({ atividade: x }) => x.situacao !== 'CONCLUIDA' && !!x.prazo && x.prazo >= ref && x.prazo <= limite)
      .sort((x, y) => x.atividade.prazo!.localeCompare(y.atividade.prazo!));
  }

  readonly horizonte = HORIZONTE_DIAS;

  rotuloSituacao(s: SituacaoFase): string {
    return { PENDENTE: 'Pendente', EM_ANDAMENTO: 'Em andamento', CONCLUIDA: 'Concluída' }[s];
  }

  data(valor?: string | null): string {
    if (!valor) return '—';
    const [a, m, d] = valor.split('-');
    return `${d}/${m}/${a}`;
  }

  dataCurta(valor?: string | null): string {
    if (!valor) return '—';
    const [, m, d] = valor.split('-');
    return `${d}/${m}`;
  }

  indice(valor: number | null | undefined): string {
    return valor == null ? '—' : valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
