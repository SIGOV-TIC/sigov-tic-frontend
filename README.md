# SigovTic

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

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
| Telas | Login, Usuários, Cadastro, tela do Projeto (PO grava pelo acompanhamento, Escritório pelo projeto inteiro), Portfólio, Orçamento, Dashboard, Objetivos, Cronograma (inclusive o CSV), busca global, menu e feedback |

Os dados de teste ficam em `src/app/testing/dados.ts`. Testes que dependem da data fixam o relógio.

### Ponta a ponta (Playwright)

O app roda de verdade no navegador, com a API simulada em memória (`e2e/api-falsa.ts`). Não precisa do backend.

```bash
npx playwright install chromium  # só na primeira vez
npm run e2e
```

Cobrem login e volta à página pedida, sessão recusada, o que cada perfil vê e consegue fazer, o acompanhamento do PO (atualizações, atividades, concluir fase sem usar o PUT do projeto), as telas do menu, a busca global e o feedback. Qualquer erro no console do navegador reprova o teste.

O GitHub Actions roda unidade, build e ponta a ponta a cada push e pull request (`.github/workflows/testes.yml`).

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
