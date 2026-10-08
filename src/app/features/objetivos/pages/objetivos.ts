import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjetoResponse } from '../../projetos/models/projeto';
import { ProjetoService } from '../../projetos/services/projeto.service';
import { Estado, ICONE_ESTADO, ORDEM_ESTADOS, ROTULO_ESTADO, estadoProjeto, progressoProjeto } from '../../projetos/utils/saude';

interface ProjetoDoObjetivo {
  projeto: ProjetoResponse;
  estado: Estado;
  avanco: number;
}

interface Objetivo {
  titulo: string;
  semDefinicao: boolean;
  projetos: ProjetoDoObjetivo[];
  progresso: number;
  contagem: { estado: Estado; qtd: number }[];
  pior: Estado;
  iniciativas: string[];
  indicadores: string[];
}

const SEM_OBJETIVO = 'Sem objetivo estratégico definido';

@Component({
  selector: 'app-objetivos',
  imports: [RouterLink, MatIconModule],
  templateUrl: './objetivos.html',
  styleUrl: './objetivos.scss',
})
export class Objetivos implements OnInit {
  projetos: ProjetoResponse[] = [];
  carregando = true;

  readonly rotulo = ROTULO_ESTADO;
  readonly icone = ICONE_ESTADO;

  constructor(private projetoService: ProjetoService) {}

  ngOnInit() {
    this.projetoService.seedSeNecessario();
    this.projetoService.listar(0, 200).subscribe({
      next: (res) => {
        this.projetos = res.content;
        this.carregando = false;
      },
      error: () => (this.carregando = false),
    });
  }

  // Um objetivo por texto distinto de "objetivo estratégico" dos projetos.
  get objetivos(): Objetivo[] {
    const mapa = new Map<string, ProjetoDoObjetivo[]>();
    this.projetos
      .filter((p) => p.status !== 'REJEITADO')
      .forEach((p) => {
        const titulo = (p.objetivoEstrategico ?? '').trim() || SEM_OBJETIVO;
        const item = { projeto: p, estado: estadoProjeto(p), avanco: progressoProjeto(p) };
        mapa.set(titulo, [...(mapa.get(titulo) ?? []), item]);
      });

    return [...mapa.entries()]
      .map(([titulo, projetos]) => {
        projetos.sort((a, b) => ORDEM_ESTADOS.indexOf(a.estado) - ORDEM_ESTADOS.indexOf(b.estado));
        const contagem = ORDEM_ESTADOS.map((estado) => ({
          estado,
          qtd: projetos.filter((x) => x.estado === estado).length,
        })).filter((c) => c.qtd > 0);
        const unicos = (valores: (string | undefined)[]) => [...new Set(valores.map((v) => (v ?? '').trim()).filter(Boolean))];
        return {
          titulo,
          semDefinicao: titulo === SEM_OBJETIVO,
          projetos,
          progresso: Math.round(projetos.reduce((a, x) => a + x.avanco, 0) / projetos.length),
          contagem,
          pior: projetos[0].estado,
          iniciativas: unicos(projetos.map((x) => x.projeto.iniciativaEstrategica)),
          indicadores: unicos(projetos.map((x) => x.projeto.indicadorEstrategico)),
        };
      })
      .sort(
        (a, b) =>
          Number(a.semDefinicao) - Number(b.semDefinicao) ||
          ORDEM_ESTADOS.indexOf(a.pior) - ORDEM_ESTADOS.indexOf(b.pior) ||
          a.titulo.localeCompare(b.titulo),
      );
  }

  get exigemAtencao(): number {
    return this.objetivos.filter((o) => o.pior === 'ATRASADO' || o.pior === 'RISCO').length;
  }

  get semAlerta(): number {
    return this.objetivos.length - this.exigemAtencao;
  }

  get totalProjetos(): number {
    return this.objetivos.reduce((a, o) => a + o.projetos.length, 0);
  }

  // Frase curta dizendo o que está pior, com os projetos responsáveis.
  atencao(o: Objetivo): string | null {
    const atrasados = o.projetos.filter((x) => x.estado === 'ATRASADO').map((x) => x.projeto.sigla);
    const risco = o.projetos.filter((x) => x.estado === 'RISCO').map((x) => x.projeto.sigla);
    const partes: string[] = [];
    if (atrasados.length) partes.push(`${atrasados.length === 1 ? 'Atrasado' : 'Atrasados'}: ${atrasados.join(', ')}`);
    if (risco.length) partes.push(`Em risco: ${risco.join(', ')}`);
    return partes.length ? partes.join(' · ') : null;
  }
}
