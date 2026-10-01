"""Armazenamento dos vídeos (cortes, vídeos enviados, partes baixadas pelo navegador).

Com o Cloudflare R2 configurado, tudo de vídeo vai para lá (10 GB grátis e sem cobrança por download);
sem ele, continua no bucket "videos" do Supabase (1 GB no plano grátis — foi o que estourou).
Arquivos antigos que já estão no Supabase continuam funcionando: os links deles não mudam.

Variáveis (só no servidor, Fly):
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL (ex.: https://pub-xxxx.r2.dev)
"""
import os
from functools import lru_cache

_SUPABASE_PUBLICO = "/storage/v1/object/public/videos/"


def _env(nome: str) -> str:
    return (os.environ.get(nome) or "").strip()


def usa_r2() -> bool:
    return all(_env(n) for n in ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_URL"))


@lru_cache(maxsize=1)
def _cliente():
    import boto3
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=f"https://{_env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com",
        aws_access_key_id=_env("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=_env("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 4, "mode": "standard"}),
    )


@lru_cache(maxsize=1)
def _sb():
    # cliente do Supabase com a chave de serviço (mesmas variáveis do resto do backend)
    from supabase import create_client
    url = _env("SUPABASE_URL") or _env("NEXT_PUBLIC_SUPABASE_URL") or "https://alntulecjshpbrhesaoo.supabase.co"
    return create_client(url, _env("SUPABASE_KEY") or _env("SUPABASE_SERVICE_ROLE_KEY"))


def url_publica(chave: str) -> str:
    chave = chave.lstrip("/")
    if usa_r2():
        return f"{_env('R2_PUBLIC_URL').rstrip('/')}/{chave}"
    return _sb().storage.from_("videos").get_public_url(chave).rstrip("?")


def enviar(chave: str, dados: bytes, tipo: str = "video/mp4") -> str:
    """Guarda (substitui se já existir) e devolve o link público."""
    chave = chave.lstrip("/")
    if usa_r2():
        _cliente().put_object(Bucket=_env("R2_BUCKET"), Key=chave, Body=dados, ContentType=tipo)
    else:
        _sb().storage.from_("videos").upload(chave, dados, {"content-type": tipo, "upsert": "true"})
    return url_publica(chave)


def link_de_envio(chave: str, tipo: str | None = None, validade_s: int = 3 * 3600) -> str:
    """Link para o navegador/extensão enviar o arquivo direto (PUT), sem passar pelo servidor."""
    chave = chave.lstrip("/")
    if usa_r2():
        params = {"Bucket": _env("R2_BUCKET"), "Key": chave}
        if tipo:
            params["ContentType"] = tipo
        return _cliente().generate_presigned_url("put_object", Params=params, ExpiresIn=validade_s)
    r = _sb().storage.from_("videos").create_signed_upload_url(chave)
    return r.get("signed_url") or r.get("signedUrl") or r.get("signedURL")


def chave_de_url(url: str) -> str | None:
    """Caminho do arquivo dentro do armazenamento, se o link for nosso (R2 ou Supabase)."""
    u = (url or "").split("?")[0]
    base = _env("R2_PUBLIC_URL").rstrip("/")
    if base and u.startswith(base + "/"):
        return u[len(base) + 1:]
    if _SUPABASE_PUBLICO in u:
        return u.split(_SUPABASE_PUBLICO, 1)[1]
    return None


def eh_nosso(url: str) -> bool:
    return chave_de_url(url) is not None


def apagar(urls_ou_chaves: list[str]) -> int:
    """Apaga arquivos (aceita links ou caminhos). Cada um vai para onde ele está (R2 ou Supabase)."""
    r2, sb = [], []
    base = _env("R2_PUBLIC_URL").rstrip("/")
    for x in urls_ou_chaves:
        if not x:
            continue
        if x.startswith("http"):
            chave = chave_de_url(x)
            if not chave:
                continue
            (r2 if base and x.startswith(base) else sb).append(chave)
        else:
            (r2 if usa_r2() else sb).append(x.lstrip("/"))
    if r2 and usa_r2():
        for i in range(0, len(r2), 1000):
            _cliente().delete_objects(Bucket=_env("R2_BUCKET"), Delete={"Objects": [{"Key": k} for k in r2[i:i + 1000]]})
    if sb:
        _sb().storage.from_("videos").remove(sb)
    return len(r2) + len(sb)


def listar(prefixo: str) -> list[str]:
    """Caminhos dos arquivos que começam com o prefixo (no armazenamento atual)."""
    prefixo = prefixo.lstrip("/")
    if usa_r2():
        nomes, token = [], None
        while True:
            kw = {"Bucket": _env("R2_BUCKET"), "Prefix": prefixo}
            if token:
                kw["ContinuationToken"] = token
            r = _cliente().list_objects_v2(**kw)
            nomes += [o["Key"] for o in r.get("Contents", [])]
            if not r.get("IsTruncated"):
                return nomes
            token = r.get("NextContinuationToken")
    pasta = prefixo.rstrip("/")
    return [f"{pasta}/{e['name']}" for e in (_sb().storage.from_("videos").list(pasta) or []) if e.get("name")]


def configurar_cors(origens: list[str]) -> None:
    """Deixa o site e a extensão enviarem arquivos direto para o R2 (PUT pelo navegador)."""
    if not usa_r2():
        return
    _cliente().put_bucket_cors(Bucket=_env("R2_BUCKET"), CORSConfiguration={"CORSRules": [{
        "AllowedOrigins": origens,
        "AllowedMethods": ["GET", "PUT", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600,
    }]})
