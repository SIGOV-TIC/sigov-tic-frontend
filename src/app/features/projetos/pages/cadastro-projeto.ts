import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ProjetoRequest, FaseProjeto } from '../models/projeto';
import { ProjetoService } from '../services/projeto.service';

@Component({
  selector: 'app-cadastro-projeto',
  imports: [FormsModule, MatAutocompleteModule, MatIconModule, MatInputModule],
  templateUrl: './cadastro-projeto.html',
  styleUrl: './cadastro-projeto.scss',
})
export class CadastroProjeto {
  etapaAtual = 0;
  etapasEsquerda = ['Dados Gerais', 'Responsáveis', 'Descrição', 'Planejamento'];

  projeto: ProjetoRequest = {
    nome: '',
    sigla: '',
    fases: [],
    priorizadoPdtic: false,
    inovador: false,
  };

  novaFase: FaseProjeto = { nome: '', duracaoMeses: 1 };

  nomes = [
    'Sistema de Governança de TIC',
    'Modernização da Infraestrutura de Rede',
    'Portal de Serviços Digitais',
    'Adequação à LGPD',
    'Implantação do SOC',
  ];
  siglas = ['SIGOV-TIC', 'MIR', 'PSD', 'LGPD-TIC', 'SOC'];
  areas = [
    'Coordenação-Geral de TIC',
    'Diretoria de Tecnologia da Informação',
    'Secretaria de Governança Digital',
    'Subsecretaria de TIC',
  ];
  unidades = [
    'Divisão de Sistemas e Soluções de TIC',
    'Divisão de Infraestrutura e Segurança',
    'Divisão de Governança e Gestão de TIC',
    'Coordenação de Desenvolvimento',
  ];
  descricoes = [
    'Desenvolvimento de sistema web para gestão do portfólio de projetos de TIC, permitindo cadastro, acompanhamento e governança dos projetos alinhados ao PDTIC.',
    'Modernização do parque de servidores e equipamentos de rede do órgão, incluindo substituição de ativos defasados e ampliação da capacidade.',
    'Implantação de portal unificado para prestação de serviços digitais ao cidadão, integrando sistemas legados e novos módulos.',
  ];
  objetivos = [
    'Centralizar a governança de TIC em uma plataforma única, com rastreabilidade do alinhamento estratégico e visibilidade do portfólio.',
    'Garantir disponibilidade e desempenho da infraestrutura de TIC para suportar as demandas do órgão.',
    'Ampliar o acesso digital aos serviços públicos, reduzindo atendimento presencial.',
  ];
  justificativas = [
    'Atualmente o controle dos projetos é feito em planilhas, sem vínculo formal com o PDTIC, dificultando a priorização e o acompanhamento pela alta gestão.',
    'A infraestrutura atual apresenta defasagem tecnológica, comprometendo a continuidade dos serviços e a segurança da informação.',
    'O atendimento presencial representa alto custo operacional e baixa satisfação dos usuários.',
  ];
  beneficios = [
    'Maior transparência na gestão de TIC, rastreabilidade das decisões, conformidade com a IN SGD/ME nº 94 e otimização na alocação de recursos.',
    'Aumento da disponibilidade dos serviços, redução de incidentes e conformidade com políticas de segurança.',
    'Redução de custos operacionais, agilidade no atendimento e melhoria da experiência do cidadão.',
  ];

  nomesFiltrados: string[] = [];
  siglasFiltradas: string[] = [];
  areasFiltradas: string[] = [];
  unidadesFiltradas: string[] = [];

  pessoas = [
    'Murilo Henrique', 'Natan Heringer', 'Ana Carolina Souza',
    'Roberto Campos', 'Fernanda Lima', 'Lucas Oliveira',
    'Patrícia Mendes', 'Thiago Almeida',
  ];
  objetivosEstrategicos = [
    'Aprimorar a governança e gestão de TIC',
    'Fortalecer a segurança cibernética e proteção de dados',
    'Modernizar a infraestrutura tecnológica',
    'Ampliar e melhorar os serviços digitais',
    'Promover a inovação e transformação digital',
  ];
  iniciativasEstrategicas = [
    'Implantação do SIGOV-TIC',
    'Migração para infraestrutura em nuvem',
    'Implantação do SOC (Security Operations Center)',
    'Adequação à LGPD',
    'Modernização do portal de serviços',
    'Capacitação em competências digitais',
  ];
  indicadoresEstrategicos = [
    '% de projetos alinhados ao PDTIC',
    '% de conformidade com a IN SGD/ME nº 94',
    'Índice de maturidade de governança de TIC',
    'Tempo médio de resposta a incidentes de segurança',
    '% de serviços digitais disponibilizados',
    'Índice de satisfação dos usuários de TIC',
  ];
  orcamentosMock = [250000, 500000, 1000000, 2500000];

  pessoasFiltradas: string[] = [];
  objetivosFiltrados: string[] = [];
  iniciativasFiltradas: string[] = [];
  indicadoresFiltrados: string[] = [];

  mostrarResumo = false;
  etapasConcluidas = false;
  errosValidacao: string[] = [];

