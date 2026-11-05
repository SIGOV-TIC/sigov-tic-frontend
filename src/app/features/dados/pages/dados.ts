import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { RetratoService } from '../../status-report/services/retrato.service';
import {
  formatarMetrica,
  LinhaFato,
  METRICAS,
  Metrica,
  Recorte,
  ROTULO_METRICA,
} from '../../status-report/models/retrato';
import { EstadoTela } from '../../../shared/estado/estado';
import { mensagemDeErro } from '../../../shared/estado/erro-api';
import { fatia, Paginacao, paginaNaUrl } from '../../../shared/paginacao/paginacao';

const POR_PAGINA = 25;

@Component({
  // Os dados chegam da API depois da renderização; sem Eager a tela não atualiza.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-dados',
  imports: [FormsModule, MatIconModule, EstadoTela, Paginacao],
  templateUrl: './dados.html',
  styleUrl: './dados.scss',
})
export class Dados implements OnInit {
  projetos: ProjetoResponse[] = [];
  areas: string[] = [];
  linhas: LinhaFato[] = [];
  carregando = true;
  erro = '';
  baixando = false;

  readonly metricas = METRICAS;
  readonly rotuloMetrica = ROTULO_METRICA;
  readonly porPagina = POR_PAGINA;
  readonly pagina = paginaNaUrl();

  // O recorte vive na URL: o mesmo link abre a mesma tabela.
  recorte: Required<Recorte> = { projeto: '', area: '', de: '', ate: '', metricas: [] };

  constructor(
    private projetoService: ProjetoService,
    private retratoService: RetratoService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    this.recorte = {
      projeto: q.get('projeto') ?? '',
      area: q.get('area') ?? '',
      de: q.get('de') ?? '',
      ate: q.get('ate') ?? '',
      metricas: q.getAll('metrica') as Metrica[],
    };
    this.projetoService.listar(0, 100).subscribe({
      next: (pagina) => (this.projetos = [...pagina.content].sort((a, b) => a.sigla.localeCompare(b.sigla))),
      error: () => (this.projetos = []),
    });
    this.retratoService.areas().subscribe({ next: (a) => (this.areas = a), error: () => (this.areas = []) });
    this.buscar();
  }

  buscar() {
    this.carregando = true;
    this.erro = '';
    this.retratoService.fatos(this.recorte).subscribe({
      next: (linhas) => {
        this.linhas = linhas;
        this.carregando = false;
      },
      error: (e) => {
        this.carregando = false;
        this.linhas = [];
        this.erro = mensagemDeErro(e, 'os dados');
      },
    });
  }

  filtrar() {
    this.gravarNaUrl();
    this.pagina.ir(1);
    this.buscar();
  }

  limpar() {
    this.recorte = { projeto: '', area: '', de: '', ate: '', metricas: [] };
    this.filtrar();
  }

  get temFiltro(): boolean {
    const r = this.recorte;
    return !!(r.projeto || r.area || r.de || r.ate || r.metricas.length);
  }

  alternarMetrica(metrica: Metrica) {
    const atual = this.recorte.metricas;
    this.recorte.metricas = atual.includes(metrica) ? atual.filter((m) => m !== metrica) : [...atual, metrica];
    this.filtrar();
  }

  marcada(metrica: Metrica): boolean {
    return this.recorte.metricas.includes(metrica);
  }

  private gravarNaUrl() {
    const r = this.recorte;
    this.router.navigate([], {
      queryParams: {
        projeto: r.projeto || null,
        area: r.area || null,
        de: r.de || null,
        ate: r.ate || null,
        metrica: r.metricas.length ? r.metricas : null,
        pagina: null,
      },
      replaceUrl: true,
    });
  }

  // ---- Tabela ----

  get total(): number {
    return this.linhas.length;
  }

  get paginaAtual(): number {
    return this.pagina.em(this.total, POR_PAGINA);
  }

  get visiveis(): LinhaFato[] {
    return fatia(this.linhas, this.paginaAtual, POR_PAGINA);
  }

  get quinzenas(): number {
    return new Set(this.linhas.map((l) => l.quinzenaInicio)).size;
  }

  get projetosNaTabela(): number {
    return new Set(this.linhas.map((l) => l.projetoId)).size;
  }

  // ---- Saída ----

  baixarCsv() {
    if (this.baixando) return;
    this.baixando = true;
    this.retratoService.csv(this.recorte).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SIGOV-TIC_dados_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.baixando = false;
      },
      error: (e) => {
        this.baixando = false;
        this.erro = mensagemDeErro(e, 'os dados');
      },
    });
  }

  // ---- Texto ----

  valor(linha: LinhaFato): string {
    return formatarMetrica(linha.metrica, linha.valor);
  }

  meta(linha: LinhaFato): string {
    return formatarMetrica(linha.metrica, linha.meta);
  }

  quinzena(linha: LinhaFato): string {
    const [, mesI, diaI] = linha.quinzenaInicio.split('-');
    const [ano, , diaF] = linha.quinzenaFim.split('-');
    return `${diaI} a ${diaF}/${mesI}/${ano}`;
  }
}
