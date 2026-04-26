# DevMemory AI

Especificação inicial de produto para um SaaS/extensão de memória persistente local para IAs desenvolvedoras.

Data: 2026-04-25

## 1. Resumo executivo

DevMemory AI é uma camada de memória local, estruturada e reutilizável para projetos de software desenvolvidos com Claude Code, Codex/GPT, Cursor, Windsurf, VS Code e agentes similares. O produto registra o que uma IA e o desenvolvedor já entenderam sobre o projeto, transforma isso em arquivos pequenos de memória e gera prompts prontos para retomar ou encerrar sessões sem reanalisar o repositório inteiro.

A decisão recomendada para o MVP é uma extensão VS Code com um core local em TypeScript/Node.js, armazenamento em Markdown/JSON dentro do projeto e SaaS mínimo apenas para autenticação, licença e recursos premium opcionais. MCP, sync criptografado e dashboard visual entram depois.

## 2. A) Diagnóstico do problema

### Dor principal

Ferramentas de coding AI trabalham muito bem dentro de uma sessão, mas perdem eficiência quando o contexto muda: nova conversa, reinício, troca de ferramenta, branch diferente ou alguns dias sem tocar no projeto. O usuário precisa repetir arquitetura, decisões, comandos, bugs conhecidos e estado atual.

### Por que isso custa dinheiro

Cada reanálise consome tokens em leituras repetidas de arquivos, explicações duplicadas e prompts longos. Em times e agências, esse custo aparece como:

- mais tokens por tarefa;
- mais tempo até a IA voltar a ser útil;
- maior chance de regressão por falta de memória de decisões;
- documentação viva inexistente ou desatualizada;
- dependência da memória humana do desenvolvedor.

### Urgência comercial

O mercado de coding AI está migrando de "chat que gera código" para "agentes que trabalham em ciclos longos". Quanto mais autônomos os agentes ficam, mais importante é uma memória auditável, portátil e controlada pelo usuário. As próprias ferramentas já reconhecem essa necessidade: Claude Code possui mecanismos de memória e instruções persistentes, e Codex CLI enfatiza execução local e aprovação do usuário. O espaço comercial está em criar uma memória independente, multi-IA, local-first e orientada a economia de contexto.

## 3. B) Melhor formato para o MVP

### Comparação

| Formato | Vantagens | Desvantagens | Decisão |
|---|---|---|---|
| Extensão VS Code | Onde o dev já trabalha; UI nativa; acesso a workspace; comandos rápidos | Depende do ecossistema VS Code | Interface principal do MVP |
| CLI local | Fácil de testar, versionar e integrar com agentes | Menos descoberta para usuário comum | Core técnico reutilizável |
| App desktop | Boa UX própria | Mais custo de build, update e suporte | Adiar |
| Web app SaaS | Bom para billing e conta | Não deve receber código sensível no MVP | Apenas licença/dashboard |
| MCP server | Integração direta com agentes | Superfície de segurança maior; ainda exige maturidade | Fase 2 |
| Híbrido | Melhor equilíbrio | Mais partes para coordenar | Recomendado com escopo pequeno |

### Escolha

MVP = extensão VS Code + core local + arquivos `.ai-memory` + SaaS leve de licença.

Justificativa: a extensão entrega valor no fluxo real do desenvolvedor; a CLI mantém o motor testável e futuro-proof; arquivos locais vendem confiança; SaaS monetiza sem exigir upload do código.

## 4. C) Arquitetura recomendada

### Componentes

- VS Code Extension: comandos, painel lateral, consentimento, status bar, quick actions.
- Local Memory Core: indexação, filtros, análise de mudanças, geração de arquivos, geração de prompts.
- File Store: Markdown/JSON em `.ai-memory/`.
- Optional LLM Adapter: usa provider configurado pelo usuário ou modo manual sem enviar código ao SaaS.
- SaaS API: autenticação, licença, limite de projetos, templates premium, sync opcional.
- Futuro MCP Server: expõe memórias como resources e prompts como comandos reutilizáveis.

### Fluxo técnico

