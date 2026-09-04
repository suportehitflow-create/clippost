#!/bin/bash
# Deploy ClipPost backend to Fly.io
# Requires: flyctl installed + logged in
# Usage: bash deploy-fly.sh <ANTHROPIC_API_KEY>

set -e

ANTHROPIC_API_KEY=${1:-""}

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Usage: bash deploy-fly.sh <ANTHROPIC_API_KEY>"
  exit 1
fi

echo ">>> Criando app no Fly.io..."
flyctl apps create clippost-backend --org personal 2>/dev/null || echo "App já existe, continuando..."

echo ">>> Criando Redis via Upstash..."
flyctl ext upstash redis create --name clippost-redis --region gru 2>/dev/null || true
REDIS_URL=$(flyctl ext upstash redis status clippost-redis --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('redis_url',''))" 2>/dev/null || echo "")

echo ">>> Configurando variáveis de ambiente..."
flyctl secrets set \
  SUPABASE_URL="https://alntulecjshpbrhesaoo.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsbnR1bGVjanNocGJyaGVzYW9vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzIzNjg0MywiZXhwIjoyMTAyODEyODQzfQ.n96uoY_3gxr6-8WV-KOAA6lJ4pjRSSa3dNpmHorguOM" \
  ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  STORAGE_BUCKET="videos" \
  TEMP_DIR="/tmp/clippost" \
  --app clippost-backend

if [ -n "$REDIS_URL" ]; then
  flyctl secrets set REDIS_URL="$REDIS_URL" --app clippost-backend
fi

echo ">>> Fazendo deploy da API..."
PROCESS=app flyctl deploy --app clippost-backend --remote-only

echo ">>> Deploy concluído!"
flyctl status --app clippost-backend

API_URL=$(flyctl info --app clippost-backend --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('https://'+d.get('Hostname',''))" 2>/dev/null || echo "https://clippost-backend.fly.dev")
echo ""
echo "✓ API URL: $API_URL"
echo ""
echo "Próximo passo: adicione ao Vercel:"
echo "  vercel env add NEXT_PUBLIC_API_URL production <<< \"$API_URL\""
