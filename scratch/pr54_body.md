Ajustes após revisão da V15:
- **Boot Recovery Cleanup Errors**: O loop de inicialização tinha `catch`s aninhados por arquivo. O erro de permissão que o V14 pretendia estourar para fora ("rethrow") não chegava na casca porque ele era engolido dentro do `forEach`. Agora ele de fato realiza um `throw e` internamente, abortando a função assíncrona que sobe o Express server.
- **Documentação e Backlog**: Atualizado o `docs/ADR/PIC-3.md` e o `memory.md` para refletir que a concorrência assíncrona do Photo Fetcher **já foi endereçada**. Os demais apontamentos do bot ("Metadados em `renameSync` do PDF" e "`copyFileSync` in-place no banco") foram catalogados publicamente e aceitos como Overengineering dentro dos documentos arquiteturais do projeto.

(*Lembrando que o alerta de chave hardcoded na rota de front-end já está em backlog [Issue #48]*).
