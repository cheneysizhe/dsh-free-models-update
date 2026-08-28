@echo off
chcp 65001 >nul
title DSH OpenRouter 免费模型插件 - 卸载
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
