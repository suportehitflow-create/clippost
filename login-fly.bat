@echo off
title Login Fly.io - Clippost
echo ========================================================
echo  Abrindo o login do Fly.io no seu navegador...
echo  Basta clicar em autorizar na pagina que vai abrir!
echo ========================================================
"%USERPROFILE%\.fly\bin\flyctl.exe" auth login
echo.
echo Login concluido com sucesso! Pode fechar esta janela.
pause
