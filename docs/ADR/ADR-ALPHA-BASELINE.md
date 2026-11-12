> [!CAUTION]
> **📦 DOCUMENTO HISTÓRICO — CONGELADO NA v0.0.10 (Alpha Final)**
> Este ADR monolítico serviu como base para toda a fase Alpha do projeto Picasso (v0.0.1 → v0.0.10).
> A partir desta versão, novas decisões arquiteturais são documentadas como **ADRs individuais por tarefa** na pasta `docs/ADR/`, seguindo a chave do GitHub Project (ex: `PIC-1.md`).
> Consulte o [Steering Memory](../steering/memory.md) para a visão consolidada e atualizada do projeto.

---

# Picasso — Architecture Decision Records (ADR) — Alpha Baseline

Documento de registro de todas as decisões arquiteturais e de design tomadas durante a fase Alpha do projeto Picasso.

> **Formato**: Cada ADR segue o padrão: **Contexto** → **Decisão** → **Justificativa** → **Consequências**

---

## Índice

| ADR | Título | Status | Data |
|-----|--------|--------|------|
| [ADR-001](#adr-001) | Sistema alvo para scraping | ✅ Aceito | 2026-08-13 |
| [ADR-002](#adr-002) | Estratégia de autenticação | ✅ Aceito | 2026-08-13 |
| [ADR-003](#adr-003) | Tipo de aplicação (Desktop vs Web) | ✅ Aceito | 2026-08-13 |
| [ADR-004](#adr-004) | Armazenamento de dados | 🔄 Modificado | 2026-09-12 |
| [ADR-005](#adr-005) | Idioma da interface | ✅ Aceito | 2026-08-13 |
| [ADR-006](#adr-006) | Stack tecnológica | 🔄 Modificado | 2026-09-12 |
| [ADR-007](#adr-007) | Estratégia de scraping dos dados | ✅ Aceito | 2026-08-13 |
| [ADR-008](#adr-008) | Estratégia de scraping das fotos | ✅ Aceito | 2026-08-13 |
| [ADR-009](#adr-009) | Formato de saída (PDF) | 🔄 Modificado | 2026-09-12 |
| [ADR-010](#adr-010) | Estrutura do projeto | ✅ Aceito | 2026-08-13 |
| [ADR-011](#adr-011) | Setup e Distribuição em Produção | ✅ Aceito | 2026-09-12 |
| [ADR-012](#adr-012) | Agnosticidade de Escola (Multi-escola) | ✅ Aceito | 2026-09-12 |
| [ADR-013](#adr-013) | Política de Expurgo de Dados | ✅ Aceito | 2026-09-12 |
| [ADR-014](#adr-014) | Orientação e Distribuição do Layout (Futuro) | 🔮 Proposto (V2) | 2026-09-12 |
| [ADR-015](#adr-015) | Single Instance Lock (Prevenção de Zumbis) | ✅ Aceito | 2026-09-12 |
| [ADR-016](#adr-016) | Política de Atualização do Runtime (Node.js LTS) | ✅ Aceito | 2026-09-12 |
| [ADR-017](#adr-017) | Mecanismo Passivo de Atualização (Update Checker) | ✅ Aceito | 2026-09-12 |
| [ADR-018](#adr-018) | Pipeline de Auto-Bumping e Pre-Releases | ✅ Aceito | 2026-09-12 |
| [ADR-019](#adr-019) | Interface Amigável de Importação | 🔮 Proposto (Futuro) | 2026-09-16 |
| [ADR-020](#adr-020) | Desacoplamento da Sessão e Orquestração Modular | 🔮 Proposto (Pós-V1) | 2026-09-16 |

---

## ADR-001
### Sistema Alvo para Scraping

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Precisávamos identificar o sistema web de onde seriam extraídos os dados dos alunos (nome, matrícula, turma e foto).

**Decisão**: O sistema alvo é o **Conexão Educação** da Secretaria de Educação do Estado do Rio de Janeiro.
- URL base: `https://conexao.educacao.rj.gov.br`
- Relatório de alunos: `/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`
- Cadastro de alunos (foto): `/ConexaoEducacao/Academico/Alunos.aspx`

**Justificativa**: É o sistema oficial utilizado pela direção escolar para gestão acadêmica. Todos os dados necessários estão disponíveis via HTML scraping.

**Consequências**:
- O scraper deve ser adaptado especificamente para a estrutura HTML do Conexão Educação
- Alterações na interface do sistema podem quebrar o scraper (risco de manutenção)
- O acesso depende das credenciais do diretor

---

## ADR-002
### Estratégia de Autenticação

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: O Conexão Educação possui CAPTCHA no formulário de login, impossibilitando login automatizado.

**Decisão**: Implementar login **manual** via janela de navegador embutida (Electron). O diretor faz login normalmente (incluindo CAPTCHA), e o sistema captura os cookies da sessão para reutilizá-los no scraping automatizado.

**Justificativa**:
- CAPTCHA impede automação do login
- Login manual é a abordagem mais confiável e não viola políticas de uso
- Cookies de sessão podem ser reutilizados nativamente

**Consequências**:
- O diretor precisa fazer login manualmente a cada sessão de scraping
- A sessão pode expirar durante o scraping (necessário tratamento de timeout)
- Não há necessidade de armazenar credenciais

---

## ADR-003
### Tipo de Aplicação (Desktop vs Web)

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Avaliamos se Picasso deveria ser um app web hospedado ou um app desktop local.

**Decisão**: **Aplicação desktop offline** usando Electron, rodando localmente na máquina do diretor.

**Justificativa**:
- Não requer infraestrutura de hospedagem
- Funciona offline após o scraping
- Integra naturalmente com Google Drive via sincronização de pasta local
- Electron permite a janela de login embutida para CAPTCHA

**Consequências**:
- Distribuição via instalador local (ou executável portátil)
- Atualizações precisam ser distribuídas manualmente (ou via auto-update do Electron)

---

## ADR-004
### Armazenamento de Dados

**Status**: 🔄 Modificado — 2026-09-12 (Substituiu SQLite)

**Contexto**: Precisávamos definir onde armazenar os dados scrapeados (banco de dados, fotos dos alunos) e os PDFs gerados, garantindo que funcionasse sem atritos nos computadores das escolas.

**Decisão**: Usar um **arquivo JSON simples (Custom JSON DB)** para os dados dos alunos e log, e armazenar todos os arquivos (JSON, fotos, PDFs) em uma **pasta local sincronizada com Google Drive**.

**Justificativa**:
- O volume de dados de uma escola típica (alguns milhares de alunos) permite o armazenamento 100% em memória/JSON com latência imperceptível.
- Removemos o SQLite porque módulos como `better-sqlite3` exigem compilação nativa em C++ (causando falhas na instalação), e o nativo `node:sqlite` requer versões de Node.js que podem ser incompatíveis com o motor do Electron.
- Google Drive sync oferece backup automático na nuvem sem complexidade.

**Consequências**:
- O banco inteiro é lido na memória ao iniciar e salvo sincronicamente a cada mutação (aceitável dada a escala).
- Zero dependências de compilação ou DLLs, garantindo 100% de compatibilidade em distribuições do Windows.

---

## ADR-005
### Idioma da Interface

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Definir o idioma da interface do usuário e das carteirinhas geradas.

**Decisão**: **Português (pt-BR)** para toda a interface, labels, mensagens e conteúdo das carteirinhas.

**Justificativa**: Os usuários finais (diretores escolares) são brasileiros, e o sistema alvo já está em português.

**Consequências**:
- Todas as strings da UI em pt-BR
- Documentação técnica (código, comentários) pode permanecer em inglês

---

## ADR-006
### Stack Tecnológica

**Status**: 🔄 Modificado — 2026-09-12 (Removeu Playwright/Puppeteer)

**Contexto**: Seleção das tecnologias para cada camada da aplicação visando portabilidade e menor tamanho de pacote.

**Decisão**:

| Camada | Tecnologia |
|---|---|
| Desktop | Electron |
| Front-End | HTML + CSS + JS (Vanilla) |
| Backend | Node.js + Express |
| Scraping | Electron `BrowserWindow` (nativo) |
| Banco de Dados | JSON File Storage |
| Geração de PDF | Electron `webContents.printToPDF()` (nativo) |

**Justificativa**:
- **Electron**: Necessário para janela de login embutida e distribuição desktop.
- **Vanilla Front-End**: Simplicidade, sem build step, carregamento rápido.
- **Remoção do Playwright/Puppeteer**: Playwright e Puppeteer baixam Chromium secundários, adicionando mais de ~300MB ao instalador e frequentemente sofrendo bloqueios de rede/firewall corporativo nas escolas durante o setup. Usar os módulos nativos do Electron (`BrowserWindow` invisível e função `printToPDF()`) cumpre as mesmas funções perfeitamente e mantém a base de dependências mínima.

**Consequências**:
- O scraper precisa usar a arquitetura de Injeção de Código (IPC e `executeJavaScript`) no Electron em vez das APIs convenientes do Playwright.
- App muito mais enxuto e aprova à prova de falhas em instalação.

---

## ADR-007
### Estratégia de Scraping dos Dados

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Definir como extrair os dados dos alunos (nome, matrícula, turma) do Conexão Educação.

**Decisão**: Scraping da página de relatório `RelAlunosMatPTurma` (Relatório de Alunos Matriculados Por Turma).

**Detalhes**:
- URL: `https://conexao.educacao.rj.gov.br/ConexaoEducacao/Relatorio/PageViewer.aspx?report=RelAlunosMatPTurma&grp=GESTAO`
- Navegar com cookies de sessão capturados
- Parsear tabelas HTML para extrair dados via script injetado pelo Electron.

**Justificativa**: Este relatório já contém todos os dados necessários em formato tabular (nome, matrícula, turma).

**Consequências**:
- Dependente da estrutura HTML do relatório (frágil a mudanças no sistema)

---

## ADR-008
### Estratégia de Scraping das Fotos

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: As fotos dos alunos não estão no relatório de alunos, mas na página individual de cadastro.

**Decisão**: Para cada aluno, navegar à página `Alunos.aspx`, buscar pela matrícula e extrair a URL da foto.

**Detalhes**:
- URL: `https://conexao.educacao.rj.gov.br/ConexaoEducacao/Academico/Alunos.aspx`
- Buscar aluno por matrícula e extrair link da foto do elemento respectivo.
- Salvar imagem de forma assíncrona.

**Justificativa**: É a única forma disponível de obter as fotos no sistema.

**Consequências**:
- Processo mais lento (uma requisição por aluno)

---

## ADR-009
### Formato de Saída (PDF)

**Status**: 🔄 Modificado — 2026-09-12

**Contexto**: Definir o formato de saída das carteirinhas para impressão e o motor gerador.

**Decisão**: Gerar **PDF em formato A4** com múltiplas carteirinhas por página, usando **`webContents.printToPDF()`** do Electron.

**Detalhes**:
- Layout A4: ~8-10 carteirinhas por página (2 colunas × 4-5 linhas)
- Pipeline: HTML/CSS template → Janela oculta do Electron renderiza → `printToPDF()` salva no disco.

**Justificativa**: O Electron renderiza o HTML usando as mesmas engines do Chrome e gera PDFs da mesma maneira que o Puppeteer, com zero overhead de dependências externas.

---

## ADR-010
### Estrutura do Projeto

**Status**: ✅ Aceito — 2026-08-13

**Contexto**: Organização dos arquivos e diretórios do projeto.

**Decisão**: Estrutura modular com separação clara de responsabilidades (main.js, backend na /src, frontend na /public).

---

## ADR-011
### Setup e Distribuição em Produção

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: Os diretores não têm conhecimento técnico para instalar Node.js, Git, dependências do NPM ou rodar arquivos `.bat`. O sistema alvo Windows pode ter permissões rigorosas.

**Decisão**: Compilar a aplicação usando **`electron-builder`** em um instalador autônomo único (`.exe`).

**Justificativa**: O `.exe` gerado pelo electron-builder já encapsula os binários do Node.js, Electron, código-fonte e Chromium. A instalação acontece como qualquer programa padrão do Windows, criando atalhos e extraindo arquivos silenciosamente no `AppData`.

**Consequências**:
- O usuário final baixa apenas 1 arquivo.
- Problemas de path ou dependência C++ global do Node são eliminados.

---

## ADR-012
### Agnosticidade de Escola (Multi-escola)

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: O produto resolve uma dor comum a muitas escolas do Estado do Rio de Janeiro, portanto, não pode ter dados fixos (hardcoded) de uma única escola.

**Decisão**: O sistema não fará restrições ao layout para uma escola específica. Os recursos de identidade visual (nome da escola, brasão/logo) serão parametrizáveis na Interface do sistema (Fase 4). 

**Justificativa**: Garante que o Picasso seja distribuído como um pacote universal para a rede estadual sem precisar de builds exclusivos por escola.

**Consequências**:
- O frontend precisará de uma aba de configurações.
- A fase 3 (Geração de PDF) deverá ler as configurações do banco JSON de forma dinâmica.

---

## ADR-013
### Política de Expurgo de Dados

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: Por questões de privacidade (LGPD) e higienização para o novo ano letivo, escolas precisam remover dados antigos de alunos. A responsabilidade do dado scrapeado é da escola e fica retido apenas localmente.

**Decisão**: Implementar no Roadmap futuro uma funcionalidade de exclusão total de dados (hard-delete) da base JSON e das pastas de imagens. 

**Justificativa**: Como a escola tem posse dos dados offline na máquina, é vital oferecer uma funcionalidade para sanitização do ambiente a cada ciclo letivo, evitando vazamentos locais ou mistura de alunos inativos com novos.

**Consequências**:
- Adiciona um novo fluxo de UI (Painel de Configurações avançadas).

---

## ADR-014
### Orientação e Distribuição do Layout (Futuro)

**Status**: 🔮 Proposto (Planejado para V2) — 2026-09-12

**Contexto**: Na primeira versão (V1), os crachás foram orientados na folha A4 com o formato "Retrato", porém a leitura de texto neles está alinhada à horizontal da folha, resultando numa "Frente e Verso" adjacentes horizontalmente. Diretorias de escola podem preferir um formato diferente, com layout de leitura orientado em paisagem rotacionada, permitindo melhor distribuição de espaço e encaixe nos porta-crachás verticais tradicionais do RJ.

**Decisão**: Para a V1, será mantido o layout atual. No entanto, fica estabelecido como forte indicativo para a V2 uma refatoração no `cardTemplate.html` e `a4Layout.html` para **rotacionar e redistribuir os dados** na orientação paisagem.

**Justificativa**: A prioridade da V1 é validar o motor de geração de PDFs, a coleta agnóstica de dados e a emissão funcional. Na V2, teremos espaço para refinar a experiência do usuário final com aprovação das diretorias, baseando-se em testes físicos de impressão.

**Consequências**:
- O CSS e HTML das carteirinhas passarão por um *redesign* estrutural completo na próxima grande atualização.
- Os templates atuais devem se manter modulares para não impactar a lógica do NodeJS (que apenas substitui strings) quando esse redesign acontecer.

---

## ADR-015
### Single Instance Lock (Prevenção de Zumbis)

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: O executável compilado (.exe) demora alguns segundos para iniciar (boot do Electron e Chromium). Em ambientes lentos, o usuário final pode clicar múltiplas vezes no atalho, abrindo várias instâncias simultâneas em background. Isso causa erro de porta (EADDRINUSE na porta 3000) e os processos ficam congelados, consumindo memória ("zumbis").

**Decisão**: Utilizar `app.requestSingleInstanceLock()` do Electron no `main.js`. 

**Justificativa**: Garante que apenas o processo mestre inicial sobreviva. Se uma segunda execução for detectada, ela será terminada imediatamente e o foco será passado para a janela já existente (restaurando-a, caso esteja minimizada).

**Consequências**:
- Fim de travamentos silenciosos por concorrência de portas.
- Otimização do consumo de memória RAM do usuário.

---

## ADR-016
### Política de Atualização do Runtime (Node.js LTS)

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: Pipelines de CI/CD (GitHub Actions) emitem avisos de depreciação ao rodar com versões antigas do Node.js (ex: Node 20 em 2026). Manter runtimes defasados expõe as esteiras a falhas futuras, vulnerabilidades e incompatibilidades.

**Decisão**: Os Runners das Actions e os pacotes de compilação devem estar atrelados estritamente à versão **LTS (Long Term Support) Ativa** mais recente (ex: Node 24).

**Justificativa**: Garante previsibilidade e longevidade para o projeto open-source sem sacrificar estabilidade (já que evitamos versões *Current* ou *Nightly*). Como o Electron empacota seu próprio Node.js no cliente final, essa atualização impacta exclusivamente as máquinas de build, sendo de baixo risco para a aplicação.

---

## ADR-017
### Mecanismo Passivo de Atualização (Update Checker)

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: O sistema precisa notificar o usuário (diretor da escola) quando uma nova versão com correções de bugs ou novas *features* estiver disponível. Implementar Auto-Update (Squirrel) exige certificados assinados e gera atritos de firewall e privilégios no ambiente escolar.

**Decisão**: Implementar um "Update Checker Passivo". O Electron (Backend) faz um `fetch` para a API pública do GitHub Releases, compara a versão da tag mais recente com a versão compilada, e exibe no Frontend (aba de Configurações) se o software está atualizado ou se precisa de intervenção manual (baixar o novo `.exe`).

**Justificativa**: Evita a complexidade técnica do auto-update nativo na Fase 1, entregando valor imediato ao alertar usuários desatualizados sem interrupções intrusivas.

---

## ADR-018
### Pipeline de Auto-Bumping e Pre-Releases

**Status**: ✅ Aceito — 2026-09-12

**Contexto**: O versionamento e lançamento manuais (`git tag`, alteração de `package.json`, publicação de releases) são propensos a erro humano e consomem tempo. Além disso, as releases recém-compiladas não devem atingir os usuários finais (escolas) antes de serem validadas manualmente.

**Decisão**: 
1. **Auto-Bump**: Uma Action (`auto-bump.yml`) escuta *pushes/merges* na `master`. Ela incrementa o *patch* do `package.json` (`npm version patch`), faz o commit com `[skip ci]` e cria a tag vX.Y.Z, disparando a pipeline de release.
2. **Pre-release Flag**: O `electron-builder` foi configurado (`releaseType: "prerelease"`) para gerar as GitHub Releases sempre como *Pre-release*. 
3. **Promoção Manual**: O *Update Checker* (ADR-017) busca em `/releases/latest` (que ignora *pre-releases*). Portanto, a versão só fica visível para os usuários quando o administrador manualmente remover a flag de *Pre-release* pelo painel do GitHub.

**Justificativa**: Garante *Continuous Delivery* sem quebrar o funil de qualidade (QA) e elimina intervenção manual no Git.

## ADR-019
### Interface Amigável de Importação

**Status**: 🔮 Proposto (Planejado para versão futura) — 2026-09-16

**Contexto**: Atualmente, na fase Alpha, a extração de turmas e alunos ocorre em segundo plano com logs técnicos estilo terminal no console, enquanto a UI da aplicação não dá feedback visual detalhado do progresso, apenas um aviso de sincronização finalizada ou erro.

**Decisão**: Substituir o fluxo invisível/terminal por uma Interface de Importação amigável. A tela deverá exibir etapas claras (ex: "Obtendo turmas...", "Enriquecendo dados..."), acompanhada de uma **barra de progresso** baseada no total de turmas extraídas e relatórios de erro mais humanos e tratáveis, deixando claro onde o sistema falhou (se falhar).

**Justificativa**: Diretores de escola não estão acostumados com interfaces de linha de comando. Fornecer feedback visual em tempo real aumenta a confiança no sistema de que a extração não "travou", reduzindo fechamentos prematuros do app e chamados de suporte.

**Consequências**:
- O `scraper.js` deverá emitir eventos IPC frequentes de status e progresso.
- O Frontend precisará construir componentes de loading/progresso dinâmicos.
- Para a versão atual (Alpha), será mantido o modelo atual baseado em logs para priorizar o fechamento da engenharia de raspagem.

---

## ADR-020
### Desacoplamento da Sessão de Autenticação e Orquestração Modular

**Status**: 🔮 Proposto (Melhoria Pós-V1) — 2026-09-16

**Contexto**: No protótipo inicial da V1, a rotina de Login manual com CAPTCHA estava rigidamente atrelada ao acionamento do botão "Sincronizar". Isso forçava uma extração completa da listagem de turmas/alunos mesmo quando o diretor desejava apenas obter fotos pendentes, ou resultava em falhas no módulo de fotos caso o login não tivesse sido realizado previamente na mesma sessão. Além disso, a sessão no Electron dependia exclusivamente da permanência em memória durante o ciclo de vida da janela.

**Decisão**:
1. **Landing Home Screen na V1**: Desacoplar o Login de qualquer módulo de extração. O login no Conexão Educação passa a ser a porta de entrada da aplicação, executado na Home Screen. Uma vez autenticado com sucesso, a interface exibe o status de sessão ativa ("Login efetuado com Sucesso") e libera o acesso independente aos módulos satélites:
   - **Módulo AdD (Aquisição de Dados)**: Importação de turmas e alunos.
   - **Módulo CdF (Captura de Fotos)**: Download de fotos (condicionado à existência de alunos carregados).
   - **Sincronização Geral**: Orquestração em cadeia (AdD seguido de CdF) com estimativa de tempo e aviso de segurança quando não houver histórico comparativo.
2. **Evolução Pós-V1**:
   - **Persistência Criptografada**: Armazenar os cookies de sessão de forma segura no disco usando `safeStorage` do Electron (criptografia baseada em DPAPI no Windows / Keychain no macOS).
   - **Revalidação Transparente / Health-Check**: O sistema verificará em background a validade dos cookies periodicamente antes de acionar AdD ou CdF.
   - **Renovação Sem Quedas**: Caso a sessão expire durante uma carga longa de fotos, o sistema suspenderá a fila temporariamente, abrirá a janela de login modal apenas para o diretor resolver o CAPTCHA e retomará a fila de downloads de onde parou sem perda de progresso.

**Justificativa**: Reduz drasticamente o atrito de uso diário, elimina raspagens repetitivas de 500+ alunos sem necessidade, e concede total independência aos módulos AdD, CdF e GdI.

**Consequências**:
- A Home Screen passa a atuar como painel de controle operacional de autenticação e prontidão dos módulos.
- Os módulos AdD e CdF operam de forma autônoma sem exigir login redundante.
- A persistência criptografada exigirá implementação cuidadosa na V2 para respeitar privacidade e segurança de dados do diretor escolar.

---

## Histórico de Alterações

| Data | Alteração |
|------|-----------|
| 2026-08-13 | Criação do documento com ADR-001 a ADR-010 |
| 2026-09-12 | Adicionado ADR-011. Revisão do ADR-004 (SQLite → JSON), ADR-006 (Playwright/Puppeteer → Electron native) e ADR-009. |
| 2026-09-12 | Adicionado ADR-012 (Agnosticidade) e ADR-013 (Expurgo de Dados). |
| 2026-09-12 | Adicionado ADR-014 (Alteração de Orientação do Layout para V2). |
| 2026-09-12 | Adicionado ADR-015 (Single Instance Lock). |
| 2026-09-12 | Adicionado ADR-016 (Política do Runtime Node.js LTS). |
| 2026-09-12 | Adicionado ADR-017 (Update Checker Passivo). |
| 2026-09-12 | Adicionado ADR-018 (Auto-Bumping e Pre-Releases). |
| 2026-09-16 | Adicionado ADR-019 (Interface Amigável de Importação). |
| 2026-09-16 | Adicionado ADR-020 (Desacoplamento de Sessão e Orquestração Modular Pós-V1). |

