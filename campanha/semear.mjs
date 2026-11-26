// Semeia o banco local com contas e projetos de formatos diferentes, e constrói
// história de verdade: muda o projeto, emite a quinzena, muda de novo, emite a seguinte.
const API = 'http://localhost:8080/api';

const sessoes = new Map();

async function chamar(caminho, { metodo = 'GET', corpo, como = 'admin' } = {}) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(sessoes.get(como) ? { Cookie: sessoes.get(como) } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error(`${metodo} ${caminho} → ${r.status} ${texto.slice(0, 300)}`);
  return texto ? JSON.parse(texto) : null;
}

async function entrar(login, senha) {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: login, password: senha }),
  });
  if (!r.ok) throw new Error(`login ${login} → ${r.status}`);
  const cookie = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  sessoes.set(login, cookie);
}

const dia = (meses, dias = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + meses);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};

const quinzenaDe = (mesesAtras, metade) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - mesesAtras);
  return `${d.toISOString().slice(0, 8)}${metade === 1 ? '05' : '20'}`;
};

async function criarConta(login, nome, perfil) {
  await chamar('/users', { metodo: 'POST', corpo: { login, senha: 'sigov123', nome, perfil, ativo: true } });
  return (await chamar('/users')).find((u) => u.login === login);
}

function projeto(base) {
  return {
    nome: 'Projeto', sigla: 'XXX', tipo: 'PRODUTO_TI', areaSolicitante: 'TIC', areaExecutora: 'DTI',
    descricao: 'Descrição do projeto.', objetivo: 'Objetivo.', justificativa: 'Justificativa.',
    beneficiosEsperados: 'Benefícios.', objetivoEstrategico: 'Eficiência operacional',
    iniciativaEstrategica: 'Modernização', indicadorEstrategico: 'Disponibilidade',
    poId: null, scrumMasterId: null, patrocinador: 'Diretoria de TI', gerenteResponsavel: 'Gerente',
    priorizadoPdtic: true, inovador: false, justificativaInovador: null,
    dataInicioPrevista: dia(-6), dataConclusaoPrevista: dia(6),
    orcamentoEstimado: 1000000, custoRealizado: 0, qtdProprios: 4, qtdTerceiros: 2,
    status: 'EM_ANDAMENTO', pontoAtencao: null, recomendacao: null,
    faseCiclo: 'EXECUCAO', prazoQuadrante: 'NO_PRAZO', custoQuadrante: 'NO_CUSTO',
    fases: [
      { nome: 'Análise', duracaoMeses: 3 },
      { nome: 'Execução', duracaoMeses: 6 },
      { nome: 'Homologação', duracaoMeses: 3 },
    ],
    ...base,
  };
}

