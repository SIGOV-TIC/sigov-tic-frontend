import { CORES_FASE, corFase, indiceFaseAtual, janelaFase, materializarSituacoes, situacaoFase } from './fase';
import { dia, fase, projeto } from '../../../testing/dados';

describe('fases', () => {
  afterEach(() => vi.useRealTimers());

  it('cores se repetem em ciclo', () => {
    expect(corFase(0)).toBe(CORES_FASE[0]);
    expect(corFase(CORES_FASE.length)).toBe(CORES_FASE[0]);
  });

  it('janela usa as datas da fase quando existem', () => {
    const j = janelaFase(projeto(), 1)!;
    expect(j.ini).toEqual(new Date(2026, 3, 1));
    expect(j.fim).toEqual(new Date(2026, 8, 30));
  });

  it('sem datas, a janela vem da duração acumulada desde o início do projeto', () => {
    const p = projeto({ fases: [fase({ duracaoMeses: 2 }), fase({ duracaoMeses: 3 })] });
    const j = janelaFase(p, 1)!;
    expect(j.ini).toEqual(new Date(2026, 2, 1));
    expect(j.fim).toEqual(new Date(2026, 5, 1));
    expect(janelaFase(p, 5)).toBeNull();
    expect(janelaFase(projeto({ dataInicioPrevista: undefined }), 0)).toBeNull();
  });

  it('situação registrada prevalece', () => {
    expect(situacaoFase(projeto(), 0)).toBe('CONCLUIDA');
    expect(situacaoFase(projeto(), 2)).toBe('PENDENTE');
  });

  it('dados antigos sem situação seguem o calendário', () => {
    vi.useFakeTimers();
    vi.setSystemTime(dia('2026-05-10'));
    const p = projeto();
    p.fases!.forEach((f) => (f.situacao = undefined));
    expect([0, 1, 2].map((i) => situacaoFase(p, i))).toEqual(['CONCLUIDA', 'EM_ANDAMENTO', 'PENDENTE']);
  });

  it('fase atual é a em andamento, ou a primeira não concluída', () => {
    expect(indiceFaseAtual(projeto())).toBe(1);
    const p = projeto();
    p.fases![1].situacao = 'PENDENTE';
    expect(indiceFaseAtual(p)).toBe(1);
    p.fases!.forEach((f) => (f.situacao = 'CONCLUIDA'));
    expect(indiceFaseAtual(p)).toBe(-1);
  });

  it('materializar grava a situação calculada só quando nenhuma foi registrada', () => {
    vi.useFakeTimers();
    vi.setSystemTime(dia('2026-05-10'));
    const p = projeto();
    p.fases!.forEach((f) => (f.situacao = undefined));
    materializarSituacoes(p);
    expect(p.fases!.map((f) => f.situacao)).toEqual(['CONCLUIDA', 'EM_ANDAMENTO', 'PENDENTE']);

    const registrado = projeto();
    registrado.fases![2].situacao = undefined;
    materializarSituacoes(registrado);
    expect(registrado.fases![2].situacao).toBeUndefined();
  });
});
