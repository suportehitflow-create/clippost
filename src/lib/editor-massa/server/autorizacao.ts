// Login e planos do Clipost no editor em massa.
// A tela manda o token de acesso do Supabase (Authorization: Bearer); aqui validamos com o Supabase.
import { createClient } from '@supabase/supabase-js';

// Nomes sem NEXT_PUBLIC_ são lidos em tempo de execução (servidor do editor no Fly)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://alntulecjshpbrhesaoo.supabase.co';
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = SUPABASE_ANON ? createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } }) : null;

// Último token de cada usuário: o plano é lido/atualizado com a sessão dele (RLS de user_plans)
const tokens = new Map<string, string>();

function clienteDoUsuario(usuarioId: string) {
  const token = tokens.get(usuarioId);
  if (!token || !SUPABASE_ANON) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

export async function obterUsuario(req: Request): Promise<string | null> {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') || '');
  if (!m || !supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser(m[1]);
    const id = error ? null : data.user?.id ?? null;
    if (id) tokens.set(id, m[1]);
    return id;
  } catch {
    return null;
  }
}

export const naoAutenticado = () => Response.json({ erro: 'Faça login no Clipost para usar o editor.' }, { status: 401 });

// Mesmo contador e mesmas regras dos cortes (stripe_service.py): grátis = 3 por mês, Pro = ilimitado
const LIMITE_GRATIS = 3;

export async function verificarLimite(
  usuarioId: string | null,
  quantidade: number,
): Promise<{ permitido: boolean; restantes?: number; motivo?: string }> {
  const db = usuarioId ? clienteDoUsuario(usuarioId) : null;
  if (!db) return { permitido: true };
  const { data, error } = await db.from('user_plans').select('plan, clips_used_this_month').eq('user_id', usuarioId).maybeSingle();
  if (error) return { permitido: true }; // não trava o editor por falha de consulta
  if (data?.plan === 'pro') return { permitido: true };
  const restantes = Math.max(0, LIMITE_GRATIS - (data?.clips_used_this_month ?? 0));
  if (quantidade <= restantes) return { permitido: true, restantes };
  return {
    permitido: false,
    restantes,
    motivo:
      restantes === 0
        ? 'Você usou os 3 vídeos gratuitos deste mês. Faça upgrade para o Pro para processar sem limite.'
        : `O plano gratuito permite mais ${restantes} vídeo(s) este mês. Remova alguns do lote ou faça upgrade para o Pro.`,
  };
}

export async function registrarVideoProcessado(usuarioId: string | null, _nomeVideo: string): Promise<void> {
  const db = usuarioId ? clienteDoUsuario(usuarioId) : null;
  if (!db) return;
  await db.rpc('increment_clips_used', { p_user_id: usuarioId });
}
