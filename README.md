# 🎨 Picasso — Gerador de Carteirinhas Escolares

**Picasso** é uma aplicação desktop que automatiza a criação de carteirinhas estudantis prontas para impressão. O sistema extrai os dados dos alunos (nome, matrícula, turma e foto) do portal **Conexão Educação** da Secretaria de Educação do Estado do Rio de Janeiro e gera PDFs em formato A4 com as carteirinhas organizadas para corte.

---

## 📋 Índice

- [O que o Picasso faz?](#-o-que-o-picasso-faz)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação passo a passo](#-instalação-passo-a-passo)
- [Configuração](#-configuração)
- [Como executar](#-como-executar)
- [Como usar (operacional)](#-como-usar-operacional)
- [Estrutura do projeto](#-estrutura-do-projeto)
- [Scripts disponíveis](#-scripts-disponíveis)
- [Resolução de problemas](#-resolução-de-problemas)
- [Licença](#-licença)

---

## 🎯 O que o Picasso faz?

1. **Login manual**: Você faz login no Conexão Educação normalmente (com CAPTCHA) dentro de uma janela do Picasso.
2. **Coleta automática**: O sistema usa a sua sessão para coletar os dados e fotos de todos os alunos.
3. **Busca e seleção**: Uma interface amigável permite buscar, filtrar por turma e selecionar quais alunos terão carteirinha.
4. **Geração de PDF**: Com um clique, gera um arquivo PDF pronto para impressão com todas as carteirinhas.

```
Login manual → Coleta de dados → Seleção de alunos → PDF para impressão
```

---

## ✅ Pré-requisitos

Antes de começar, você precisa ter instalado no seu computador:

| Programa | Versão mínima | Como verificar | Link para baixar |
|----------|---------------|----------------|------------------|
| **Node.js** | 18 ou superior | Abra o terminal e digite `node --version` | [nodejs.org](https://nodejs.org/) |
| **Git** | Qualquer versão | Abra o terminal e digite `git --version` | [git-scm.com](https://git-scm.com/) |

> 💡 **Dica**: Ao instalar o Node.js, escolha a versão **LTS** (Long Term Support). Ela já inclui o **npm** (gerenciador de pacotes) que usaremos nos próximos passos.

### Como abrir o terminal?

- **Windows**: Pressione `Win + R`, digite `cmd` e pressione Enter. Ou busque por "Prompt de Comando" no menu Iniciar.
- **Mac**: Abra o aplicativo "Terminal" (está em Aplicativos > Utilitários).
- **Linux**: Pressione `Ctrl + Alt + T`.

---

## 📦 Instalação passo a passo

### 1. Clonar o repositório

Abra o terminal e execute:

```bash
git clone https://github.com/normaii/picasso.git
```

Isso cria uma pasta chamada `picasso` com todos os arquivos do projeto.

### 2. Entrar na pasta do projeto

```bash
cd picasso
```

### 3. Instalar as dependências

```bash
npm install
```

> ⏳ Este comando pode demorar alguns minutos na primeira vez, pois precisa baixar várias bibliotecas. Aguarde até ver a mensagem de conclusão.

### 4. Instalar o navegador para scraping

```bash
npx playwright install chromium
```

> Este comando baixa o navegador Chromium que o Picasso usa internamente para acessar o Conexão Educação.

---

## ⚙️ Configuração

### 1. Criar o arquivo de configuração

Na pasta do projeto, copie o arquivo de exemplo:

**Windows:**
```bash
copy .env.example .env
```

**Mac/Linux:**
```bash
cp .env.example .env
```

### 2. Editar o arquivo `.env`

Abra o arquivo `.env` com qualquer editor de texto (Bloco de Notas, VS Code, etc.) e configure:

```ini
# Pasta onde os dados serão salvos (fotos, banco de dados, PDFs gerados).
# Se quiser backup automático, aponte para uma pasta do Google Drive.
DATA_DIR=./data

# URL do sistema (não precisa alterar).
SYSTEM_URL=https://conexao.educacao.rj.gov.br

# Porta do servidor local (não precisa alterar).
PORT=3000
```

> ⚠️ **Importante**: O arquivo `.env` contém configurações locais e **nunca** deve ser compartilhado ou enviado para o GitHub. Ele já está protegido pelo `.gitignore`.

#### Usando com Google Drive (opcional)

Se quiser que fotos e PDFs façam backup automático na nuvem, altere o `DATA_DIR` para apontar para uma pasta dentro do seu Google Drive:

```ini
# Exemplo Windows:
DATA_DIR=C:\Users\SeuNome\Google Drive\Picasso

# Exemplo Mac:
DATA_DIR=/Users/seunome/Google Drive/Picasso
```

---

## 🚀 Como executar

### Modo desenvolvimento (para programadores)

Este modo abre a aplicação com o **DevTools** do navegador visível, útil para depuração:

```bash
npm run dev
```

### Modo normal (para uso no dia a dia)

```bash
npm start
```

### Apenas o servidor (sem interface Electron)

Útil para testes ou se quiser acessar a interface pelo navegador:

```bash
npm run server
```

Depois abra no navegador: [http://localhost:3000](http://localhost:3000)

---

## 🖨️ Como usar (operacional)

### Passo 1 — Fazer login

1. Abra o Picasso (`npm start`).
2. Clique no botão **"Fazer Login no Conexão Educação"**.
3. Uma janela do navegador abrirá com a página de login do sistema.
4. Faça login normalmente com seu usuário, senha e CAPTCHA.
5. Após o login, a janela fechará automaticamente e você verá a mensagem **"Conectado!"**.

### Passo 2 — Coletar dados dos alunos

1. Clique em **"Iniciar Coleta"**.
2. O sistema acessará o Conexão Educação para coletar os dados de todos os alunos.
3. Uma barra de progresso mostrará o andamento.
4. Ao finalizar, você verá quantos alunos foram coletados.

> ⏳ A coleta pode demorar alguns minutos dependendo da quantidade de alunos e da velocidade da internet.

### Passo 3 — Selecionar alunos

1. Use a **barra de busca** para encontrar alunos por nome ou matrícula.
2. Use o **filtro de turma** para ver apenas alunos de uma turma específica.
3. Clique nos alunos que deseja incluir na carteirinha (ou clique em **"Selecionar Todos"**).

### Passo 4 — Gerar e imprimir as carteirinhas

1. Clique em **"Gerar Carteirinhas"**.
2. O sistema criará um arquivo PDF com todas as carteirinhas selecionadas.
3. O PDF abrirá automaticamente para você **conferir e imprimir**.

> 🖨️ **Dica de impressão**: Use papel A4 comum. Configure a impressora para **100% do tamanho** (sem ajustar à página) para que as carteirinhas saiam no tamanho correto de corte.

---

## 📂 Estrutura do projeto

```
picasso/
├── main.js                       # Ponto de entrada do Electron (app desktop)
├── server.js                     # Servidor web local (Express)
├── package.json                  # Dependências e scripts do projeto
├── .env.example                  # Modelo de configuração (copie para .env)
├── .gitignore                    # Arquivos ignorados pelo Git
│
├── public/                       # Interface do usuário (front-end)
│   ├── index.html                # Página principal
│   ├── css/
│   │   └── styles.css            # Estilos visuais
│   └── js/
│       └── app.js                # Lógica da interface
│
├── src/                          # Código-fonte principal
│   ├── preload.js                # Ponte segura entre Electron e interface
│   ├── api/
│   │   └── routes.js             # Endpoints da API (busca, geração, etc.)
│   ├── db/
│   │   ├── schema.sql            # Estrutura do banco de dados
│   │   └── database.js           # Operações do banco (buscar, salvar, etc.)
│   ├── scraper/                  # Módulo de coleta de dados (Fase 2)
│   │   ├── sessionManager.js     # Gerenciamento de sessão/login
│   │   ├── scraper.js            # Orquestrador da coleta
│   │   ├── studentListParser.js  # Extração da lista de alunos
│   │   └── photoFetcher.js       # Download das fotos
│   └── generator/                # Geração de carteirinhas (Fase 3)
│       ├── cardTemplate.html     # Template visual da carteirinha
│       ├── a4Layout.html         # Layout da página A4
│       └── pdfGenerator.js       # Conversão HTML → PDF
│
├── data/                         # Dados locais (NÃO versionado)
│   ├── fotos/                    # Fotos dos alunos
│   └── gerados/                  # PDFs gerados
│
├── assets/                       # Recursos estáticos (logo, ícones)
│
└── docs/                         # Documentação
    ├── ADR.md                    # Decisões arquiteturais
    └── implementation_plan.md    # Plano de implementação
```

---

## 📜 Scripts disponíveis

Execute estes comandos na pasta do projeto:

| Comando | O que faz |
|---------|-----------|
| `npm install` | Instala todas as dependências do projeto |
| `npm start` | Abre a aplicação desktop normalmente |
| `npm run dev` | Abre em modo de desenvolvimento (com ferramentas de depuração) |
| `npm run server` | Inicia apenas o servidor web (sem a janela desktop) |
| `npm run build` | Gera o instalador `.exe` para distribuição (Windows) |
| `npm run build:mac` | Gera o instalador para macOS |
| `npm run build:linux` | Gera o instalador para Linux |

---

## 🔧 Resolução de problemas

### "node não é reconhecido como um comando"
O Node.js não está instalado ou não está no PATH do sistema. Reinstale o Node.js pelo [site oficial](https://nodejs.org/) e marque a opção de adicionar ao PATH durante a instalação.

### "npm install está dando erro"
- Verifique se você está na pasta correta (`cd picasso`).
- Tente apagar a pasta `node_modules` e rodar `npm install` novamente:
  ```bash
  rm -rf node_modules
  npm install
  ```
  No Windows:
  ```bash
  rmdir /s /q node_modules
  npm install
  ```

### "A coleta parou no meio"
A sessão do Conexão Educação pode ter expirado. Feche o Picasso, abra novamente e faça login outra vez antes de iniciar a coleta.

### "As carteirinhas estão saindo com tamanho errado na impressão"
Na hora de imprimir o PDF, certifique-se de que a opção **"Ajustar à página"** está **desativada** e a escala está em **100%**.

### "Não consigo acessar o Conexão Educação"
- Verifique sua conexão com a internet.
- Verifique se o site está no ar acessando diretamente pelo navegador: [conexao.educacao.rj.gov.br](https://conexao.educacao.rj.gov.br)
- O sistema pode estar em manutenção fora do horário comercial.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um **fork** do repositório.
2. Crie uma **branch** com sua alteração: `git checkout -b minha-alteracao`
3. Faça o **commit**: `git commit -m "Descrição da alteração"`
4. Envie para o seu fork: `git push origin minha-alteracao`
5. Abra um **Pull Request** no repositório original.

---

## 📄 Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

---

<p align="center">
  Feito com ❤️ para as escolas do Rio de Janeiro.
</p>
