@echo off
rem Starter kontrollsenteret og åpner Chrome eller Edge (Web Serial krever en av dem).
cd /d "%~dp0"
python serve.py
