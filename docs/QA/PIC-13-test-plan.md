# Plano de Teste (QA): PIC-13 - Scraper Reativo

Este documento garante a validação rigorosa em ambiente de desenvolvimento (máquinas potentes) de que a nova lógica de *MutationObserver* resiste a cenários de rede extremamente instáveis e degradadas, típicas das escolas alvo.

## Pré-requisitos
- O ambiente deve rodar a versão com a implementação da PIC-13.
- No banco de dados (`picasso_db.json`), `configuracoes.timeoutScraping` deve estar configurado (ou ausente, usando o fallback de 60s).

## Cenario 1: Simulação de Alta Latência (Slow 3G)
Como testaremos numa máquina rápida, devemos *simular* intencionalmente uma conexão extremamente lenta para provar que a aplicação sabe esperar, e não desiste precipitadamente.

### Passos de Teste (Na unha / DevTools)
1. **Abrir o DevTools da Janela do Scraper:**
   Para fins de QA, no código `scraper.js`, altere temporariamente `show: false` para `show: true` (se estiver no build local, ou abra o devtools programaticamente via `win.webContents.openDevTools()`).
2. **Aplicar Throttling:**
   Com o DevTools aberto na janela invisível que fará o scraping, vá até a aba **Network**, clique no menu de *Throttling* (provavelmente em "No throttling") e selecione **"Slow 3G"**.
3. **Executar o Fluxo:**
   Volte para a tela principal da aplicação Picasso e clique em **Atualizar Banco / Sincronizar**.
4. **Verificar os Logs de Debug:**
   Na janela de terminal do Node (ou DevTools principal), acompanhe atentamente a saída dos logs:
   - *Comportamento Esperado:* O log deve mostrar "Aguardando DOM para o dropdown X...".
   - A requisição no DevTools do scraper ficará "Pending" por 5, 10 ou até 20 segundos.
   - O log **NÃO PODE** imprimir falha ou estourar contador (já que não há mais contadores cegos).
   - Assim que o *Response* da rede voltar e o DOM do SEEDUC for atualizado, o log **DEVE** mostrar na exata mesma fração de segundo: "Elemento X renderizado no DOM após 15430ms. Prosseguindo."
   
## Cenario 2: Simulação de Timeout Real (Teste de Timeout Configurável)
Nesta fase, queremos provar que o timeout global encerra a rotina ordenadamente após expirar o tempo limite parametrizado, protegendo a aplicação contra loops infinitos de travamento da nuvem.

### Passos de Teste
1. No arquivo `picasso_db.json` (ou pela injeção no código), mude o parâmetro `"timeoutScraping"` para `10` (10 segundos).
2. Repita os passos 1 e 2 do Cenário 1 (aplicando *Slow 3G* no DevTools, ou *Offline* no meio da requisição).
3. Dispare a sincronização do Scraper.
4. **Verificar Saída:**
   - Como a rede "Slow 3G" vai demorar mais que 10 segundos, exatamente na marca dos 10 segundos, o Observer interno no Chromium deve desarmar (disconnect) e arremessar uma *exception*.
   - A interface do Picasso deverá capturar essa falha ordenadamente, interromper o fluxo e mostrar o alerta de erro "Falha na comunicação de rede com o servidor SEEDUC. (Timeout)". O log deve registrar isso sem crashar a aplicação.