1. Usuário abre workspace.
2. Extensão verifica Workspace Trust e pede consentimento explícito.
3. Core lê apenas arquivos permitidos por política local.
4. Core cria inventário e memória inicial.
5. Usuário gera prompt de início, prompt de encerramento ou snapshot.
6. Mudanças relevantes são detectadas via file watcher.
7. Memória é atualizada por comando manual ou assistida por IA.

### Princípios

- Local-first: código e memórias ficam na máquina do usuário.
- Plain files: Markdown para leitura humana; JSON para metadados.
- Pequeno por padrão: o entrypoint deve caber em poucos KB.
- Portável: funciona com Claude, Codex, Cursor e qualquer chat.
- Sem dependência de embeddings no MVP.

## 5. D) Estrutura de pastas sugerida

```text
.ai-memory/
  config.json
  manifest.json
  project-summary.md
  current-state.md
  architecture.md
  commands.md
  conventions.md
  decisions/
    0001-local-first-storage.md
  sessions/
    2026-04-25-initial-scan.md
  tasks/
    backlog.md
    next-actions.md
  issues/
    bugs-and-fixes.md
  prompts/
    ai-start-prompt.md
    ai-end-prompt.md
    resume-prompt.md
  snapshots/
    2026-04-25.json
  audit/
    file-access-log.jsonl
```

### Exemplos de arquivos

`project-summary.md`: visão do produto, stack, pastas importantes, comandos essenciais.

`architecture.md`: módulos, fronteiras, padrões, decisões de integração.

`current-state.md`: o que está funcionando, o que está quebrado, branch/contexto atual.

`decisions/0001-*.md`: decisão, contexto, alternativas, consequência.

`sessions/*.md`: resumo da sessão, arquivos alterados, testes rodados, pendências.

`prompts/resume-prompt.md`: prompt enxuto para colar em Claude/Codex.

`manifest.json`: hashes, timestamps, arquivos monitorados, versão do schema.

## 6. E) Sistema de memória em camadas

1. Memória fixa do projeto: propósito, stack, comandos e organização.
2. Memória de arquitetura: módulos, padrões e contratos.
3. Memória de decisões: ADRs compactos e rastreáveis.
4. Memória de sessões: o que foi feito e aprendido por data.
5. Memória de tarefas: backlog, pendências, próximos passos.
6. Memória de erros e correções: bugs recorrentes, causas e soluções.
7. Memória de mudanças: arquivos relevantes, diffs resumidos e impactos.
8. Memória de prompts: templates prontos para início, encerramento, revisão e handoff.

Regra de ouro: o arquivo de retomada nunca deve tentar ser a memória inteira. Ele deve selecionar a menor parte suficiente para a próxima sessão.

## 7. F) Segurança e privacidade

### Política padrão de exclusão

Ignorar sempre:

```text
.env
.env.*
*.pem
*.key
*.crt
*.p12
*.pfx
id_rsa
id_ed25519
secrets.*
credentials.*
*.sqlite
*.db
node_modules/
vendor/
dist/
build/
coverage/
.git/
.next/
.turbo/
.cache/
```

### Regras do MVP

- Pedir consentimento antes do primeiro scan.
- Mostrar lista resumida de inclusões e exclusões.
- Nunca enviar arquivos para o SaaS no plano inicial.
- Permitir allowlist e denylist em `.ai-memory/config.json`.
- Registrar auditoria local dos arquivos lidos.
- Bloquear arquivos acima de um limite configurável, ex. 200 KB.
- Alertar quando o usuário tentar incluir padrão sensível.
- Rodar em modo offline completo.
- Respeitar Workspace Trust do VS Code.

### Configuração sugerida

```json
{
  "version": 1,
  "memoryDir": ".ai-memory",
  "mode": "local",
  "include": ["README.md", "package.json", "src/**/*", "docs/**/*"],
  "exclude": [".env*", "node_modules/**", "dist/**", "build/**", "*.pem", "*.key"],
  "maxFileBytes": 200000,
  "auditFileReads": true,
  "llmProvider": "manual"
}
```

## 8. G) Funcionalidades do MVP vendável

- Inicializar memória do projeto.
- Scan seguro com allowlist/denylist.
- Gerar `project-summary.md`, `architecture.md`, `commands.md` e `current-state.md`.
- Gerar prompt de retomada.
- Gerar prompt de encerramento pedindo à IA resumo estruturado.
- Registrar sessão manualmente via formulário simples.
- Detectar arquivos alterados e sugerir atualização da memória.
- Painel VS Code com status da memória.
- Copiar prompt para clipboard.
- Exportar pacote de contexto.
- Licença SaaS simples para liberar projetos ilimitados e templates premium.

