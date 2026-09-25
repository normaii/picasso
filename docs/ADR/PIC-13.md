# ADR: PIC-13 - Scraper Reativo (Eventos vs Timeouts)

## 1. Contexto

A aplicação Picasso depende do portal web (ASP.NET/DevExpress) do Conexão Educação para raspar os dados dos alunos. Atualmente, a estratégia de espera pelo carregamento de cada filtro (Regional, Escola, Semestre) é baseada em *polling* com *timeouts* fixos (ex: `delay(5000)`) e tentativas baseadas em contador (ex: `stateRetries < 5`).

Em cenários reais, escolas com internet muito lenta estouram o limite de tentativas antes que o servidor web termine de renderizar a página. O scraper interpreta isso como uma falha fatal, não concluindo o trabalho.

## 2. Decisão

Para tornar o scraper robusto e agnóstico à velocidade da internet, foi decidido refatorar o núcleo de captura:

1. **Reactive Wait (MutationObserver):** Substituir todos os `delay()` cegos e o `stateRetries` por um mecanismo reativo inserido no Chromium do Electron via `executeJavaScript`. Um `MutationObserver` ficará observando as mudanças do DOM e só prosseguirá o script no exato milissegundo em que os elementos desejados (ou o sumiço do 'loading') ocorrerem.
2. **Debug Logs Obrigatórios:** A nova função de espera deverá emitir logs (via `console.log` no contexto do *renderer* e IPC para o Node) sinalizando o momento em que a escuta começou, o momento em que o elemento foi encontrado, e quanto tempo a operação levou. Isso é essencial para provar que a espera foi bem-sucedida e reagiu instantaneamente ao DOM.
3. **Timeout Global Configurável:** Ao invés de *retries*, teremos um **Timeout Global de Rede**. Para não prender o scraper infinitamente numa tela congelada, caso o `MutationObserver` não atinja o objetivo num tempo limite (ex: 60 segundos), ele joga uma exceção de *Network Timeout*. Este valor (60s por padrão) deve ser lido do `dbData.configuracoes.timeoutScraping`, permitindo que futuramente seja exposto numa tela de configurações avançadas para usuários com conexões extremas.

## 3. Consequências

- **Melhoria Absoluta na Resiliência:** O Scraper irá se adaptar microscopicamente à velocidade exata de cada pacote HTTP da rede local, seja ela de 10Gbps ou 3G caindo.
- **Complexidade do Scraper:** A injeção de promessas com `MutationObserver` do Node para o Electron aumenta levemente a curva de aprendizado do código para novos desenvolvedores, porém com retorno justificável em estabilidade.
- **Parametrização:** A adição de `timeoutScraping` nas configurações cria o primeiro parâmetro de performance ajustável pelo usuário (preparando o terreno para interfaces futuras).
