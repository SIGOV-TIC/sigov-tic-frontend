# SIGOV-TIC · Frontend

Sistema de governança do portfólio de projetos de TIC do PDTIC: cadastro e acompanhamento de projetos, fases e atividades, metas, orçamento, cronograma e Status Report.

Angular 22 (sem zone.js), Angular Material, Vitest e Playwright. A API fica no repositório [SIGOV-TIC/backend](https://github.com/SIGOV-TIC/backend).

## Como começar

Precisa de Node 22 e npm.

```bash
npm ci
```

### Com a API de produção

```bash
npm start
```

Abre em `http://localhost:4200`. As chamadas a `/api` vão para a API no Azure (`proxy.conf.json`), com os dados reais. Para entrar, peça uma conta a quem administra o sistema.

### Com a API local

Na pasta do backend, suba a API (porta 8080, banco H2 em memória):

```bash
./mvnw spring-boot:run
```

E aqui:

```bash
npm run start:local
```

O banco local começa só com a conta `admin` / `admin123`. O administrador não mexe em projetos: em **Usuários**, crie uma conta com perfil Escritório de Projetos e entre com ela. Na primeira listagem, o app grava os projetos de exemplo de `projetos-exemplo.ts`.

## Arquitetura

```
src/
├── styles/_tokens.scss      espaçamentos, raios, grade e tipografia do design system BBTS
└── app/
    ├── app.routes.ts        rotas e guards de cada tela
    ├── app.config.ts        router, HttpClient e interceptor
    ├── core/
    │   ├── auth/            sessão, regra de quem pode o quê, guards, interceptor, perfis
    │   ├── layout/          casca do app: menu lateral, breadcrumb, busca global (Ctrl+K)
    │   └── feedback/        botão de feedback
    ├── features/            uma pasta por área
    │   ├── projetos/        portfólio, cadastro e tela do projeto; cálculos de saúde, IDP/IDC, custo e fases
    │   ├── dashboard/       visão geral e retrato do portfólio
    │   ├── cronograma/      linha do tempo das fases e exportação CSV
    │   ├── orcamento/       orçado, gasto e saldo por área
    │   ├── objetivos/       metas e avaliação de ritmo
    │   ├── status-report/   relatório por projeto e quinzena
    │   ├── usuarios/        contas e perfis
    │   └── login/
    ├── shared/paginacao/    paginação usada nas listagens
    └── testing/dados.ts     fábricas de dados para os testes
```

Cada área segue o mesmo desenho: `pages/` tem as telas (`.ts`, `.html`, `.scss` e `.spec.ts` lado a lado), `services/` fala com a API, `utils/` guarda os cálculos sem Angular e `models/` os tipos da API.

### Caminho de uma chamada

```
tela → service → HttpClient → authInterceptor → /api/...
                                                  ├─ npm start / start:local: proxy do ng serve
                                                  └─ produção: rewrite do vercel.json
                                                  → API Spring Boot no Azure
```

O login grava o token num cookie HttpOnly emitido pela API. O app só guarda no `localStorage` quem está logado (nome, perfil, id). O interceptor manda o cookie em toda chamada. Se a API responder 401 ou 403, ele encerra a sessão e volta ao login, guardando a página pedida.

### Perfis

| Perfil | Pode |
| --- | --- |
| Administrador | Gerenciar contas e perfis. Não altera projetos |
| Escritório de Projetos | Criar e editar todos os projetos e metas |
| Gestor de projeto (PO ou Scrum Master) | No próprio projeto: ponto de atenção, situação, % e datas das fases, atualizações e atividades |
| Visualizador | Consultar |

A regra fica em `AuthService.pode()` (`core/auth/auth.service.ts`) e repete a da API. Ela só esconde botões e bloqueia rotas: quem garante a permissão é o backend. Ao mudar uma regra, mude nos dois.

## Convenções

- **Sem zone.js:** a tela não redesenha sozinha depois de uma chamada HTTP. As telas usam `ChangeDetectionStrategy.Eager`; o que for OnPush precisa guardar em `signal` o estado que chega depois da renderização.
- **Componentes standalone:** cada um declara seus `imports`. Não há NgModule.
- **Nomes em português**, como no domínio (`projeto`, `fase`, `atualizacao`), inclusive nos testes.
- **Estilo:** espaçamentos e tamanhos vêm de `src/styles/_tokens.scss`. Formatação com Prettier (`npx prettier --write <arquivo>`).
- **Cálculos fora da tela:** regras como saúde, desvio e custo ficam em `utils/` como funções puras, testadas sem TestBed.

### Nova tela

1. Crie `features/<area>/pages/<tela>.ts`, `.html`, `.scss` e `.spec.ts`.
2. Registre a rota em `app.routes.ts`, com guard se a tela tiver restrição de perfil.
3. Adicione o item no menu (`core/layout/layout.html`) e no breadcrumb (`core/layout/layout.ts`).
4. Inclua a tela em `e2e/navegacao.spec.ts` e, se ela chamar rotas novas, simule-as em `e2e/api-falsa.ts`.

## Testes

### Unidade e componentes (Vitest)

```bash
npm test               # modo observação
npm run test:ci        # uma execução
npm run test:cobertura # com relatório em coverage/
```

| Área | O que cobre |
| --- | --- |
| `features/projetos/utils` | Saúde do projeto e das fases (margem de 15 pontos), IDP/IDC e faixa de ±10%, custo, janelas e situação das fases, moeda |
| `features/objetivos/utils` | Avaliação da meta: ritmo, risco, atraso, meta decrescente |
| `core/auth` | Quem pode o quê por perfil (mesma regra da API), sessão, guards de rota, interceptor (401/403 voltam ao login) |
| Serviços | Rotas e métodos de cada chamada à API; projetos de exemplo só com o banco vazio |
| Telas | Login, Usuários, Cadastro, tela do Projeto (PO grava pelo acompanhamento, Escritório pelo projeto inteiro), Portfólio, Orçamento, Dashboard, Objetivos, Cronograma (inclusive o CSV), Status Report, busca global, menu e feedback |

Os dados de teste ficam em `src/app/testing/dados.ts`. Testes que dependem da data fixam o relógio.

### Ponta a ponta (Playwright)

O app roda de verdade no navegador, com a API simulada em memória (`e2e/api-falsa.ts`). Não precisa do backend.

```bash
npx playwright install chromium  # só na primeira vez
npm run e2e
```

Cobrem login e volta à página pedida, sessão recusada, o que cada perfil vê e consegue fazer, o acompanhamento do PO (atualizações, atividades, concluir fase sem usar o PUT do projeto), as telas do menu, a busca global e o feedback. Qualquer erro no console do navegador reprova o teste.

## Fluxo de trabalho

1. Crie uma branch a partir da `main` (`feature/...`, `fix/...`, `docs/...`).
2. Rode `npm run test:ci` e `npm run e2e` antes de abrir o pull request.
3. O GitHub Actions roda unidade, build e ponta a ponta em todo push e pull request (`.github/workflows/testes.yml`). O PR só entra com tudo verde.

## Deploy

O frontend fica na Vercel. O `vercel.json` gera o build, manda `/api/*` para a API no Azure e devolve `index.html` nas demais rotas. Para publicar a `main`, quem tem acesso ao projeto na Vercel roda:

```bash
npx vercel --prod
```
