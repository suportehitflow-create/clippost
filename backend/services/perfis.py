"""Perfis (marcas): cada perfil é um grupo de redes no Upload-Post (Instagram, Facebook, TikTok,
YouTube...) com o SEU template. Ex.: "Música tal" posta no Insta, no Facebook e no TikTok com um
template; outro perfil = outras redes e outro template.

- O perfil "principal" é o grupo que já existia (usuário do Upload-Post = user_id).
- Os outros usam o usuário "<user_id>-<id>" no Upload-Post.
- Nas contas sincronizadas (social_accounts), o account_id dos outros perfis vem como "<id>::<conta>".
- O template ativo fica no brand kit (é o que o Criar cortes e o Editor usam); ao trocar de perfil,
  o template do perfil anterior é guardado aqui e o do novo vai para o brand kit.
"""
import re
import secrets

from services.user_settings import get_settings, save_settings

PRINCIPAL = "principal"
SEPARADOR = "::"


def listar(user_id: str) -> tuple[list[dict], str]:
    s = get_settings(user_id)
    perfis = list(s.get("perfis") or [])
    if not any(p.get("id") == PRINCIPAL for p in perfis):
        perfis.insert(0, {"id": PRINCIPAL, "nome": "Perfil principal"})
    ativo = s.get("perfil_ativo") or PRINCIPAL
    if not any(p.get("id") == ativo for p in perfis):
        ativo = PRINCIPAL
    return perfis, ativo


def usuario_upload_post(user_id: str, perfil_id: str | None) -> str:
    if not perfil_id or perfil_id == PRINCIPAL:
        return user_id
    return f"{user_id}-{perfil_id}"


def perfil_da_conta(account_id: str | None) -> str:
    a = str(account_id or "")
    return a.split(SEPARADOR, 1)[0] if SEPARADOR in a else PRINCIPAL


def criar(user_id: str, nome: str) -> dict:
    perfis, ativo = listar(user_id)
    novo = {"id": secrets.token_hex(3), "nome": re.sub(r"\s+", " ", nome).strip()[:40] or "Novo perfil"}
    perfis.append(novo)
    save_settings(user_id, perfis=perfis, perfil_ativo=ativo)
    return novo


def renomear(user_id: str, perfil_id: str, nome: str) -> None:
    perfis, ativo = listar(user_id)
    for p in perfis:
        if p["id"] == perfil_id:
            p["nome"] = re.sub(r"\s+", " ", nome).strip()[:40] or p["nome"]
    save_settings(user_id, perfis=perfis, perfil_ativo=ativo)


def ativar(user_id: str, perfil_id: str, supabase) -> dict:
    """Guarda o template atual no perfil que estava ativo e coloca o template do novo no brand kit.
    Perfil que ainda não tem template começa com uma cópia do atual (a pessoa ajusta depois)."""
    perfis, ativo = listar(user_id)
    if not any(p["id"] == perfil_id for p in perfis):
        raise ValueError("Perfil não encontrado.")
    if perfil_id == ativo:
        return {"ativo": ativo}
    res = supabase.table("brand_kits").select("layout_config, avatar_url, username").eq("user_id", user_id).limit(1).execute()
    atual = (res.data or [None])[0]
    alvo = next(p for p in perfis if p["id"] == perfil_id)
    for p in perfis:
        if p["id"] == ativo and atual:
            p["template"] = {k: atual.get(k) for k in ("layout_config", "avatar_url", "username")}
    tpl = alvo.get("template")
    if tpl and atual is not None:
        supabase.table("brand_kits").update({k: v for k, v in tpl.items() if v is not None}).eq("user_id", user_id).execute()
    save_settings(user_id, perfis=perfis, perfil_ativo=perfil_id)
    return {"ativo": perfil_id}
