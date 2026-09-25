# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0](https://github.com/normaii/picasso/compare/v0.0.10...v0.1.0) (2026-09-25)

### ✨ Funcionalidades

* **ci:** implementar versionamento semantico, changelog automatico e pipelines multi-branch ([dd07601](https://github.com/normaii/picasso/commit/dd0760122d281aa80f251964ecdd8e8dbad6fa7f))
* **PIC-2:** implementar configuracoes multi-escola ([e7306c2](https://github.com/normaii/picasso/commit/e7306c2d4d174d240e848672b8f4727608beda46))
* **PIC-3:** Implementa arquivamento e expurgo LGPD ([3735c4a](https://github.com/normaii/picasso/commit/3735c4af77157ab26c0864be6e86e1e8b7daadf1))

### 🐛 Correções

* **ci:** ajusta releaseType no electron-builder para casar com o semantic-release ([6327c41](https://github.com/normaii/picasso/commit/6327c418d2253750ce062d95b392d9cef3acfb3f))
* **ci:** pinar conventional-changelog-conventionalcommits@9 e forcar writer@9 via overrides ([eaf8845](https://github.com/normaii/picasso/commit/eaf88459c18548359af5b38b21cc397c181f71f6))
* **ci:** remove overrides para evitar conflito com release-notes-generator ([e07be98](https://github.com/normaii/picasso/commit/e07be988c340838db915e573ef9438efc9d78635))
* **ci:** usa argumento por extenso no electron-builder ([9dc95fe](https://github.com/normaii/picasso/commit/9dc95fe8123699ae4824852a41ba962765ef77dc))
* mitiga vulnerabilidade XSS e adiciona validacoes ([bcfbeae](https://github.com/normaii/picasso/commit/bcfbeae3fe9e94a01b1def20c8350208eb968f5e))
* **PIC-33:** restringe chatops e corrige escopo da memory ([c64b8a5](https://github.com/normaii/picasso/commit/c64b8a5632f13bc7b9002af2fc5e051f63e09a95))
* **PIC-3:** Adiciona rollback do File System completo em caso de falha ([ba4f93d](https://github.com/normaii/picasso/commit/ba4f93dcaf6c03065bdd8f9ce586352587724786))
* **PIC-3:** Cleanup all leftover temp folders on archive (V11) ([6e1e628](https://github.com/normaii/picasso/commit/6e1e6282290b777267c40112d1e4e062943c64ae))
* **PIC-3:** Corrige apontamentos do Code Review (concorrência e usabilidade) ([74cdf32](https://github.com/normaii/picasso/commit/74cdf32b7763b13642576d2611e1d6af8c473359))
* **PIC-3:** Corrige concorrência extrema e rollback de PDFs (V5) ([3b724a4](https://github.com/normaii/picasso/commit/3b724a41f236d92085b0492e530929b73a3d8303))
* **PIC-3:** Corrige vazamento de Mutex (try-finally) (V6) ([ddfcae1](https://github.com/normaii/picasso/commit/ddfcae1bb5e757db6b2af1a26433bebb059bfed9))
* **PIC-3:** Prevent async lock race condition and strict boot cleanup (V15) ([9fac868](https://github.com/normaii/picasso/commit/9fac868ac5bc80fa6e6455e2186c6131f62cdd38))
* **PIC-3:** Propagação de erros atômicos, recovery transacional e documentação (V9) ([0f9bdc0](https://github.com/normaii/picasso/commit/0f9bdc06675b5982cd632f023fcb6a7a8519ea77)), closes [#45](https://github.com/normaii/picasso/issues/45)
* **PIC-3:** Refina crash-safety e validação de status de background jobs ([8c80e2d](https://github.com/normaii/picasso/commit/8c80e2dca8fcd022b67f50ec8fb0c37679a2bc4f))
* **PIC-3:** Refinamento da Arquitetura Crítica (V8) ([49f737a](https://github.com/normaii/picasso/commit/49f737af02bdf4191d397337706a3545588dd3cf))
* **PIC-3:** Refinamento final (V7) - Segurança, Concorrência e UX ([2d90b88](https://github.com/normaii/picasso/commit/2d90b880f79162fd35b4488f3d62e06c99753e51))
* **PIC-3:** Safe in-memory rollback on archive failure (V12) ([d9e91a3](https://github.com/normaii/picasso/commit/d9e91a3b9379a9ba42ee96d3aff48d6af1ef3cca))
* **PIC-3:** Safe transaction aborts and boot recovery (V14) ([b7d8c81](https://github.com/normaii/picasso/commit/b7d8c81e383223f08e8824cecdf88e73d9a4e56f))
* **PIC-3:** Scope fixes and marker safety (V13) ([baa3d86](https://github.com/normaii/picasso/commit/baa3d864506ff0adcabd0492f50c4693a2a02160))
* **PIC-3:** Strict boot cleanup and ADR alignment (V16) ([5ebb5c0](https://github.com/normaii/picasso/commit/5ebb5c032f0850551b881dbaf5bff550cf7fc424))
* **PIC-3:** Trata status adicionais e rollback de falhas ([d83aa1d](https://github.com/normaii/picasso/commit/d83aa1d6aa6ff44c491ab291032c4242e7aa3a09))
* **PIC-3:** Windows-safe atomic db save, hard-delete failure handling, pdf guard (V10) ([59eb058](https://github.com/normaii/picasso/commit/59eb05895a674fc68e35da5c53e65758938552c4))
* resolve bugs do req.body vazio e substituicao de dollar sign ([6fba276](https://github.com/normaii/picasso/commit/6fba2769d5e5af415f7e4b8ded1b83db3bb22f95))
* resolve double encoding e validacao de tipo apontados pelo copilot ([ee41855](https://github.com/normaii/picasso/commit/ee4185594504782d56d45003cc398f359e9ec96d))

### 📚 Documentação

* adiciona PIC-33 ao backlog no memory.md ([1fd4e5e](https://github.com/normaii/picasso/commit/1fd4e5e6cb464a55a8e9152d18c91352dea5d171))
* adicionar regra obrigatoria de revisao do README ([a6ea963](https://github.com/normaii/picasso/commit/a6ea963182f671b299d88bb5dbbed8d1047ebe6b))
* adicionar regra sobre status das tarefas no github projects ([8adb0e3](https://github.com/normaii/picasso/commit/8adb0e3b64dac9e9b7308031bab1a975fb9a86cf))
* Corrige apontamentos de caminhos e status (Copilot) ([b67809b](https://github.com/normaii/picasso/commit/b67809bc0f2161e02ebd6918f1d51077f30b96b1))
* formalize autonomous Copilot Code Review loop in steering guidelines ([9f358cc](https://github.com/normaii/picasso/commit/9f358cc68900d0209b0012b8aab5cbcbf92a88a4))
* **pic-1:** ADR completo e steering memory atualizado com guardrails, branching, versionamento e ciclo de vida de tarefas ([2532076](https://github.com/normaii/picasso/commit/25320766c841ccc30a32dc58b666707cede2fe8c))
* **PIC-2:** registrar ADR e atualizar steering memory ([71dbea8](https://github.com/normaii/picasso/commit/71dbea894723014b370e241cfbd041ddfc3d2230))
* **PIC-33:** ADR e memory para refinamento técnico do chatops ([d58a96f](https://github.com/normaii/picasso/commit/d58a96f90e1bdcba10c344f047959059ad801218))
* reestrutura docs/ para workflow profissional (ADR por tarefa + Steering Memory) ([62f11de](https://github.com/normaii/picasso/commit/62f11ded405aa98fc756b5e31553221edf9a8b16))
* refinamento tecnico da issue 25 (PIC-13) ([96a2c6f](https://github.com/normaii/picasso/commit/96a2c6fff08d1c1a920e38c1388cb56a612bef65))
* Refinamento Técnico PIC-3 (Arquivamento e Expurgo LGPD) ([0c6571a](https://github.com/normaii/picasso/commit/0c6571a46b2bb57542775b4980f57926245ba529))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.7](https://github.com/normaii/picasso/compare/v0.1.0-dev.6...v0.1.0-dev.7) (2026-09-25)

### ✨ Funcionalidades

* **PIC-3:** Implementa arquivamento e expurgo LGPD ([3735c4a](https://github.com/normaii/picasso/commit/3735c4af77157ab26c0864be6e86e1e8b7daadf1))

### 🐛 Correções

* **PIC-3:** Adiciona rollback do File System completo em caso de falha ([ba4f93d](https://github.com/normaii/picasso/commit/ba4f93dcaf6c03065bdd8f9ce586352587724786))
* **PIC-3:** Cleanup all leftover temp folders on archive (V11) ([6e1e628](https://github.com/normaii/picasso/commit/6e1e6282290b777267c40112d1e4e062943c64ae))
* **PIC-3:** Corrige apontamentos do Code Review (concorrência e usabilidade) ([74cdf32](https://github.com/normaii/picasso/commit/74cdf32b7763b13642576d2611e1d6af8c473359))
* **PIC-3:** Corrige concorrência extrema e rollback de PDFs (V5) ([3b724a4](https://github.com/normaii/picasso/commit/3b724a41f236d92085b0492e530929b73a3d8303))
* **PIC-3:** Corrige vazamento de Mutex (try-finally) (V6) ([ddfcae1](https://github.com/normaii/picasso/commit/ddfcae1bb5e757db6b2af1a26433bebb059bfed9))
* **PIC-3:** Prevent async lock race condition and strict boot cleanup (V15) ([9fac868](https://github.com/normaii/picasso/commit/9fac868ac5bc80fa6e6455e2186c6131f62cdd38))
* **PIC-3:** Propagação de erros atômicos, recovery transacional e documentação (V9) ([0f9bdc0](https://github.com/normaii/picasso/commit/0f9bdc06675b5982cd632f023fcb6a7a8519ea77)), closes [#45](https://github.com/normaii/picasso/issues/45)
* **PIC-3:** Refina crash-safety e validação de status de background jobs ([8c80e2d](https://github.com/normaii/picasso/commit/8c80e2dca8fcd022b67f50ec8fb0c37679a2bc4f))
* **PIC-3:** Refinamento da Arquitetura Crítica (V8) ([49f737a](https://github.com/normaii/picasso/commit/49f737af02bdf4191d397337706a3545588dd3cf))
* **PIC-3:** Refinamento final (V7) - Segurança, Concorrência e UX ([2d90b88](https://github.com/normaii/picasso/commit/2d90b880f79162fd35b4488f3d62e06c99753e51))
* **PIC-3:** Safe in-memory rollback on archive failure (V12) ([d9e91a3](https://github.com/normaii/picasso/commit/d9e91a3b9379a9ba42ee96d3aff48d6af1ef3cca))
* **PIC-3:** Safe transaction aborts and boot recovery (V14) ([b7d8c81](https://github.com/normaii/picasso/commit/b7d8c81e383223f08e8824cecdf88e73d9a4e56f))
* **PIC-3:** Scope fixes and marker safety (V13) ([baa3d86](https://github.com/normaii/picasso/commit/baa3d864506ff0adcabd0492f50c4693a2a02160))
* **PIC-3:** Strict boot cleanup and ADR alignment (V16) ([5ebb5c0](https://github.com/normaii/picasso/commit/5ebb5c032f0850551b881dbaf5bff550cf7fc424))
* **PIC-3:** Trata status adicionais e rollback de falhas ([d83aa1d](https://github.com/normaii/picasso/commit/d83aa1d6aa6ff44c491ab291032c4242e7aa3a09))
* **PIC-3:** Windows-safe atomic db save, hard-delete failure handling, pdf guard (V10) ([59eb058](https://github.com/normaii/picasso/commit/59eb05895a674fc68e35da5c53e65758938552c4))

### 📚 Documentação

* formalize autonomous Copilot Code Review loop in steering guidelines ([9f358cc](https://github.com/normaii/picasso/commit/9f358cc68900d0209b0012b8aab5cbcbf92a88a4))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.6](https://github.com/normaii/picasso/compare/v0.1.0-dev.5...v0.1.0-dev.6) (2026-09-23)

### 🐛 Correções

* **PIC-33:** restringe chatops e corrige escopo da memory ([c64b8a5](https://github.com/normaii/picasso/commit/c64b8a5632f13bc7b9002af2fc5e051f63e09a95))

### 📚 Documentação

* Corrige apontamentos de caminhos e status (Copilot) ([b67809b](https://github.com/normaii/picasso/commit/b67809bc0f2161e02ebd6918f1d51077f30b96b1))
* **PIC-33:** ADR e memory para refinamento técnico do chatops ([d58a96f](https://github.com/normaii/picasso/commit/d58a96f90e1bdcba10c344f047959059ad801218))
* Refinamento Técnico PIC-3 (Arquivamento e Expurgo LGPD) ([0c6571a](https://github.com/normaii/picasso/commit/0c6571a46b2bb57542775b4980f57926245ba529))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.5](https://github.com/normaii/picasso/compare/v0.1.0-dev.4...v0.1.0-dev.5) (2026-09-22)

### 🐛 Correções

* mitiga vulnerabilidade XSS e adiciona validacoes ([bcfbeae](https://github.com/normaii/picasso/commit/bcfbeae3fe9e94a01b1def20c8350208eb968f5e))
* resolve bugs do req.body vazio e substituicao de dollar sign ([6fba276](https://github.com/normaii/picasso/commit/6fba2769d5e5af415f7e4b8ded1b83db3bb22f95))
* resolve double encoding e validacao de tipo apontados pelo copilot ([ee41855](https://github.com/normaii/picasso/commit/ee4185594504782d56d45003cc398f359e9ec96d))

### 📚 Documentação

* adiciona PIC-33 ao backlog no memory.md ([1fd4e5e](https://github.com/normaii/picasso/commit/1fd4e5e6cb464a55a8e9152d18c91352dea5d171))
* refinamento tecnico da issue 25 (PIC-13) ([96a2c6f](https://github.com/normaii/picasso/commit/96a2c6fff08d1c1a920e38c1388cb56a612bef65))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.4](https://github.com/normaii/picasso/compare/v0.1.0-dev.3...v0.1.0-dev.4) (2026-09-22)

### ✨ Funcionalidades

* **PIC-2:** implementar configuracoes multi-escola ([e7306c2](https://github.com/normaii/picasso/commit/e7306c2d4d174d240e848672b8f4727608beda46))

### 📚 Documentação

* adicionar regra obrigatoria de revisao do README ([a6ea963](https://github.com/normaii/picasso/commit/a6ea963182f671b299d88bb5dbbed8d1047ebe6b))
* adicionar regra sobre status das tarefas no github projects ([8adb0e3](https://github.com/normaii/picasso/commit/8adb0e3b64dac9e9b7308031bab1a975fb9a86cf))
* **PIC-2:** registrar ADR e atualizar steering memory ([71dbea8](https://github.com/normaii/picasso/commit/71dbea894723014b370e241cfbd041ddfc3d2230))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-rc.2](https://github.com/normaii/picasso/compare/v0.1.0-rc.1...v0.1.0-rc.2) (2026-09-21)

### 🐛 Correções

* **ci:** ajusta releaseType no electron-builder para casar com o semantic-release ([6327c41](https://github.com/normaii/picasso/commit/6327c418d2253750ce062d95b392d9cef3acfb3f))
* **ci:** usa argumento por extenso no electron-builder ([9dc95fe](https://github.com/normaii/picasso/commit/9dc95fe8123699ae4824852a41ba962765ef77dc))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.3](https://github.com/normaii/picasso/compare/v0.1.0-dev.2...v0.1.0-dev.3) (2026-09-21)

### 🐛 Correções

* **ci:** usa argumento por extenso no electron-builder ([9dc95fe](https://github.com/normaii/picasso/commit/9dc95fe8123699ae4824852a41ba962765ef77dc))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.2](https://github.com/normaii/picasso/compare/v0.1.0-dev.1...v0.1.0-dev.2) (2026-09-21)

### 🐛 Correções

* **ci:** ajusta releaseType no electron-builder para casar com o semantic-release ([6327c41](https://github.com/normaii/picasso/commit/6327c418d2253750ce062d95b392d9cef3acfb3f))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-rc.1](https://github.com/normaii/picasso/compare/v0.0.10...v0.1.0-rc.1) (2026-09-21)

### ✨ Funcionalidades

* **ci:** implementar versionamento semantico, changelog automatico e pipelines multi-branch ([dd07601](https://github.com/normaii/picasso/commit/dd0760122d281aa80f251964ecdd8e8dbad6fa7f))

### 🐛 Correções

* **ci:** pinar conventional-changelog-conventionalcommits@9 e forcar writer@9 via overrides ([eaf8845](https://github.com/normaii/picasso/commit/eaf88459c18548359af5b38b21cc397c181f71f6))
* **ci:** remove overrides para evitar conflito com release-notes-generator ([e07be98](https://github.com/normaii/picasso/commit/e07be988c340838db915e573ef9438efc9d78635))

### 📚 Documentação

* **pic-1:** ADR completo e steering memory atualizado com guardrails, branching, versionamento e ciclo de vida de tarefas ([2532076](https://github.com/normaii/picasso/commit/25320766c841ccc30a32dc58b666707cede2fe8c))
* reestrutura docs/ para workflow profissional (ADR por tarefa + Steering Memory) ([62f11de](https://github.com/normaii/picasso/commit/62f11ded405aa98fc756b5e31553221edf9a8b16))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).


## [0.1.0-dev.1](https://github.com/normaii/picasso/compare/v0.0.10...v0.1.0-dev.1) (2026-09-21)

### ✨ Funcionalidades

* **ci:** implementar versionamento semantico, changelog automatico e pipelines multi-branch ([dd07601](https://github.com/normaii/picasso/commit/dd0760122d281aa80f251964ecdd8e8dbad6fa7f))

### 🐛 Correções

* **ci:** pinar conventional-changelog-conventionalcommits@9 e forcar writer@9 via overrides ([eaf8845](https://github.com/normaii/picasso/commit/eaf88459c18548359af5b38b21cc397c181f71f6))
* **ci:** remove overrides para evitar conflito com release-notes-generator ([e07be98](https://github.com/normaii/picasso/commit/e07be988c340838db915e573ef9438efc9d78635))

### 📚 Documentação

* **pic-1:** ADR completo e steering memory atualizado com guardrails, branching, versionamento e ciclo de vida de tarefas ([2532076](https://github.com/normaii/picasso/commit/25320766c841ccc30a32dc58b666707cede2fe8c))
* reestrutura docs/ para workflow profissional (ADR por tarefa + Steering Memory) ([62f11de](https://github.com/normaii/picasso/commit/62f11ded405aa98fc756b5e31553221edf9a8b16))

# Changelog — Picasso

Todas as mudanças notáveis do projeto são documentadas neste arquivo.
Formato baseado em [Conventional Commits](https://www.conventionalcommits.org/).

## Histórico Alpha (v0.0.1 — v0.0.10)

Consulte o [ADR Alpha Baseline](docs/ADR/ADR-ALPHA-BASELINE.md) para o registro completo de decisões da fase Alpha.
