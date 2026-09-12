@echo off
chcp 65001 >nul 2>&1
title Picasso — Instalador

:: ============================================================
:: Picasso — Script de Instalação
:: ============================================================
:: Executa a instalação completa do Picasso:
::   1. Verifica pré-requisitos (Node.js, Git)
::   2. Instala dependências (npm install)
::   3. Instala o navegador para coleta (Playwright)
::   4. Cria o arquivo de configuração (.env)
::   5. Cria um atalho no Desktop
::
:: Este script deve ser executado apenas UMA VEZ,
:: de preferência por alguém com conhecimento técnico.
:: ============================================================

cd /d "%~dp0\.."

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                                                      ║
echo  ║    PICASSO — Instalador de Carteirinhas Escolares    ║
echo  ║                                                      ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

:: ----- Etapa 1: Verificar Node.js -----
echo  [1/5] Verificando Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERRO: Node.js nao encontrado!
    echo  Baixe e instale em: https://nodejs.org
    echo  Escolha a versao LTS e reinicie este instalador.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo         Node.js %NODE_VERSION% encontrado.

:: ----- Etapa 2: Instalar dependências -----
echo.
echo  [2/5] Instalando dependencias do projeto...
echo         Isso pode demorar alguns minutos na primeira vez.
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ERRO: Falha ao instalar dependencias.
    echo  Verifique sua conexao com a internet.
    pause
    exit /b 1
)
echo.
echo         Dependencias instaladas com sucesso!

:: ----- Etapa 3: Instalar Playwright -----
echo.
echo  [3/5] Instalando navegador para coleta de dados...
call npx playwright install chromium
if %ERRORLEVEL% NEQ 0 (
    echo  AVISO: Nao foi possivel instalar o Playwright agora.
    echo         Tente novamente mais tarde com: npx playwright install chromium
) else (
    echo         Navegador instalado com sucesso!
)

:: ----- Etapa 4: Criar arquivo .env -----
echo.
echo  [4/5] Configurando arquivo de ambiente...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo         Arquivo .env criado a partir do modelo.
    echo         Edite o arquivo .env para configurar a pasta do Google Drive.
) else (
    echo         Arquivo .env ja existe. Mantendo configuracao atual.
)

:: ----- Etapa 5: Criar atalho no Desktop -----
echo.
echo  [5/5] Criando atalho no Desktop...

:: Usa PowerShell para criar um atalho .lnk no Desktop
set "PROJETO_DIR=%cd%"
set "BAT_PATH=%cd%\picasso.bat"
set "DESKTOP=%USERPROFILE%\Desktop"
set "ATALHO=%DESKTOP%\Picasso.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; ^
   $s = $ws.CreateShortcut('%ATALHO%'); ^
   $s.TargetPath = '%BAT_PATH%'; ^
   $s.WorkingDirectory = '%PROJETO_DIR%'; ^
   $s.Description = 'Picasso - Gerador de Carteirinhas Escolares'; ^
   $s.WindowStyle = 7; ^
   $s.Save()"

if exist "%ATALHO%" (
    echo         Atalho "Picasso" criado no Desktop!
) else (
    echo  AVISO: Nao foi possivel criar o atalho automaticamente.
    echo         Voce pode criar manualmente um atalho para: %BAT_PATH%
)

:: ----- Concluído -----
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║                                                      ║
echo  ║    Instalacao concluida com sucesso!                 ║
echo  ║                                                      ║
echo  ║    Para abrir o Picasso, use o atalho "Picasso"      ║
echo  ║    que foi criado no seu Desktop.                    ║
echo  ║                                                      ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
pause
