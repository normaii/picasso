# ADR: PIC-13 - Scraper Reativo (Eventos vs Timeouts)

## 1. Contexto

A aplicação Picasso depende do portal web (ASP.NET/DevExpress) do Conexão Educação para raspar os dados dos alunos. Historicamente, a estratégia de espera pelo carregamento de cada filtro (Regional, Escola, Semestre) era baseada em *polling* com *timeouts* fixos (ex: `delay(5000)`) e tentativas baseadas em contador (ex: `stateRetries < 5`).

Isso gerava dois cenários extremos de falha:
1. Escolas com internet rápida ficavam travadas aguardando o tempo ocioso do *delay* fixo, degradando muito a performance geral (3-5 minutos para um scraper que poderia rodar em segundos).
2. Escolas com internet lenta estouravam os *timeouts* e quebravam o scraper prematuramente no meio da extração.

## 2. Decisão

Para tornar o scraper robusto, absurdamente veloz e agnóstico à velocidade da internet, decidimos refatorar todo o núcleo de captura e máquina de estados para **Reatividade Baseada em Eventos**. O Scraper só deve prosseguir o script no exato milissegundo em que os elementos desejados estiverem carregados, ou falhar se atingir um tempo global fatal de desconexão.

A arquitetura aprovada (após mais de 30 iterações em laboratório) incorpora as seguintes defesas e mecanismos:

### 2.1 Integração direta com ASP.NET AJAX (Sys.WebForms)
Em telas dinâmicas (ex: injeção de dropdowns de `UpdatePanel`), injetamos listeners diretamente nos eventos `add_beginRequest` e `add_endRequest` da classe nativa `Sys.WebForms.PageRequestManager` da página. O scraper intercepta a finalização do ciclo de vida da requisição do servidor ao invés de chutar um tempo.

### 2.2 Blindagem contra Dados Zumbis (Stale-Data)
Em conexões instáveis, o ASP.NET pode disparar um `endRequest` residual de uma requisição passada. Para evitar que a máquina de estados confunda dados velhos com carregamentos novos:
1. Criamos um `Guard Clause` atrelado ao `sawBeginRequest`. Um listener de "pronto" só aceita validar o DOM se confirmou previamente que a *nova* requisição efetivamente decolou.
2. Nas **Cascatas de Dropdowns Dependentes** (Ex: selecionou Região -> aguarda Município popular), o scraper executa `nextEl.innerHTML = ''` limpando fisicamente as opções velhas da caixa-alvo *antes* de disparar o clique na caixa-pai. Isso força a validação a falhar e obriga a espera pelo payload real do servidor.

### 2.3 Coalescência de DOM Mutations (Debouncer) e Observabilidade
Para cenários onde o AJAX nativo não está disponível (ou como um *fallback* universal), usamos um `MutationObserver` atrelado à tag `<div id="UpdateProgress1">` (tela de carregamento).
Entretanto, o Chromium consome 100% de CPU se tentar serializar o `document.outerHTML` a cada mutação de um relatório de 500 linhas que injeta nós 1 a 1.
Para sanar isso, os `MutationObservers` agora possuem um **Debounce** (atraso de agregação), coalescendo centenas de mutações do SSRS num único pulso de checagem seguro.

### 2.4 Resiliência ao SSRS Navigation (Destruição de Contexto)
O Microsoft SQL Server Reporting Services (SSRS) altera o paradigma da tela ao rodar um Full Postback (clicar no ícone de exportar). Esse full postback joga fora o contexto atual de execução no navegador (causando o erro `this world has been destroyed`).
Para sobreviver a isso, o *Main Process* do Node escuta via IPC o evento `did-finish-load` nativo do Electron e reestabelece a comunicação, reassumindo o scraping ininterruptamente.

### 2.5 Timeout Global Desacoplado
Substituímos o contador `retries` por um **Timeout Global de Rede**. Se a máquina de estados não resolver sua requisição assíncrona após `X` milissegundos (o limite vem das configurações do usuário), a `Promise` é rejeitada com um erro claro de latência.

## 3. Consequências

- **Performance Extrema:** A raspagem que antes durava minutos agora consome apenas a latência real de RTT do servidor e nada mais.
- **Rigor de QA Exigido:** Para atestar que as defesas (`Debounce`, `Stale Data`, `Full Postback` e `WebForms intercept`) funcionam, o plano de testes deve, obrigatoriamente, emular lentidões progressivas (throttling), simular quedas curtas de rede durante a paginação e mudar os dropdowns de forma randômica rapidamente.
- **Complexidade do Scraper:** A injeção de promessas `Promise` injetadas no Electron exige que manutenções futuras tomem extremo cuidado com escopos de variáveis e fechamentos de listeners para não causar vazamento de memória (Callback Leaks).
