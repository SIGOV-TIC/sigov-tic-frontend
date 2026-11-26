import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { GraficoTendencia, SerieGrafico } from './grafico-tendencia';
import { redesenhar } from '../../testing/dados';

@Component({
  imports: [GraficoTendencia],
  template: `<app-grafico-tendencia
    titulo="Avanço acumulado · % · jan a mai"
    [rotulos]="rotulos"
    [series]="series"
    [faixa]="faixa"
    [referencia]="referencia"
    [formato]="formato" />`,
})
class Hospedeiro {
  rotulos = ['01/01', '01/02', '01/03'];
  series: SerieGrafico[] = [
    { nome: 'Realizado', cor: 1, estilo: 'realizado', valores: [8, 17, 40] },
    { nome: 'Planejado', cor: 'neutra', estilo: 'planejado', valores: [10, 22, 55] },
  ];
  faixa: { de: number; ate: number } | null = null;
  referencia: number | null = null;
  formato: 'percentual' | 'moeda' | 'indice' = 'percentual';
}

async function montar(ajuste: (h: Hospedeiro) => void = () => {}) {
  TestBed.configureTestingModule({ imports: [Hospedeiro] });
  const fixture = TestBed.createComponent(Hospedeiro);
  ajuste(fixture.componentInstance);
  await redesenhar(fixture);
  const grafico = fixture.debugElement.children[0].componentInstance as GraficoTendencia;
  return { fixture, grafico, el: fixture.nativeElement as HTMLElement };
}

describe('Gráfico de tendência', () => {
  it('o eixo usa números redondos e começa no zero', async () => {
    const { grafico } = await montar();
    expect(grafico.marcas.map((m) => m.rotulo)).toEqual(['0%', '20%', '40%', '60%', '80%']);
  });

  it('em índice o eixo não força o zero, para a variação aparecer', async () => {
    const { grafico } = await montar((h) => {
      h.formato = 'indice';
      h.series = [{ nome: 'IDP', cor: 1, valores: [0.8, 0.77, 0.72] }];
    });
    expect(grafico.limites.min).toBeGreaterThan(0);
    expect(grafico.marcas.map((m) => m.rotulo)).toEqual(['0,70', '0,75', '0,80', '0,85']);
  });

  it('valores em milhões aparecem compactos no eixo e inteiros na tabela', async () => {
    const { grafico, el } = await montar((h) => {
      h.formato = 'moeda';
      h.series = [{ nome: 'Realizado', cor: 1, valores: [120000, 780000, 1500000] }];
    });
    expect(grafico.marcas.map((m) => m.rotulo)).toContain('1,5 mi');
    expect(grafico.formatar(1500000)).toBe('1.500.000');
    expect(el.querySelector('table')).toBeNull();
  });

  it('série com buraco não quebra a linha nem inventa ponto', async () => {
    const { grafico } = await montar((h) => {
      h.series = [{ nome: 'Realizado', cor: 1, valores: [10, null, 40] }];
    });
    const desenhada = grafico.desenhadas[0];
    expect(desenhada.pontos).toHaveLength(2);
    expect(desenhada.fim?.valor).toBe(40);
  });

  it('uma série só não ganha caixa de legenda', async () => {
    const { el } = await montar((h) => {
      h.series = [{ nome: 'Realizado', cor: 1, valores: [1, 2, 3] }];
    });
    expect(el.textContent).not.toContain('Realizado');
  });

  it('duas séries ganham legenda', async () => {
    const { el } = await montar();
    expect(el.textContent).toContain('Realizado');
    expect(el.textContent).toContain('Planejado');
  });

  it('"ver os dados" troca o desenho pela tabela com os mesmos números', async () => {
    const { grafico, el, fixture } = await montar();
    grafico.alternarDados();
    await redesenhar(fixture);

    const tabela = el.querySelector('table')!;
    expect(tabela).toBeTruthy();
    expect(el.querySelector('svg')).toBeNull();
    expect(tabela.textContent).toContain('01/01');
    expect(tabela.textContent).toContain('8%');
    expect(tabela.textContent).toContain('55%');
  });

  it('a faixa de tolerância é desenhada entre os dois limites', async () => {
    const { grafico } = await montar((h) => {
      h.formato = 'indice';
      h.faixa = { de: 0.9, ate: 1.1 };
      h.referencia = 1;
      h.series = [{ nome: 'IDP', cor: 1, valores: [0.8, 0.9, 1.05] }];
    });
    const faixa = grafico.faixaDesenhada!;
    expect(faixa.altura).toBeGreaterThan(0);
    // O topo da faixa fica acima da linha de referência, que fica acima da base.
    expect(faixa.y).toBeLessThan(grafico.yReferencia!);
    expect(grafico.yReferencia!).toBeLessThan(faixa.y + faixa.altura);
  });

  it('o foco na primeira fatia vale, e soltar limpa', async () => {
    const { grafico } = await montar();
    grafico.apontar(0);
    expect(grafico.foco()).toBe(0);
    grafico.soltar();
    expect(grafico.foco()).toBeNull();
  });
});
