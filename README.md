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

> 💡 **Dica**: Ao instalar o Node.js, escolha a versão **LTS** (Long Term Support). Ela já inclui o **npm** (gerenciador de pacotes) que será usado automaticamente.

---

## 📦 Instalação

### Para diretores e usuários (caminho simples)

Se você não é programador, siga estes passos — ou peça ao técnico de informática da escola:

#### 1. Baixar o projeto

Peça para o técnico clonar o repositório ou [baixe o ZIP aqui](https://github.com/normaii/picasso/archive/refs/heads/master.zip) e descompacte em uma pasta.

#### 2. Rodar o instalador

Dentro da pasta do projeto, abra a pasta **`scripts`** e dê **duplo clique** no arquivo:

```
📁 scripts/
   └── 🔧 instalar.bat
```

O instalador faz tudo automaticamente:
- ✅ Verifica se o Node.js está instalado
- ✅ Instala as dependências do projeto
- ✅ Instala o navegador para coleta de dados
- ✅ Cria o arquivo de configuração
- ✅ **Cria um atalho "Picasso" no Desktop**

> ⏳ Na primeira vez pode demorar alguns minutos. Aguarde até ver a mensagem **"Instalação concluída com sucesso!"**.

#### 3. Pronto! É só usar

Depois da instalação, um atalho **"Picasso"** aparece no seu Desktop. Para usar a aplicação, é só **dar duplo clique** nesse atalho — como qualquer outro programa.

```
🖥️ Desktop/
   └── 🎨 Picasso        ← clique aqui para abrir!
```

> 💡 Você **não precisa abrir terminal, digitar comandos nem saber programar**. Basta clicar no atalho e a aplicação abre sozinha.

---

### Para desenvolvedores (caminho técnico)

#### 1. Clonar e instalar

```bash
git clone https://github.com/normaii/picasso.git
cd picasso
npm install
npx playwright install chromium
```

#### 2. Configurar o ambiente

```bash
copy .env.example .env
```

Edite o `.env` conforme necessário:

```ini
# Pasta de dados (pode apontar para o Google Drive)
DATA_DIR=./data

# URL do sistema (não altere)
SYSTEM_URL=https://conexao.educacao.rj.gov.br

# Porta do servidor local
PORT=3000
```

> ⚠️ **Importante**: O arquivo `.env` contém configurações locais e **nunca** deve ser compartilhado. Ele já está protegido pelo `.gitignore`.

#### Usando com Google Drive (opcional)

Para backup automático de fotos e PDFs na nuvem, altere o `DATA_DIR`:

```ini
DATA_DIR=C:\Users\SeuNome\Google Drive\Picasso
```

---

## 🚀 Como executar

### Para diretores (uso no dia a dia)

Dê **duplo clique** no atalho **"Picasso"** no Desktop. Pronto!

> Se o atalho não existir, rode o instalador novamente (`scripts/instalar.bat`) ou dê duplo clique diretamente no arquivo `picasso.bat` na pasta do projeto.

### Para desenvolvedores

| Comando | O que faz |
|---------|-----------|
| `npm start` | Abre a aplicação desktop normalmente |
| `npm run dev` | Abre com DevTools visível (depuração) |
| `npm run server` | Inicia apenas o servidor web em [localhost:3000](http://localhost:3000) |

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
├── picasso.bat                   # 🎨 Lançador (duplo clique para abrir!)
├── main.js                       # Ponto de entrada do Electron (app desktop)
├── server.js                     # Servidor web local (Express)
├── package.json                  # Dependências e scripts do projeto
├── .env.example                  # Modelo de configuração (copie para .env)
├── .gitignore                    # Arquivos ignorados pelo Git
│
├── scripts/                      # Scripts auxiliares
│   └── instalar.bat              # Instalador automático (cria atalho no Desktop)
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

## 📜 Scripts e comandos

### Para diretores (sem terminal)

| Arquivo | O que faz |
|---------|-----------|
| `scripts/instalar.bat` | Instalação completa + cria atalho no Desktop (rodar **uma vez**) |
| `picasso.bat` | Abre o Picasso (é o que o atalho do Desktop executa) |

### Para desenvolvedores (via terminal)

| Comando | O que faz |
|---------|-----------|
| `npm install` | Instala todas as dependências do projeto |
| `npm start` | Abre a aplicação desktop normalmente |
| `npm run dev` | Abre em modo desenvolvimento (com DevTools) |
| `npm run server` | Inicia apenas o servidor web (sem janela desktop) |
| `npm run build` | Gera o instalador `.exe` para distribuição (Windows) |

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
