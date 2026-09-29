## Resumo da Implementação (PIC-3)
Esta Pull Request implementa o módulo de **Encerramento de Ciclo Letivo (LGPD Purge)**, garantindo a exclusão segura de fotos de alunos e a retenção de dados sensíveis essenciais para histórico.

### Funcionalidades Principais
1. **Arquivamento Seguro (Soft-Delete)**:
   - Criação de backup automático do banco de dados (JSON) em `archive_db/`.
   - Movimentação segura de carteirinhas (PDFs) para `pdfs/archive_pdfs/`.
2. **Expurgo Fotográfico (Hard-Delete LGPD)**:
   - Exclusão física definitiva do diretório de fotos dos alunos do ciclo encerrado.
   - Limpeza in-memory dos dados do banco (`alunos`, `log_scraping`) e reset dos IDs.
3. **Interface do Usuário**:
   - Novo botão de "Encerrar Ciclo Letivo" nas Configurações.
   - Modal de Dupla Confirmação com validação (digitar "ENCERRAR" para ativar).

### Arquitetura de Confiabilidade e Resiliência
Durante o ciclo de desenvolvimento (V1 a V16), dezenas de travas de segurança foram implementadas para impedir corrupções de banco e lidar com falhas inerentes do SO:
- **Gravação Atômica (Windows-safe)**: O salvamento do JSON (`saveDb()`) agora utiliza arquivos temporários `.tmp` com fallback síncrono para garantir que falhas de IO/Antivírus não apaguem o banco em uso.
- **Mutex e Concorrência**: Travas rigorosas (`isArchiving` e sincronização direta no *PhotoFetcher*) evitam `race conditions` durante o processo de encerramento, pausando operações de scraping, PDFs e downloads simultâneos.
- **Rollback Transacional Total**: Se ocorrer qualquer erro *durante* o encerramento (seja de IO, permissão ou escopo), toda a transação é desfeita. O JSON restaurado a partir do snapshot in-memory e os diretórios (PDFs e Fotos) são restabelecidos sem perdas.
- **Boot Recovery (Fail-Fast)**: Em caso de queda abrupta de energia durante a transação física final, a inicialização (`initDatabase()`) detecta lixo e marcadores transacionais (`.archive_committed`). Ele restaura automaticamente os dados de fotos se o JSON não houver comitado com sucesso, ou apaga silenciosamente pastas zumbis no caso de expurgos comitados (sendo fatal e abortando o start do backend se o SO recusar acesso de leitura nesses diretórios).

**Referência**: [ADR PIC-3](docs/ADR/PIC-3.md) e Documentação [memory.md](docs/steering/memory.md) atualizadas.
