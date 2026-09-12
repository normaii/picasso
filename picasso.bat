@echo off
chcp 65001 >nul 2>&1
title Picasso — Carteirinhas Escolares

:: ============================================================
:: Picasso — Lançador da Aplicação
:: ============================================================
:: Este arquivo inicia o Picasso automaticamente.
:: O diretor pode criar um atalho para este arquivo no Desktop.
:: ============================================================

:: Vai para a pasta onde este .bat está (pasta do projeto)
cd /d "%~dp0"

:: Verifica se o Node.js está instalado
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ╔══════════════════════════════════════════════════════╗
    echo  ║  ERRO: Node.js nao esta instalado!                  ║
    echo  ║                                                      ║
    echo  ║  Baixe e instale em: https://nodejs.org              ║
    echo  ║  Escolha a versao LTS.                               ║
    echo  ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

:: Se node_modules não existe, instala as dependências automaticamente
if not exist "node_modules\" (
    echo.
    echo  ┌──────────────────────────────────────────────────────┐
    echo  │  Primeira execucao detectada!                        │
    echo  │  Instalando dependencias... aguarde alguns minutos.  │
    echo  └──────────────────────────────────────────────────────┘
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  ERRO: Falha ao instalar dependencias.
        echo  Verifique sua conexao com a internet e tente novamente.
        pause
        exit /b 1
    )
    echo.
    echo  Dependencias instaladas com sucesso!
    echo.
)

:: Inicia o Picasso
echo.
echo  ┌──────────────────────────────────────────────────────┐
echo  │  Iniciando o Picasso...                              │
echo  │  A janela da aplicacao abrira em instantes.          │
echo  │                                                      │
echo  │  NAO FECHE esta janela enquanto estiver usando.      │
echo  └──────────────────────────────────────────────────────┘
echo.

:: Usa "start /min" para minimizar o terminal e roda o Electron
start /min "" cmd /c "cd /d "%~dp0" && npx electron ."

:: Aguarda 5 segundos e fecha esta janela
timeout /t 5 /nobreak >nul
exit