async function main() {
  await entrar('admin', 'sigov123');

  const pmo = await criarConta('claudia.pmo', 'Cláudia Moraes', 'ESCRITORIO');
  const po1 = await criarConta('diego.po', 'Diego Tavares', 'GESTOR_PROJETO');
  const sm1 = await criarConta('wagner.sm', 'Wagner Lima', 'GESTOR_PROJETO');
  await criarConta('simone.gerente', 'Simone Rocha', 'ESCRITORIO');
  await criarConta('heloisa.diretoria', 'Heloísa Pires', 'USER');
  await criarConta('rogerio.analista', 'Rogério Nunes', 'USER');
  await entrar('claudia.pmo', 'sigov123');

  // --- Projetos com formatos diferentes de propósito ---
  const novos = [
    projeto({
      nome: 'Portal Único de Serviços ao Cidadão', sigla: 'PUSC', gerenteResponsavel: 'Cláudia Moraes',
      poId: po1.id, scrumMasterId: sm1.id, orcamentoEstimado: 2400000,
    }),
    projeto({
      nome: 'Substituição do Legado de Cobrança', sigla: 'SLC', gerenteResponsavel: 'Marcos Aurélio',
      poId: po1.id, orcamentoEstimado: 3800000, areaExecutora: 'Sistemas',
      dataInicioPrevista: dia(-10), dataConclusaoPrevista: dia(2),
    }),
    projeto({
      nome: 'Observabilidade da Plataforma', sigla: 'OBS', gerenteResponsavel: 'Rita Campos',
      orcamentoEstimado: 600000, areaExecutora: 'Infraestrutura',
      dataInicioPrevista: dia(-4), dataConclusaoPrevista: dia(8),
    }),
    // Sem fases e sem orçamento: o caso que quebra divisão.
    projeto({
      nome: 'Diagnóstico de Maturidade COBIT', sigla: 'DMC', gerenteResponsavel: 'Rita Campos',
      orcamentoEstimado: 0, custoRealizado: 0, fases: [], areaExecutora: 'Governança',
    }),
    // Começa no futuro: nada decorrido.
    projeto({
      nome: 'Data Mesh Corporativo', sigla: 'DMESH', gerenteResponsavel: 'Rita Campos',
      dataInicioPrevista: dia(2), dataConclusaoPrevista: dia(14), areaExecutora: 'Dados',
    }),
    // Nome enorme, acentos e símbolos.
    projeto({
      nome: 'Programa de Modernização, Integração e Racionalização dos Sistemas de Atendimento, Cobrança e Relacionamento com o Cliente — Fase II (continuidade do PMIRSACRC/2024)',
      sigla: 'PMIRSACRC', gerenteResponsavel: 'José D\'Ávila & Cia', areaExecutora: 'Atendimento',
      orcamentoEstimado: 999999999,
    }),
  ];
  const criados = {};
  for (const p of novos) criados[p.sigla] = await chamar('/projetos', { metodo: 'POST', corpo: p, como: 'claudia.pmo' });

  // --- História de verdade: o projeto muda entre uma emissão e a seguinte ---
  // Cada passo é uma quinzena: percentuais e custo sobem, depois a quinzena é emitida.
  const roteiro = {
    // Saudável: anda junto com o prazo.
    PUSC: [
      { fases: [100, 10, 0], custo: 280000, nota: 'Análise aprovada pelo comitê.' },
      { fases: [100, 25, 0], custo: 520000, nota: 'Sprint 3 entregue; integração com o legado iniciada.' },
      { fases: [100, 45, 0], custo: 900000, nota: 'Homologação assistida com a área de negócio.' },
      { fases: [100, 60, 0], custo: 1300000, nota: 'Carga de dados concluída.' },
    ],
    // Atrasa e o custo acompanha: o caso que o relatório existe para contar.
    SLC: [
      { fases: [100, 15, 0], custo: 900000, nota: 'Fornecedor atrasou a entrega do ambiente.' },
      { fases: [100, 20, 0], custo: 1600000, atencao: 'Equipe reduzida por férias coletivas.' },
      { fases: [100, 24, 0], custo: 2400000, atencao: 'Risco de estouro de orçamento no próximo trimestre.' },
      { fases: [100, 30, 0], custo: 3200000, nota: 'Replanejamento em discussão com a diretoria.' },
    ],
    // Entrega antes do previsto e gasta menos.
    OBS: [
      { fases: [100, 40, 0], custo: 90000, nota: 'Coleta de métricas em produção.' },
      { fases: [100, 80, 0], custo: 180000, nota: 'Painéis publicados para as equipes.' },
      { fases: [100, 100, 30], custo: 260000, nota: 'Alertas ligados; início da homologação.' },
    ],
  };

  for (const [sigla, passos] of Object.entries(roteiro)) {
    const projetoCriado = criados[sigla];
    for (let i = 0; i < passos.length; i++) {
      const passo = passos[i];
      const quinzena = quinzenaDe(passos.length - i, 1);
      const fases = projetoCriado.fases.map((f, k) => ({
        id: f.id,
        percentual: passo.fases[k] ?? 0,
        situacao: passo.fases[k] >= 100 ? 'CONCLUIDA' : passo.fases[k] > 0 ? 'EM_ANDAMENTO' : 'PENDENTE',
      }));
      await chamar(`/projetos/${projetoCriado.id}/acompanhamento`, {
        metodo: 'PATCH', como: 'claudia.pmo',
        corpo: { fases, pontoAtencao: passo.atencao ?? null },
      });
      // O custo realizado é campo do projeto: só o Escritório muda.
      const completo = await chamar(`/projetos/${projetoCriado.id}`, { como: 'claudia.pmo' });
      await chamar(`/projetos/${projetoCriado.id}`, {
        metodo: 'PUT', como: 'claudia.pmo',
        corpo: {
          ...projeto({}), nome: completo.nome, sigla: completo.sigla, areaExecutora: completo.areaExecutora,
          gerenteResponsavel: completo.gerenteResponsavel, poId: completo.po?.id ?? null,
          scrumMasterId: completo.scrumMaster?.id ?? null,
          dataInicioPrevista: completo.dataInicioPrevista, dataConclusaoPrevista: completo.dataConclusaoPrevista,
          orcamentoEstimado: completo.orcamentoEstimado, custoRealizado: passo.custo,
          pontoAtencao: completo.pontoAtencao, recomendacao: completo.recomendacao,
          fases: completo.fases.map((f) => ({ id: f.id, nome: f.nome, duracaoMeses: f.duracaoMeses,
            situacao: f.situacao, percentual: f.percentual, dataInicio: f.dataInicio, dataFim: f.dataFim })),
        },
      });
      if (passo.nota) {
        await chamar(`/projetos/${projetoCriado.id}/atualizacoes`, {
          metodo: 'POST', como: 'claudia.pmo', corpo: { data: quinzena, texto: passo.nota },
        });
      }
      await chamar(`/retratos-quinzenais?projeto=${projetoCriado.id}&dia=${quinzena}`, {
        metodo: 'POST', como: 'claudia.pmo',
      });
    }
  }

  const fatos = await chamar('/retratos-quinzenais/fatos', { como: 'claudia.pmo' });
  console.log('projetos:', Object.keys(criados).join(', '));
  console.log('linhas de fato:', fatos.length);
}

main().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
