#!/bin/bash
# Executa a bateria de testes no servidor Fly.io via SSH
# Uso local: flyctl ssh console -a clippost-backend -C "bash /app/tests/run_tests_fly.sh"

set -e
cd /app

echo "===== Instalando pytest e pytest-mock ====="
pip install pytest pytest-mock --quiet

echo "===== Rodando bateria de testes ====="
python -m pytest tests/test_pipeline.py -v --tb=short --no-header 2>&1

echo "===== Fim dos testes ====="
