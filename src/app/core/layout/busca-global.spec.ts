import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BuscaGlobal } from './busca-global';
import { entrarComo, meta, projeto, responderListagem } from '../../testing/dados';

async function abrir(perfil: 'ESCRITORIO' | 'USER' = 'USER') {
  entrarComo(perfil);
  TestBed.configureTestingModule({ imports: [BuscaGlobal], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(BuscaGlobal);
  const api = TestBed.inject(HttpTestingController);
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigate').mockResolvedValue(true);
  await fixture.whenStable();
  const busca = fixture.componentInstance;
  return { busca, api, router, fixture };
}

function carregar(api: HttpTestingController) {
  responderListagem(api, [
    projeto({ id: 'p1', nome: 'Implantação do ERP', sigla: 'ERP', gerenteResponsavel: 'Cláudio', objetivoEstrategico: 'Eficiência operacional' }),
    projeto({ id: 'p2', nome: 'Gestão de serviços', sigla: 'GSE', areaSolicitante: 'Atendimento', fases: [{ nome: 'Homologação', duracaoMeses: 2 }] }),
  ]);
  api.expectOne('/api/metas').flush([meta({ indicador: 'Serviços digitais', objetivo: 'Transformação digital', responsavel: 'Escritório' })]);
}

describe('Busca global', () => {
  afterEach(() => localStorage.clear());

  it('Ctrl+K e / abrem; / não abre quando se está digitando', async () => {
    const { busca } = await abrir();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(busca.aberto).toBe(true);
    busca.fechar();
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(busca.aberto).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    expect(busca.aberto).toBe(true);
    campo.remove();
  });

  it('sem termo mostra atalhos; Novo projeto só para quem pode criar', async () => {
    const leitor = await abrir('USER');
    leitor.busca.abrir();
    expect(leitor.busca.plano.map((i) => i.titulo)).not.toContain('Novo projeto');

    TestBed.resetTestingModule();
    const pmo = await abrir('ESCRITORIO');
    pmo.busca.abrir();
    expect(pmo.busca.plano[0].titulo).toBe('Novo projeto');
  });

  it('acha projetos, objetivos, metas e fases, ignorando acentos e maiúsculas', async () => {
    const { busca, api } = await abrir();
    busca.abrir();
    carregar(api);
    busca.termo = 'SERVICOS';
    busca.aoDigitar();
    expect(busca.grupos.map((g) => [g.rotulo, g.itens.map((i) => i.titulo)])).toEqual([
      ['Projetos', ['Gestão de serviços']],
      ['Metas', ['Serviços digitais']],
      // A fase também é achada pelo nome do projeto a que pertence.
      ['Fases', ['Homologação']],
    ]);
    busca.termo = 'homolog';
    busca.aoDigitar();
    expect(busca.plano.map((i) => `${i.tipo}:${i.titulo}`)).toEqual(['fase:Homologação']);
    busca.termo = 'claudio';
    busca.aoDigitar();
    expect(busca.plano[0].titulo).toBe('Implantação do ERP');
  });

  it('todas as palavras precisam aparecer; começo de palavra vem antes', async () => {
    const { busca, api } = await abrir();
    busca.abrir();
    carregar(api);
    busca.termo = 'digital transf';
    busca.aoDigitar();
    expect(busca.plano.map((i) => i.titulo)).toEqual(['Transformação digital', 'Serviços digitais']);
    busca.termo = 'erp inexistente';
    busca.aoDigitar();
    expect(busca.plano).toHaveLength(0);
    expect(busca.rotuloVazio).toBe('Nenhum resultado.');
  });

  it('setas e Enter navegam; objetivo abre na tela de Objetivos; vira recente', async () => {
    const { busca, api, router } = await abrir();
    busca.abrir();
    carregar(api);
    busca.termo = 'eficiencia';
    busca.aoDigitar();
    const tecla = (key: string) => busca.aoTeclarNoCampo(new KeyboardEvent('keydown', { key }));
    tecla('ArrowDown');
    tecla('ArrowUp');
    tecla('Enter');
    expect(router.navigate).toHaveBeenCalledWith(['/objetivos'], { queryParams: { abrir: 'Eficiência operacional' } });
    expect(busca.aberto).toBe(false);

    busca.abrir();
    expect(busca.grupos[0].rotulo).toBe('Recentes');
    expect(busca.grupos[0].itens[0].titulo).toBe('Eficiência operacional');
  });

  it('destaca o trecho encontrado, com acento', async () => {
    const { busca } = await abrir();
    busca.termo = 'gestao';
    expect(busca.partes('Gestão de serviços')).toEqual([
      { t: 'Gestão', m: true },
      { t: ' de serviços', m: false },
    ]);
  });

  it('falha ao carregar avisa', async () => {
    const { busca, api } = await abrir();
    busca.abrir();
    api.match(() => true).forEach((r) => r.flush(null, { status: 500, statusText: 'x' }));
    expect(busca.erro).toBe(true);
    expect(busca.rotuloVazio).toBe('Não foi possível carregar os dados.');
  });
});
