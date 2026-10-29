import { moedaCompacta } from './moeda';

describe('moedaCompacta', () => {
  const limpo = (s: string) => s.replace(/\s/g, ' ');

  it('abrevia milhões e milhares em reais', () => {
    expect(limpo(moedaCompacta(9_400_000))).toBe('R$ 9,4 mi');
    expect(limpo(moedaCompacta(710_000))).toBe('R$ 710 mil');
  });

  it('valor ausente vira zero', () => {
    expect(limpo(moedaCompacta(undefined as unknown as number))).toBe('R$ 0');
  });
});