Critério de MVP: em menos de 5 minutos após instalar, o usuário deve conseguir gerar um prompt de retomada útil.

## 9. H) Funcionalidades premium futuras

- Múltiplos projetos ilimitados.
- Templates avançados por IA: Claude, Codex, Cursor, Windsurf.
- Histórico visual de sessões.
- Sync criptografado ponta a ponta.
- Backup privado por projeto.
- MCP server local.
- Integração GitHub/GitLab para PRs, issues e commits.
- Integração Linear/Jira/Notion.
- Comparação de contexto entre branches.
- Memória compartilhada para equipes.
- Políticas corporativas de segurança.
- Relatórios de economia de tokens estimada.
- Geração automática de documentação viva.
- Revisão de drift arquitetural.

## 10. I) Fluxo de uso ideal

1. Usuário instala a extensão no VS Code.
2. Abre um projeto.
3. A extensão explica localmente o que será lido e pede autorização.
4. Usuário confirma ou ajusta allowlist/denylist.
5. Sistema cria `.ai-memory`.
6. Usuário clica em "Generate Start Prompt".
7. Cola o prompt em Claude Code, Codex, Cursor ou outro agente.
8. Ao final, clica em "Generate End Prompt".
9. A IA devolve um resumo estruturado da sessão.
10. Usuário cola/importa o resumo.
11. Sistema atualiza memória, decisões, bugs e próximos passos.
12. Dias depois, o usuário gera um prompt enxuto de retomada.

## 11. J) Prompts internos do sistema

### Resumir projeto

```text
Você é um assistente técnico que cria memória persistente de projetos de software.
Analise apenas o contexto permitido abaixo.
Produza um resumo curto, factual e reutilizável.
Inclua: objetivo do projeto, stack, estrutura, comandos, padrões, riscos e arquivos centrais.
Não invente informações ausentes.
Não inclua segredos, tokens, credenciais ou dados pessoais.
Saída em Markdown com seções curtas.
```

### Atualizar memória após sessão

```text
Atualize a memória do projeto com base no resumo da sessão.
Extraia apenas fatos úteis para sessões futuras.
Classifique em: mudanças feitas, decisões, bugs corrigidos, comandos usados, arquivos importantes, pendências.
Mantenha linguagem objetiva.
Remova detalhes transitórios e conversas irrelevantes.
Se houver informação sensível, substitua por [REDACTED].
```

### Gerar prompt de retomada

```text
Crie um prompt de retomada para uma IA desenvolvedora continuar o trabalho neste projeto.
Use somente as memórias fornecidas.
O prompt deve ser compacto, preciso e operacional.
Inclua: contexto do projeto, estado atual, arquivos relevantes, decisões ativas, próximos passos e cuidados.
Não inclua histórico longo se ele não for necessário para a próxima tarefa.
```

### Identificar mudanças importantes

```text
Compare o snapshot anterior com o estado atual.
Liste mudanças que afetam arquitetura, comportamento, comandos, dependências, segurança ou tarefas pendentes.
Ignore alterações triviais de formatação, build output e arquivos excluídos pela política.
Para cada mudança, indique impacto e se a memória deve ser atualizada.
```

### Registrar decisão técnica

```text
Transforme a informação abaixo em uma decisão técnica curta no formato ADR.
Campos: título, data, contexto, decisão, alternativas consideradas, consequência, status.
Se a informação não for uma decisão duradoura, responda: "Não registrar como decisão".
```

### Sugerir próximas tarefas

```text
Com base na memória atual e no último estado do projeto, sugira até 7 próximas tarefas.
Priorize desbloqueio, validação, segurança e entrega do MVP.
Cada tarefa deve ter objetivo, arquivos prováveis e critério de aceite.
```

### Compactar contexto

```text
Compacte a memória sem perder fatos essenciais.
Preserve decisões, comandos, contratos, riscos e próximos passos.
Remova duplicações, narração, logs brutos e detalhes que só importaram para uma sessão passada.
Mantenha o resultado abaixo de {{token_budget}} tokens.
```

