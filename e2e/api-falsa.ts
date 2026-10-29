import { Page, Route } from '@playwright/test';

// API em memória, uma por teste: guarda o que as telas gravam e registra cada pedido de escrita.

type Perfil = 'ADMIN' | 'ESCRITORIO' | 'GESTOR_PROJETO' | 'USER';

export const CONTAS: Record<string, { id: string; nome: string; perfil: Perfil }> = {
  admin: { id: 'u-admin', nome: 'Ronaldo Admin', perfil: 'ADMIN' },
  pmo: { id: 'u-pmo', nome: 'Paula Escritório', perfil: 'ESCRITORIO' },
  'ana.po': { id: 'u-po', nome: 'Ana Carolina', perfil: 'GESTOR_PROJETO' },
  'outro.gestor': { id: 'u-outro', nome: 'Outro Gestor', perfil: 'GESTOR_PROJETO' },
  diretoria: { id: 'u-dir', nome: 'Renata Diretoria', perfil: 'USER' },
};
export const SENHA = 'senha-certa';

export interface Pedido {
  metodo: string;
  caminho: string;
  corpo: unknown;
}

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deslocar(meses: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + meses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function dadosIniciais() {
  // Datas relativas a hoje, para o cenário valer em qualquer dia.
  const projetos = [
    {
      id: 'p1',
      nome: 'Implantação do ERP Corporativo',
      sigla: 'ERP',
      areaSolicitante: 'Sistemas',
      areaExecutora: 'DTI',
      descricao: 'Unificar plataformas legadas.',
      objetivo: 'ERP modular único.',
      objetivoEstrategico: 'Eficiência operacional',
      status: 'APROVADO',
      po: { id: 'u-po', nome: 'Ana Carolina' },
      scrumMaster: null,
      gerenteResponsavel: 'Cláudio Silva',
      dataInicioPrevista: deslocar(-6),
      dataConclusaoPrevista: deslocar(6),
      orcamentoEstimado: 5_000_000,
      custoRealizado: 2_000_000,
      qtdProprios: 6,
      qtdTerceiros: 4,
      pontoAtencao: 'Fornecedor atrasou a API.',
      recomendacao: 'Manter o cutover.',
      atualizacoes: [{ id: 'a1', data: deslocar(-1), texto: 'Homologação do piloto concluída.', autor: 'Ana Carolina' }],
      fases: [
        { id: 'f1', nome: 'Planejamento', duracaoMeses: 3, situacao: 'CONCLUIDA', percentual: 100, dataInicio: deslocar(-6), dataFim: deslocar(-3), atividades: [] },
        { id: 'f2', nome: 'Execução', duracaoMeses: 6, situacao: 'EM_ANDAMENTO', percentual: 50, dataInicio: deslocar(-3), dataFim: deslocar(3), atividades: [
          { id: 't1', titulo: 'Desenvolvimento do módulo RH', responsavel: 'Carlos', prazo: deslocar(1), percentual: 60, situacao: 'EM_ANDAMENTO' },
        ] },
        { id: 'f3', nome: 'Encerramento', duracaoMeses: 3, situacao: 'PENDENTE', percentual: 0, dataInicio: deslocar(3), dataFim: deslocar(6), atividades: [] },
      ],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      nome: 'Modernização da Rede',
      sigla: 'REDE',
      areaSolicitante: 'Infraestrutura',
      objetivoEstrategico: 'Eficiência operacional',
      status: 'APROVADO',
      po: { id: 'u-outro', nome: 'Outro Gestor' },
      scrumMaster: null,
      dataInicioPrevista: deslocar(-4),
      dataConclusaoPrevista: deslocar(2),
      orcamentoEstimado: 800_000,
      custoRealizado: 900_000,
      atualizacoes: [],
      fases: [{ id: 'g1', nome: 'Execução', duracaoMeses: 6, situacao: 'EM_ANDAMENTO', percentual: 20, dataInicio: deslocar(-4), dataFim: deslocar(2), atividades: [] }],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];
  const metas = [
    { id: 'm1', objetivo: 'Eficiência operacional', indicador: 'Processos digitalizados', unidade: '%', valorInicial: 0, valorAlvo: 100, valorAtual: 10,
      dataInicio: deslocar(-6), prazo: deslocar(6), responsavel: 'Escritório', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  ];
  const usuarios = Object.entries(CONTAS).map(([login, c]) => ({ id: c.id, login, nome: c.nome, perfil: c.perfil, ativo: true }));
  return { projetos, metas, usuarios };
}

export class ApiFalsa {
  readonly dados = dadosIniciais();
  readonly escritas: Pedido[] = [];
  // Quando definido, toda chamada fora do login responde com este status.
  forcarStatus: number | null = null;

  constructor(private page: Page) {}

  async instalar() {
    await this.page.route('**/api/**', (route) => this.responder(route));
  }

  // Abre o app já logado, como se a pessoa tivesse entrado antes.
  async entrarComo(login: keyof typeof CONTAS) {
    const c = CONTAS[login];
    await this.page.addInitScript(
      ([sessao]) => localStorage.setItem('sigov_sessao', sessao),
      [JSON.stringify({ username: login, roles: ['ROLE_' + c.perfil], id: c.id, nome: c.nome, perfil: c.perfil })],
    );
  }

  escritasEm(trecho: string): Pedido[] {
    return this.escritas.filter((p) => p.caminho.includes(trecho));
  }

  private async responder(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace(/^.*\/api/, '/api');
    const metodo = req.method();
    const corpo = req.postDataJSON?.() ?? null;
    if (metodo !== 'GET') this.escritas.push({ metodo, caminho, corpo });

    const json = (dados: unknown, status = 200) => route.fulfill({ status, json: dados });
    const vazio = (status = 204) => route.fulfill({ status, body: '' });
    const erro = (status: number, message: string) => route.fulfill({ status, json: { status, message } });

    if (caminho === '/api/auth/login') {
      const c = CONTAS[corpo?.username];
      if (!c || corpo.password !== SENHA) return erro(401, 'Credenciais invalidas.');
      return json({ username: corpo.username, roles: ['ROLE_' + c.perfil], usuario: { id: c.id, nome: c.nome, perfil: c.perfil } });
    }
    if (caminho === '/api/auth/logout') return vazio(200);
    if (this.forcarStatus) return erro(this.forcarStatus, 'Forcado.');

    const { projetos, metas, usuarios } = this.dados;
    let m: RegExpMatchArray | null;

    if (caminho === '/api/projetos' && metodo === 'GET') {
      const size = Number(url.searchParams.get('size') ?? 20);
      return json({ content: projetos.slice(0, size), page: 0, size, totalElements: projetos.length, totalPages: 1 });
    }
    if (caminho === '/api/projetos' && metodo === 'POST') {
      const novo = { ...corpo, id: 'p' + (projetos.length + 1), atualizacoes: [], fases: corpo.fases ?? [], createdAt: '', updatedAt: '' };
      projetos.push(novo);
      return json(novo, 201);
    }
    if ((m = caminho.match(/^\/api\/projetos\/([^/]+)$/))) {
      const p = projetos.find((x) => x.id === m![1]);
      if (!p) return erro(404, 'Projeto nao encontrado.');
      if (metodo === 'GET') return json(p);
      if (metodo === 'PUT') return json(Object.assign(p, corpo));
    }
    if ((m = caminho.match(/^\/api\/projetos\/([^/]+)\/acompanhamento$/))) {
      const p = projetos.find((x) => x.id === m![1])!;
      p.pontoAtencao = corpo.pontoAtencao;
      for (const f of corpo.fases ?? []) Object.assign(p.fases.find((x) => x.id === f.id)!, f);
      return json(p);
    }
    if ((m = caminho.match(/^\/api\/projetos\/([^/]+)\/atualizacoes(?:\/([^/]+))?$/))) {
      const p = projetos.find((x) => x.id === m![1])!;
      if (metodo === 'DELETE') {
        p.atualizacoes = p.atualizacoes.filter((a) => a.id !== m![2]);
        return vazio();
      }
      const nova = { id: 'a' + Date.now(), data: corpo.data ?? hoje(), texto: corpo.texto, autor: 'Ana Carolina' };
      p.atualizacoes.unshift(nova);
      return json(nova, 201);
    }
    if ((m = caminho.match(/^\/api\/projetos\/([^/]+)\/fases\/([^/]+)\/atividades(?:\/([^/]+))?$/))) {
      const fase = projetos.find((x) => x.id === m![1])!.fases.find((f) => f.id === m![2])!;
      if (metodo === 'POST') {
        const nova = { id: 't' + Date.now(), situacao: 'PENDENTE', ...corpo };
        fase.atividades.push(nova);
        return json(nova, 201);
      }
      const atv = fase.atividades.find((a) => a.id === m![3])!;
      if (metodo === 'PUT') return json(Object.assign(atv, corpo));
      fase.atividades = fase.atividades.filter((a) => a !== atv);
      return vazio();
    }
    if (caminho === '/api/metas' && metodo === 'GET') return json(metas);
    if (caminho === '/api/users/gestores') return json(usuarios.filter((u) => u.perfil === 'GESTOR_PROJETO'));
    if (caminho === '/api/users' && metodo === 'GET') return json(usuarios);
    if (caminho === '/api/users' && metodo === 'POST') {
      const nova = { id: 'u' + Date.now(), login: corpo.login, nome: corpo.nome, perfil: corpo.perfil, ativo: corpo.ativo };
      usuarios.push(nova);
      return json(nova, 201);
    }
    if (caminho === '/api/retratos' || caminho === '/api/retratos/hoje') return json(metodo === 'GET' ? [] : {});
    if (caminho === '/api/feedback') return json({ id: 'fb1' }, 201);
    return erro(404, 'Rota nao simulada: ' + metodo + ' ' + caminho);
  }
}
