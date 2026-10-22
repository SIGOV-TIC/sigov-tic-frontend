import { ChangeDetectionStrategy, Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { MatIconModule } from '@angular/material/icon';
import { catchError, forkJoin, of } from 'rxjs';
import { ProjetoResponse } from '../../features/projetos/models/projeto';
import { ProjetoService } from '../../features/projetos/services/projeto.service';
import { Meta, MetaService } from '../../features/objetivos/services/meta.service';

type Tipo = 'projeto' | 'objetivo' | 'meta' | 'fase' | 'atalho';

interface Item {
  tipo: Tipo;
  titulo: string;
  detalhe: string;
  // Texto onde o termo é procurado, já sem acento nem maiúsculas.
  alvo: string;
  rota: string[];
  consulta?: Record<string, string>;
}

interface Grupo {
  rotulo: string;
  itens: Item[];
}

const ROTULO_TIPO: Record<Tipo, string> = {
  projeto: 'Projetos',
  objetivo: 'Objetivos',
  meta: 'Metas',
  fase: 'Fases',
  atalho: 'Ir para',
};

const ICONE_TIPO: Record<Tipo, string> = {
  projeto: 'folder_open',
  objetivo: 'flag',
  meta: 'track_changes',
  fase: 'linear_scale',
  atalho: 'arrow_forward',
};

const ATALHOS: Item[] = [
  { tipo: 'atalho', titulo: 'Novo projeto', detalhe: 'Cadastro', alvo: '', rota: ['/cadastro'] },
  { tipo: 'atalho', titulo: 'Dashboard', detalhe: '', alvo: '', rota: ['/dashboard'] },
  { tipo: 'atalho', titulo: 'Portfólio', detalhe: '', alvo: '', rota: ['/portfolio'] },
  { tipo: 'atalho', titulo: 'Cronograma', detalhe: '', alvo: '', rota: ['/cronograma'] },
  { tipo: 'atalho', titulo: 'Orçamento', detalhe: '', alvo: '', rota: ['/orcamento'] },
  { tipo: 'atalho', titulo: 'Objetivos', detalhe: '', alvo: '', rota: ['/objetivos'] },
];

const POR_GRUPO = 5;
const VALIDADE_MS = 30_000;
const CHAVE_RECENTES = 'sigov_busca_recentes';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  // Os resultados dependem de respostas da API; segue o padrão Eager das demais telas.
  changeDetection: ChangeDetectionStrategy.Eager,
  selector: 'app-busca-global',
  imports: [FormsModule, MatIconModule],
  templateUrl: './busca-global.html',
  styleUrl: './busca-global.scss',
})
export class BuscaGlobal {
  @ViewChild('campo') campo?: ElementRef<HTMLInputElement>;

  aberto = false;
  termo = '';
  ativo = 0;
  carregando = false;
  erro = false;

  grupos: Grupo[] = [];
  plano: Item[] = [];

  readonly icone = ICONE_TIPO;

  private indice: Item[] = [];
  private carregadoEm = 0;

  constructor(
    private projetoService: ProjetoService,
    private metaService: MetaService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
    private auth: AuthService,
  ) {}