## 12. K) Monetização

### Brasil

| Plano | Preço sugerido | Limites |
|---|---:|---|
| Free | R$ 0 | 1 projeto, memória local, prompts básicos, sem sync |
| Pro Individual | R$ 29/mês | projetos ilimitados, templates por IA, histórico local |
| Power User | R$ 59/mês | automações, snapshots avançados, estimativa de economia, MCP beta |
| Team | R$ 39-79/usuário/mês | memória compartilhada, políticas, billing centralizado, sync criptografado |

### Internacional

| Plano | Preço sugerido |
|---|---:|
| Free | US$ 0 |
| Pro | US$ 9/mês |
| Power | US$ 19/mês |
| Team | US$ 12-24/usuário/mês |

### O que limitar

- Número de projetos ativos.
- Templates premium.
- Histórico visual.
- Sync/backup.
- Recursos de equipe.
- Integrações externas.
- MCP avançado.

Não limitar o acesso do usuário aos próprios arquivos locais.

## 13. L) Roadmap

### Versão 0.1 experimental

- CLI `memory init`, `memory scan`, `memory prompt`.
- Estrutura `.ai-memory`.
- Filtros de segurança.
- Geração manual de Markdown.

### MVP vendável

- Extensão VS Code.
- Painel lateral.
- Copiar prompt de retomada.
- Registro de sessão.
- Licença SaaS básica.

### Beta fechado

- Templates por ferramenta.
- Detecção de mudanças.
- Snapshots.
- Onboarding com checklist de privacidade.
- 20-50 usuários pagantes/testers.

### Versão pública

- Marketplace VS Code.
- Site com checkout.
- Documentação.
- Métricas de ativação e retenção.

### SaaS completo

- Dashboard web.
- Sync criptografado opcional.
- Histórico visual.
- Integrações GitHub/GitLab.

### Times

- Workspaces de equipe.
- Políticas centralizadas.
- Memória compartilhada por repo.
- Relatórios de produtividade/contexto.

## 14. M) Stack técnica recomendada

### MVP

- TypeScript.
- Node.js.
- VS Code Extension API.
- `fast-glob` para descoberta de arquivos.
- `ignore` para regras estilo `.gitignore`.
- Markdown + JSON local.
- SQLite somente se o histórico crescer.
- Vitest para core.
- Playwright opcional para teste de webview.

### SaaS

- Next.js.
- Supabase Auth ou Clerk.
- PostgreSQL gerenciado.
- Stripe para internacional.
- Mercado Pago para Brasil, se o público inicial for nacional.
- Paddle/Lemon Squeezy como alternativa para impostos internacionais.

### Futuro

- MCP server em TypeScript.
- Embeddings locais ou vetores opcionais.
- Tauri/Electron apenas se houver demanda forte por app fora do VS Code.

## 15. N) Diferenciais competitivos

- Local-first e auditável.
- Multi-IA, sem prender o usuário a um modelo.
- Foco explícito em economia de tokens.
- Memória humana e legível, não banco opaco.
- Prompts de início e encerramento como fluxo simples.
- Documentação viva criada do trabalho real.
- Privacidade como produto, não nota de rodapé.

Posicionamento: "A memória local que impede sua IA de esquecer o projeto."

## 16. O) Riscos e soluções

| Risco | Tipo | Solução |
|---|---|---|
| Ler arquivo sensível | Segurança | denylist forte, alertas, auditoria, consentimento, limites de tamanho |
| Memória virar lixo acumulado | Produto | compactação, schema, revisão periódica, entrypoint pequeno |
| Usuário não perceber valor | Comercial | primeiro fluxo focado em prompt de retomada em 5 minutos |
| IA inventar fatos na memória | Técnico | prompts que exigem "não invente", marcação de incerteza e confirmação humana |
| SaaS parecer vigilância | Comercial/segurança | deixar claro que código não sobe no MVP |
| Concorrentes nativos adicionarem memória | Mercado | ser independente, portátil, multi-ferramenta e orientado a equipes |
| MCP aumentar superfície de ataque | Segurança | MCP somente local, sem comandos destrutivos, allowlist e confirmação |
| Extensão ser pesada | Técnico | watcher incremental, debounce, limites de arquivo, scan manual |

