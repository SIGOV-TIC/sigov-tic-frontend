import { PERFIS, rotuloPerfil } from './perfis';

describe('perfis', () => {
  it('oferece os quatro perfis em uso', () => {
    expect(PERFIS.map((p) => p.valor)).toEqual(['ADMIN', 'ESCRITORIO', 'GESTOR_PROJETO', 'USER']);
  });

  it('rótulo conhecido ou o próprio valor', () => {
    expect(rotuloPerfil('USER')).toBe('Visualizador');
    expect(rotuloPerfil('LEGADO')).toBe('LEGADO');
  });
});
