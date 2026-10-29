import { analisarProjeto, estadoProjeto, progressoProjeto } from './saude';
import { dia, fase, projeto } from '../../../testing/dados';

describe('saúde do projeto', () => {
  afterEach(() => vi.useRealTimers());

  function em(data: string) {
    vi.useFakeTimers();
    vi.setSystemTime(dia(data));
    return dia(data);
  }

  it('fase concluída, fase atual no ritmo e fase futura', () => {
    const hoje = em('2026-07-01');
    const a = analisarProjeto(projeto(), hoje)!;
    expect(a.estados).toEqual(['CONCLUIDO', 'ANDAMENTO', 'A_INICIAR']);
    expect(a.estado).toBe('ANDAMENTO');
    expect(a.atual).toBe(1);
  });

  it('fase atual abaixo do tempo decorrido além da margem fica em risco', () => {
    const hoje = em('2026-07-01');
    const p = projeto();
    p.fases![1].percentual = 20;
    expect(analisarProjeto(p, hoje)!.estados[1]).toBe('RISCO');
    expect(estadoProjeto(p, hoje)).toBe('RISCO');
  });

  it('a margem de risco é de 15 pontos', () => {
    const hoje = em('2026-07-01');
    const p = projeto();
    p.fases![1].percentual = 36; // ~50% do tempo, 14 pontos abaixo
    expect(analisarProjeto(p, hoje)!.estados[1]).toBe('ANDAMENTO');
  });

  it('fase que passou do fim sem concluir atrasa a fase e o projeto', () => {
    const hoje = em('2026-10-15');
    const a = analisarProjeto(projeto(), hoje)!;
    expect(a.estados[1]).toBe('ATRASADO');
    // A seguinte já deveria ter começado e a anterior não fechou.
    expect(a.estados[2]).toBe('ATRASADO');
    expect(a.estado).toBe('ATRASADO');
  });

  it('projeto marcado como concluído é concluído', () => {
    const hoje = em('2026-07-01');
    expect(estadoProjeto(projeto({ prazoQuadrante: 'CONCLUIDO' }), hoje)).toBe('CONCLUIDO');
  });

  it('antes do início o projeto está a iniciar', () => {
    const hoje = em('2025-12-01');
    const p = projeto();
    p.fases!.forEach((f) => (f.situacao = 'PENDENTE'));
    expect(estadoProjeto(p, hoje)).toBe('A_INICIAR');
  });

  it('sem datas não há análise', () => {
    expect(analisarProjeto(projeto({ dataInicioPrevista: undefined }))).toBeNull();
    expect(estadoProjeto(projeto({ dataConclusaoPrevista: undefined }))).toBe('A_INICIAR');
  });

  it('sem fases, o quadrante de prazo decide', () => {
    const hoje = em('2026-07-01');
    expect(estadoProjeto(projeto({ fases: [], prazoQuadrante: 'ATENCAO' }), hoje)).toBe('RISCO');
    expect(estadoProjeto(projeto({ fases: [], prazoQuadrante: 'ATRASADO' }), hoje)).toBe('ATRASADO');
    expect(estadoProjeto(projeto({ fases: [] }), em('2027-02-01'))).toBe('ATRASADO');
  });

  describe('avanço físico', () => {
    it('pondera as fases pela duração', () => {
      // 3 meses concluídos + metade de 6 meses, de 12 meses
      expect(progressoProjeto(projeto())).toBe(50);
    });

    it('fase em andamento sem percentual conta zero', () => {
      const p = projeto();
      p.fases![1].percentual = undefined;
      expect(progressoProjeto(p)).toBe(25);
    });

    it('percentual acima de 100 é limitado', () => {
      const p = projeto({ fases: [fase({ duracaoMeses: 1, situacao: 'EM_ANDAMENTO', percentual: 150 })] });
      expect(progressoProjeto(p)).toBe(100);
    });

    it('sem fases, só o projeto concluído vale 100', () => {
      expect(progressoProjeto(projeto({ fases: [] }))).toBe(0);
      expect(progressoProjeto(projeto({ fases: [], prazoQuadrante: 'CONCLUIDO' }))).toBe(100);
    });
  });
});