  constructor(private projetoService: ProjetoService, private router: Router) {
    this.nomesFiltrados = this.nomes;
    this.siglasFiltradas = this.siglas;
    this.areasFiltradas = this.areas;
    this.unidadesFiltradas = this.unidades;
    this.pessoasFiltradas = this.pessoas;
    this.objetivosFiltrados = this.objetivosEstrategicos;
    this.iniciativasFiltradas = this.iniciativasEstrategicas;
    this.indicadoresFiltrados = this.indicadoresEstrategicos;
  }

  get camposVinculoPreenchidos(): number {
    let count = 0;
    if (this.projeto.priorizadoPdtic !== undefined && this.projeto.priorizadoPdtic !== null) count++;
    if (this.projeto.objetivoEstrategico) count++;
    if (this.projeto.iniciativaEstrategica) count++;
    if (this.projeto.indicadorEstrategico) count++;
    return count;
  }

  get totalCamposVinculo(): number {
    return 4;
  }

  get prontoParaSalvar(): boolean {
    return this.etapasConcluidas && !!this.projeto.nome && !!this.projeto.sigla;
  }

  filtrar(valor: string, lista: string[]): string[] {
    if (!valor) return lista;
    const termo = valor.toLowerCase();
    return lista.filter(item => item.toLowerCase().includes(termo));
  }

  filtrarNomes(valor: string) { this.nomesFiltrados = this.filtrar(valor, this.nomes); }
  filtrarSiglas(valor: string) { this.siglasFiltradas = this.filtrar(valor, this.siglas); }
  filtrarAreas(valor: string) { this.areasFiltradas = this.filtrar(valor, this.areas); }
  filtrarUnidades(valor: string) { this.unidadesFiltradas = this.filtrar(valor, this.unidades); }
  filtrarPessoas(valor: string) { this.pessoasFiltradas = this.filtrar(valor, this.pessoas); }
  filtrarObjetivos(valor: string) { this.objetivosFiltrados = this.filtrar(valor, this.objetivosEstrategicos); }
  filtrarIniciativas(valor: string) { this.iniciativasFiltradas = this.filtrar(valor, this.iniciativasEstrategicas); }
  filtrarIndicadores(valor: string) { this.indicadoresFiltrados = this.filtrar(valor, this.indicadoresEstrategicos); }

  preencherCampo(campo: keyof ProjetoRequest, valor: string) {
    (this.projeto as any)[campo] = valor;
  }

  limparCampo(campo: keyof ProjetoRequest) {
    (this.projeto as any)[campo] = '';
  }

  ajustarOrcamento(variacao: number) {
    const atual = Number(this.projeto.orcamentoEstimado) || 0;
    this.projeto.orcamentoEstimado = Math.max(0, atual + variacao);
  }

  adicionarFase() {
    if (!this.novaFase.nome.trim()) return;
    this.projeto.fases = this.projeto.fases || [];
    this.projeto.fases.push({ ...this.novaFase });
    this.novaFase = { nome: '', duracaoMeses: 1 };
  }

  removerFase(index: number) {
    this.projeto.fases?.splice(index, 1);
  }

  avancar() {
    this.errosValidacao = [];
    if (this.etapaAtual < this.etapasEsquerda.length - 1) {
      this.etapaAtual++;
    }
  }

  voltar() {
    if (this.etapaAtual > 0) {
      this.etapaAtual--;
    }
  }

  irParaEtapa(i: number) {
    this.etapaAtual = i;
    this.etapasConcluidas = false;
  }

  validarEtapas(): string[] {
    const erros: string[] = [];
    if (!this.projeto.nome?.trim()) erros.push('Nome do Projeto');
    if (!this.projeto.sigla?.trim()) erros.push('Sigla');
    if (!this.projeto.areaSolicitante?.trim()) erros.push('Área Solicitante');
    if (!this.projeto.descricao?.trim()) erros.push('Descrição');
    return erros;
  }

  concluirEtapas() {
    this.errosValidacao = this.validarEtapas();
    if (this.errosValidacao.length === 0) {
      this.etapasConcluidas = true;
    }
  }

  abrirResumo() {
    this.mostrarResumo = true;
  }

  fecharResumo() {
    this.mostrarResumo = false;
  }

  confirmarSalvar() {
    this.projeto.status = 'AGUARDANDO_APROVACAO';
    this.projetoService.criar(this.projeto).subscribe({
      next: () => {
        this.mostrarResumo = false;
        this.router.navigate(['/portfolio']);
      },
      error: (err) => {
        alert('Erro ao criar projeto: ' + (err.error?.message || err.message));
      },
    });
  }

  salvarRascunho() {
    this.projeto.status = 'RASCUNHO';
    this.projetoService.criar(this.projeto).subscribe({
      next: () => {
        this.router.navigate(['/portfolio']);
      },
      error: (err) => {
        alert('Erro ao salvar rascunho: ' + (err.error?.message || err.message));
      },
    });
  }

  submeter() {
    this.abrirResumo();
  }

  limpar() {
    this.projeto = { nome: '', sigla: '', fases: [], priorizadoPdtic: false, inovador: false };
    this.etapaAtual = 0;
    this.mostrarResumo = false;
    this.etapasConcluidas = false;
    this.errosValidacao = [];
  }
}
