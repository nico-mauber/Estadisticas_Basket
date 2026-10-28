@echo off
echo Iniciando Smart-Basket Basketball Analytics...
cd /d "%~dp0backend"
set SB_WARMUP=1
python app.py