  @HostListener('document:keydown', ['$event'])
  aoTeclar(e: KeyboardEvent) {
    const atalho = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
    const alvo = e.target as HTMLElement | null;
    const digitando = !!alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable);
    if (atalho || (e.key === '/' && !digitando && !this.aberto)) {
      e.preventDefault();
      this.abrir();
    }
  }

  @HostListener('document:click', ['$event'])
  aoClicarFora(e: MouseEvent) {
    if (this.aberto && !this.host.nativeElement.contains(e.target as Node)) this.fechar();
  }

  abrir() {
    if (!this.aberto) {
      this.aberto = true;
      this.recarregarSeVelho();
      this.atualizar();
    }
    setTimeout(() => this.campo?.nativeElement.focus());
  }

  fechar() {
    this.aberto = false;
    this.termo = '';
    this.campo?.nativeElement.blur();
  }

  aoDigitar() {
    this.ativo = 0;
    this.atualizar();
  }

  aoTeclarNoCampo(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = this.plano.length;
      if (!n) return;
      this.ativo = (this.ativo + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
      setTimeout(() => this.host.nativeElement.querySelector('.busca-item.ativo')?.scrollIntoView({ block: 'nearest' }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = this.plano[this.ativo];
      if (item) this.ir(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.fechar();
    }
  }

  ir(item: Item) {
    if (item.tipo !== 'atalho') this.lembrar(item);
    this.fechar();
    this.router.navigate(item.rota, item.consulta ? { queryParams: item.consulta } : undefined);
  }

  posicao(item: Item): number {
    return this.plano.indexOf(item);
  }

  // Divide o texto em trechos, marcando onde o termo aparece.
  partes(texto: string): { t: string; m: boolean }[] {
    const tokens = normalizar(this.termo).split(/\s+/).filter(Boolean);
    if (!tokens.length || !texto) return [{ t: texto, m: false }];
    const norm = normalizar(texto);
    const marcado = new Array<boolean>(texto.length).fill(false);
    // normalizar() preserva o comprimento para letras acentuadas pré-compostas.
    if (norm.length === texto.length) {
      for (const tk of tokens) {
        let i = norm.indexOf(tk);
        while (i >= 0) {
          for (let j = i; j < i + tk.length; j++) marcado[j] = true;
          i = norm.indexOf(tk, i + tk.length);
        }
      }
    }
    const saida: { t: string; m: boolean }[] = [];
    for (let i = 0; i < texto.length; i++) {
      const ult = saida[saida.length - 1];
      if (ult && ult.m === marcado[i]) ult.t += texto[i];
      else saida.push({ t: texto[i], m: marcado[i] });
    }
    return saida;
  }

  get rotuloVazio(): string {
    return this.carregando ? 'Carregando…' : this.erro ? 'Não foi possível carregar os dados.' : 'Nenhum resultado.';
  }

  // ---- Dados ----

  private recarregarSeVelho() {
    if (this.carregando || Date.now() - this.carregadoEm < VALIDADE_MS) return;
    this.carregando = true;
    this.erro = false;
    this.projetoService.seedSeNecessario();
    forkJoin({
      projetos: this.projetoService.listar(0, 200).pipe(catchError(() => of(null))),
      metas: this.metaService.listar().pipe(catchError(() => of([] as Meta[]))),
    }).subscribe(({ projetos, metas }) => {
      this.carregando = false;
      if (!projetos) {
        this.erro = true;
      } else {
        this.indice = this.montar(projetos.content, metas);
        this.carregadoEm = Date.now();
      }
      this.atualizar();
    });
  }

  private montar(projetos: ProjetoResponse[], metas: Meta[]): Item[] {
    const itens: Item[] = [];
    const objetivos = new Set<string>();

    for (const p of projetos) {
      const detalhe = [p.sigla, p.areaExecutora || p.areaSolicitante, p.gerenteResponsavel].filter(Boolean).join(' · ');
      itens.push({
        tipo: 'projeto',
        titulo: p.nome,
        detalhe,
        alvo: normalizar([p.nome, p.sigla, p.areaSolicitante, p.areaExecutora, p.gerenteResponsavel, p.po?.nome].filter(Boolean).join(' ')),
        rota: ['/projeto', p.id],
      });
      const obj = (p.objetivoEstrategico ?? '').trim();
      if (obj) objetivos.add(obj);
      for (const f of p.fases ?? []) {
        itens.push({
          tipo: 'fase',
          titulo: f.nome,
          detalhe: p.nome,
          alvo: normalizar(`${f.nome} ${p.nome} ${p.sigla ?? ''}`),
          rota: ['/projeto', p.id],
        });
      }
    }

    for (const m of metas) {
      if (m.objetivo?.trim()) objetivos.add(m.objetivo.trim());
      itens.push({
        tipo: 'meta',
        titulo: m.indicador,
        detalhe: [m.objetivo, m.responsavel].filter(Boolean).join(' · '),
        alvo: normalizar(`${m.indicador} ${m.objetivo} ${m.responsavel ?? ''}`),
        rota: ['/objetivos'],
        consulta: { abrir: m.objetivo },
      });
    }

    for (const o of objetivos) {
      itens.push({ tipo: 'objetivo', titulo: o, detalhe: '', alvo: normalizar(o), rota: ['/objetivos'], consulta: { abrir: o } });
    }
    return itens;
  }

  // ---- Busca ----

  private atualizar() {
    const tokens = normalizar(this.termo).split(/\s+/).filter(Boolean);
    let grupos: Grupo[];

    if (!tokens.length) {
      const recentes = this.lerRecentes();
      grupos = [
        ...(recentes.length ? [{ rotulo: 'Recentes', itens: recentes }] : []),
        { rotulo: ROTULO_TIPO.atalho, itens: ATALHOS.filter((a) => a.rota[0] !== '/cadastro' || this.auth.pode('criarProjeto')) },
      ];
    } else {
      const achados = this.indice
        .map((item) => ({ item, nota: this.nota(item.alvo, tokens) }))
        .filter((r) => r.nota < Infinity)
        .sort((a, b) => a.nota - b.nota || a.item.titulo.localeCompare(b.item.titulo, 'pt-BR'));
      grupos = (['projeto', 'objetivo', 'meta', 'fase'] as Tipo[])
        .map((t) => ({
          rotulo: ROTULO_TIPO[t],
          itens: achados.filter((r) => r.item.tipo === t).slice(0, POR_GRUPO).map((r) => r.item),
        }))
        .filter((g) => g.itens.length);
    }

    this.grupos = grupos;
    this.plano = grupos.flatMap((g) => g.itens);
    if (this.ativo >= this.plano.length) this.ativo = 0;
  }

  // Menor é melhor: 0 começa com o termo, 1 começa uma palavra, 2 contém. Infinity = não casa.
  private nota(alvo: string, tokens: string[]): number {
    let total = 0;
    for (const tk of tokens) {
      const i = alvo.indexOf(tk);
      if (i < 0) return Infinity;
      total += i === 0 ? 0 : alvo[i - 1] === ' ' ? 1 : 2;
    }
    return total;
  }

  // ---- Recentes ----

  private lerRecentes(): Item[] {
    try {
      const bruto = localStorage.getItem(CHAVE_RECENTES);
      return bruto ? (JSON.parse(bruto) as Item[]) : [];
    } catch {
      return [];
    }
  }

  private lembrar(item: Item) {
    try {
      const outros = this.lerRecentes().filter((r) => r.tipo !== item.tipo || r.titulo !== item.titulo);
      localStorage.setItem(CHAVE_RECENTES, JSON.stringify([item, ...outros].slice(0, 4)));
    } catch {}
  }
}
