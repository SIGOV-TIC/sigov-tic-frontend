# Campanha de uso

Sete pessoas diferentes mexendo no sistema de verdade, contra o backend local.
Não é teste de regressão: é observação. O resultado é uma lista de achados em
`saida/achados.json`, com capturas e o PDF que cada uma gerou.

Cada persona tem um jeito próprio de usar, porque é o jeito de usar que revela
o problema — não a funcionalidade isolada:

| Pessoa | Perfil | Como usa |
|---|---|---|
| Cláudia Moraes | Escritório de Projetos | Devagar, confere número contra número, gráfico contra tabela |
| Diego Tavares | PO | Dois minutos entre reuniões, clica duas vezes, sai no meio |
| Simone Rocha | Gerência | Não confia em gráfico: filtra, baixa o CSV e soma |
| Wagner Lima | Scrum Master novato | Esbarra no que não pode e precisa entender a recusa |
| Heloísa Pires | Diretoria | Quarenta segundos de tela e manda imprimir |
| Rogério Nunes | Analista adversarial | Mexe na URL e procura o caso torcido |
| (duas abas) | Escritório + PO | Mexem no mesmo projeto ao mesmo tempo |

## Como rodar

Precisa do backend local e do frontend apontando para ele.

```bash
# 1. backend, com banco em arquivo para a campanha poder ser repetida
cd ../../backend
./mvnw spring-boot:run -Dspring-boot.run.arguments="--spring.datasource.url=jdbc:h2:file:/tmp/sigovdb;AUTO_SERVER=TRUE"

# 2. frontend apontando para ele
npm run start:local -- --port 4301

# 3. dados: contas, projetos de formatos diferentes e quinzenas emitidas em sequência
node campanha/semear.mjs

# 4. a campanha
npx playwright test --config campanha/playwright.config.ts
```

O primeiro usuário precisa existir e ser ADMIN. Sem admin no banco, crie um pelo
cadastro aberto e promova:

```sql
update usuarios set perfil = 'ADMIN' where login = 'admin';
```

## Sobre os dados semeados

`semear.mjs` não despeja números prontos: ele **constrói história**. Para cada
quinzena, muda o percentual das fases e o custo do projeto, grava a atualização
do período e só então emite o retrato. É assim que a série nasce com variação de
verdade, que é o único jeito de o gráfico de tendência dizer alguma coisa.

Os projetos são de formatos diferentes de propósito: um saudável, um atrasado com
custo subindo, um adiantado, um sem fases nem orçamento, um que só começa no
futuro e um com nome gigante, acento e símbolo.
