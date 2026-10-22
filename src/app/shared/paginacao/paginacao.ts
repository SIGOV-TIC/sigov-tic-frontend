import { booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs';

export function totalPaginas(total: number, tamanho: number): number {
  return Math.max(1, Math.ceil(total / tamanho));
}

// Página `pagina` (a partir de 1) da lista; fora do intervalo, cai na última.
export function fatia<T>(lista: T[], pagina: number, tamanho: number): T[] {
  const p = Math.min(Math.max(1, pagina), totalPaginas(lista.length, tamanho));
  return lista.slice((p - 1) * tamanho, p * tamanho);
}

// Página atual guardada em ?pagina=, para voltar ao mesmo ponto. Criar no campo do componente.
export function paginaNaUrl() {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const lida = toSignal(route.queryParamMap.pipe(map((q) => Math.max(1, Math.floor(Number(q.get('pagina'))) || 1))), {
    initialValue: 1,
  });
  return {
    atual: lida,
    // Limita ao total de páginas, para um link antigo não abrir uma página vazia.
    em: (total: number, tamanho: number) => Math.min(lida(), totalPaginas(total, tamanho)),
    ir: (pagina: number) => {
      if (pagina === lida()) return;
      router.navigate([], {
        relativeTo: route,
        queryParams: { pagina: pagina > 1 ? pagina : null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    },
  };
}

type Botao = { pagina: number } | { reticencias: string };

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-paginacao',
  imports: [MatIconModule],
  templateUrl: './paginacao.html',
  styleUrl: './paginacao.scss',
})
export class Paginacao {
  readonly total = input.required<number>();
  readonly pagina = input.required<number>();
  readonly tamanho = input.required<number>();
  // Versão menor, para listas dentro de um grupo.
  readonly compacta = input(false, { transform: booleanAttribute });
  readonly mudar = output<number>();

  readonly paginas = computed(() => totalPaginas(this.total(), this.tamanho()));
  readonly atual = computed(() => Math.min(Math.max(1, this.pagina()), this.paginas()));
  readonly de = computed(() => (this.atual() - 1) * this.tamanho() + 1);
  readonly ate = computed(() => Math.min(this.total(), this.atual() * this.tamanho()));

  // Primeira, última e as vizinhas da atual; o resto vira reticências.
  readonly botoes = computed<Botao[]>(() => {
    const n = this.paginas();
    const a = this.atual();
    const mostrar = [...new Set([1, a - 1, a, a + 1, n])].filter((p) => p >= 1 && p <= n).sort((x, y) => x - y);
    const lista: Botao[] = [];
    mostrar.forEach((p, i) => {
      if (i > 0 && p - mostrar[i - 1] > 1) lista.push({ reticencias: `r${p}` });
      lista.push({ pagina: p });
    });
    return lista;
  });

  ir(p: number) {
    if (p >= 1 && p <= this.paginas() && p !== this.atual()) this.mudar.emit(p);
  }

  ehPagina(b: Botao): b is { pagina: number } {
    return 'pagina' in b;
  }
}
