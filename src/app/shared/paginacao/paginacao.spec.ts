import { TestBed } from '@angular/core/testing';
import { fatia, Paginacao, totalPaginas } from './paginacao';

describe('paginação', () => {
  it('total de páginas nunca é zero', () => {
    expect(totalPaginas(0, 10)).toBe(1);
    expect(totalPaginas(25, 10)).toBe(3);
  });

  it('fatia a página pedida e cai na última se passar do fim', () => {
    const lista = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(fatia(lista, 1, 10)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(fatia(lista, 3, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(fatia(lista, 9, 10)).toEqual([21, 22, 23, 24, 25]);
    expect(fatia(lista, 0, 10)[0]).toBe(1);
  });

  describe('componente', () => {
    function criar(total: number, pagina: number, tamanho = 10) {
      const fixture = TestBed.createComponent(Paginacao);
      fixture.componentRef.setInput('total', total);
      fixture.componentRef.setInput('pagina', pagina);
      fixture.componentRef.setInput('tamanho', tamanho);
      fixture.detectChanges();
      return fixture.componentInstance;
    }

    it('mostra primeira, última e vizinhas, com reticências no resto', () => {
      const c = criar(200, 10);
      expect(c.botoes().map((b) => ('pagina' in b ? b.pagina : '…'))).toEqual([1, '…', 9, 10, 11, '…', 20]);
      expect([c.de(), c.ate()]).toEqual([91, 100]);
    });

    it('última página mostra só o que sobra', () => {
      const c = criar(25, 3);
      expect([c.de(), c.ate()]).toEqual([21, 25]);
    });

    it('só avisa mudança para página válida e diferente', () => {
      const c = criar(25, 2);
      const emitidas: number[] = [];
      c.mudar.subscribe((p) => emitidas.push(p));
      [0, 2, 3, 4].forEach((p) => c.ir(p));
      expect(emitidas).toEqual([3]);
    });
  });
});