## 17. P) Nome, branding e posicionamento

### Nomes

- DevMemory AI
- Project Recall
- CodeMemory
- Continuity AI
- ContextVault
- RepoMemory
- Agent Memory Kit

### Taglines

- "Your AI remembers the project. Locally."
- "Memória persistente para desenvolvimento com IA."
- "Pare de pagar tokens para explicar o mesmo projeto."
- "Contexto certo, sessão após sessão."

### Promessa central

Reduzir reanálise, retrabalho e gasto de tokens ao transformar o histórico técnico do projeto em memória local, segura e reutilizável.

### Frase de venda

DevMemory AI cria uma memória local e inteligente do seu projeto para que Claude, Codex e outras IAs retomem o trabalho em minutos, sem reler tudo do zero.

## 18. Q) Plano de execução imediato

### Primeiras tarefas para pedir ao Codex/Claude

1. Criar monorepo com `packages/core`, `apps/vscode-extension` e `apps/web`.
2. Implementar `packages/core` com:
   - leitura de config;
   - allowlist/denylist;
   - scan de arquivos;
   - geração de manifest;
   - escrita de Markdown.
3. Criar templates iniciais:
   - `project-summary.md`;
   - `current-state.md`;
   - `architecture.md`;
   - `prompts/resume-prompt.md`;
   - `prompts/ai-end-prompt.md`.
4. Criar CLI local:
   - `cmem init`;
   - `cmem scan`;
   - `cmem prompt resume`;
   - `cmem session add`.
5. Criar extensão VS Code com comandos:
   - `DevMemory AI: Initialize Project`;
   - `DevMemory AI: Generate Resume Prompt`;
   - `DevMemory AI: Add Session Summary`;
   - `DevMemory AI: Open Memory Folder`.
6. Criar painel lateral com status, último snapshot e botões principais.
7. Adicionar testes do core para exclusão de arquivos sensíveis.
8. Criar landing page simples com promessa, demo GIF e checkout de lista de espera.

### Prompt para começar a implementação

```text
Você é um engenheiro TypeScript sênior. Crie o MVP local-first do DevMemory AI.
Escopo inicial: monorepo com packages/core e apps/vscode-extension.
O core deve inicializar uma pasta .ai-memory, aplicar allowlist/denylist segura, gerar manifest.json, project-summary.md, current-state.md e prompts/resume-prompt.md.
A extensão VS Code deve expor comandos para inicializar, gerar prompt de retomada e abrir a pasta de memória.
Priorize simplicidade, testes para filtros de segurança e arquivos Markdown/JSON legíveis.
Não implemente SaaS, embeddings ou MCP nesta primeira etapa.
```

## 19. Critérios de aceite do MVP

- Instalação e inicialização em um projeto real em menos de 5 minutos.
- Nenhum arquivo sensível padrão é lido.
- Usuário consegue ver quais arquivos foram considerados.
- Prompt de retomada é gerado e copiado para clipboard.
- Memória fica em arquivos pequenos e editáveis.
- O produto funciona offline.
- O core tem testes cobrindo exclusões críticas.

## 20. Métricas de validação

- Tempo até primeiro prompt útil.
- Número de prompts de retomada gerados por semana.
- Projetos ativos por usuário.
- Sessões registradas por projeto.
- Estimativa de tokens evitados.
- Conversão Free -> Pro.
- Retenção D7 e D30.
- Percentual de usuários que mantêm a extensão instalada.

## 21. Fontes técnicas consultadas

- VS Code Workspace Trust: https://code.visualstudio.com/api/extension-guides/workspace-trust
- VS Code FileSystemWatcher API: https://code.visualstudio.com/api/references/vscode-api
- VS Code Extension publishing/pricing label: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Claude Code memory: https://code.claude.com/docs/en/memory
- OpenAI Codex CLI: https://developers.openai.com/codex/cli
- MCP prompts: https://modelcontextprotocol.io/specification/2025-06-18/server/prompts
- MCP resources: https://modelcontextprotocol.io/specification/2025-11-25/server/resources
- MCP tools security considerations: https://modelcontextprotocol.io/specification/2025-03-26/server/tools
