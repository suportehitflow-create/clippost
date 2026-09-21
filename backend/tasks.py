"""
clipost — Worker Celery (processo completo)
1. Download (yt-dlp)
2. Upload vídeo raw → Supabase Storage
3. Extração de áudio (FFmpeg)
4. Transcrição com timestamps (faster-whisper)
5. INSERT na tabela projects
6. AI Curator → get_viral_clips()
7. FFmpeg Engine → create_vertical_clip() para cada corte
8. Upload clips → Supabase Storage
9. INSERT na tabela clips
10. Cleanup
"""
import os
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

import httpx

import yt_dlp
from celery_app import celery
from supabase import create_client, Client
from dotenv import load_dotenv

from services.ai_curator import get_viral_clips
from services.clip_check import validate_clip
from services.cut_rules import snap_to_words
from services.ffmpeg_engine import create_vertical_clip
from services.subtitle_generator import generate_ass
from services.stripe_service import check_clip_limit, increment_clips_used, get_plan_status

load_dotenv()

SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or "https://alntulecjshpbrhesaoo.supabase.co"
)
SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception:
    supabase = None


@celery.task(name="process_bulk_videos")
def process_bulk_videos(urls: list[str], user_id: str, clip_duration: str = "auto"):
    """Fila de processamento em massa — apenas usuários Pro."""
    plan = get_plan_status(user_id)
    if plan["plan"] != "pro":
        raise Exception("Processamento em massa disponível apenas no plano Pro.")
    results = []
    for url in urls:
        try:
            task = process_youtube_video.delay(url, user_id, clip_duration)
            results.append({"url": url, "task_id": task.id, "status": "queued"})
        except Exception as e:
            results.append({"url": url, "status": "error", "error": str(e)})
    return {"queued": len(results), "results": results}


RSS_NS = {"atom": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


@celery.task(name="check_channel_watches")
def check_channel_watches():
    """Canal AutoPilot: detecta vídeo novo nos canais monitorados e enfileira o corte.

    Roda no beat que já existe, lendo o RSS público do YouTube (sem chave de API).
    O baseline — definido no cadastro ou na primeira leitura que der certo — evita
    clipar o vídeo antigo que está no topo do feed.
    """
    watches = (
        supabase.table("channel_watches").select("*").eq("is_active", True).execute().data or []
    )
    novos = 0

    for w in watches:
        erro = None
        try:
            resp = httpx.get(
                "https://www.youtube.com/feeds/videos.xml",
                params={"channel_id": w["channel_id"]},
                timeout=20,
                follow_redirects=True,
            )
            resp.raise_for_status()

            raiz = ET.fromstring(resp.text)
            entradas = raiz.findall("atom:entry", RSS_NS)

            # Canal cadastrado enquanto o feed estava fora: marca o vídeo atual
            # como referência e não clipa nada neste ciclo, senão o vídeo antigo
            # do topo do feed viraria corte.
            if not w.get("baseline_video_id"):
                if entradas:
                    supabase.table("channel_watches").update({
                        "baseline_video_id": entradas[0].findtext("yt:videoId", namespaces=RSS_NS),
                        "channel_name": w.get("channel_name") or raiz.findtext(
                            "atom:title", default="", namespaces=RSS_NS),
                    }).eq("id", w["id"]).execute()
                    print(f"[autopilot] baseline definido para {w['channel_id']}")
                # Lista vazia em vez de continue: assim o laço abaixo não roda e
                # o last_checked_at no fim do bloco ainda é atualizado.
                entradas = []

            for entry in entradas[:5]:
                video_id = entry.find("yt:videoId", RSS_NS).text
                title = entry.find("atom:title", RSS_NS).text

                # O feed vem do mais novo para o mais antigo: ao alcançar o baseline,
                # tudo daí para baixo já existia quando o canal foi cadastrado.
                if video_id == w.get("baseline_video_id"):
                    break

                ja_processado = (
                    supabase.table("autopilot_processed")
                    .select("video_id")
                    .eq("user_id", w["user_id"]).eq("video_id", video_id)
                    .execute().data
                )
                if ja_processado:
                    continue

                url = f"https://www.youtube.com/watch?v={video_id}"
                projeto = supabase.table("projects").insert({
                    "user_id": w["user_id"],
                    "title": title,
                    "source_type": "url",
                    "source_url": url,
                    "platform": "youtube",
                    "status": "pending",
                }).execute().data[0]

                # Registra antes de enfileirar: se o worker caísse entre as duas
                # etapas, o mesmo vídeo voltaria a virar projeto no ciclo seguinte.
                supabase.table("autopilot_processed").insert({
                    "user_id": w["user_id"],
                    "video_id": video_id,
                    "watch_id": w["id"],
                    "project_id": projeto["id"],
                }).execute()

                process_youtube_video.delay(
                    url, w["user_id"], w.get("clip_duration", "auto"), projeto["id"]
                )
                novos += 1
                print(f"[autopilot] {w.get('channel_name') or w['channel_id']}: {title}")

        except Exception as e:
            erro = str(e)[:500]
            print(f"[autopilot] erro no canal {w['channel_id']}: {erro}")

        supabase.table("channel_watches").update({
            "last_checked_at": datetime.now(timezone.utc).isoformat(),
            "last_error": erro,
        }).eq("id", w["id"]).execute()

    return {"canais": len(watches), "novos": novos}



def parse_vtt_subtitles(vtt_path: Path):
    """Lê legendas nativas do YouTube (.vtt) e extrai segments e words."""
    segments = []
    words = []
    import re
    time_pattern = re.compile(r"(\d{2}):(\d{2}):(\d{2})[\.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[\.,](\d{3})")
    
    current_start = None
    current_end = None
    current_text = []

    try:
        with open(vtt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        for line in lines:
            line = line.strip()
            m = time_pattern.search(line)
            if m:
                if current_start is not None and current_text:
                    full_text = " ".join(current_text)
                    segments.append({"start": current_start, "end": current_end, "text": full_text})
                    text_words = full_text.split()
                    if text_words:
                        dur_per_word = (current_end - current_start) / len(text_words)
                        for i, w in enumerate(text_words):
                            words.append({
                                "start": round(current_start + i * dur_per_word, 2),
                                "end": round(current_start + (i + 1) * dur_per_word, 2),
                                "word": w
                            })
                    current_text = []
                
                h1, m1, s1, ms1, h2, m2, s2, ms2 = map(int, m.groups())
                current_start = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000.0
                current_end = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000.0
            elif current_start is not None and line and not line.startswith("WEBVTT") and not line.isdigit():
                clean = re.sub(r"<[^>]+>", "", line).strip()
                if clean and clean not in current_text:
                    current_text.append(clean)

        if current_start is not None and current_text:
            full_text = " ".join(current_text)
            segments.append({"start": current_start, "end": current_end, "text": full_text})
            text_words = full_text.split()
            if text_words:
                dur_per_word = (current_end - current_start) / len(text_words)
                for i, w in enumerate(text_words):
                    words.append({
                        "start": round(current_start + i * dur_per_word, 2),
                        "end": round(current_start + (i + 1) * dur_per_word, 2),
                        "word": w
                    })
    except Exception as e:
        print(f"Erro ao analisar VTT: {e}")

    return {"segments": segments, "words": words}

@celery.task(name="process_youtube_video")
def process_youtube_video(url: str, user_id: str, clip_duration: str = "auto", project_id: str | None = None, remove_silence: bool = True, template_config: dict | None = None):
    print(f"[pipeline] INICIANDO processamento | projeto={project_id} | url={url[:80]}")
    if project_id:
        try:
            supabase.table("projects").update({"status": "processing"}).eq("id", project_id).execute()
        except Exception as e:
            print(f"[tasks] erro ao atualizar status inicial do projeto: {e}")

    tmp_dir = None

    try:
        check_clip_limit(user_id)  # levanta Exception se limite gratuito atingido
        tmp_dir = Path(tempfile.mkdtemp(prefix="clippost_"))
        video_path = str(tmp_dir / "original.mp4")
        audio_path = str(tmp_dir / "audio.mp3")

        _ydl_base = {
            'format': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best',
            'outtmpl': str(tmp_dir / "original.%(ext)s"),
            'noprogress': True,
            'noplaylist': True,
            'merge_output_format': 'mp4',
            'socket_timeout': 30,
            'retries': 3,
            'fragment_retries': 3,
            'extractor_retries': 3,
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            },
            'extractor_args': {
                'youtube': {
                    'player_client': ['ios', 'tv_embedded', 'mweb'],
                    'player_skip': ['configs'],
                },
            },
        }

        # Fase 1: baixa só o vídeo (sem legendas para evitar 429 nas subs)
        ydl_opts_video = {**_ydl_base}

        # Fase 2: busca legendas separadamente, silenciosamente (best-effort)
        ydl_opts_subs = {
            **_ydl_base,
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitlesformat': 'vtt',
            'subtitleslangs': ['pt', 'pt-BR', 'en'],
            'ignoreerrors': True,
        }

        # 1. Download do vídeo (sem legendas — evita 429 fatal nas subs)
        print(f"[pipeline] baixando vídeo: {url[:80]}")
        with yt_dlp.YoutubeDL(ydl_opts_video) as ydl:
            info = ydl.extract_info(url, download=True)
            if not info:
                raise Exception("yt-dlp não retornou informações — URL inválida ou vídeo indisponível")
            video_id = info.get('id', 'video')
            title = info.get('title', 'Sem título')
            video_duration = info.get('duration')

        # Verifica se o arquivo foi realmente baixado
        mp4_check = list(tmp_dir.glob("*.mp4")) + list(tmp_dir.glob("*.mkv")) + list(tmp_dir.glob("*.webm"))
        if not mp4_check:
            raise Exception(f"yt-dlp não gerou arquivo de vídeo para '{title}'")

        # Rejeita vídeos muito longos (evita Whisper demorar horas)
        MAX_DURATION_SECS = 30 * 60  # 30 minutos
        if video_duration and video_duration > MAX_DURATION_SECS:
            raise Exception(
                f"DurationError: vídeo longo demais ({int(video_duration // 60)} min). "
                "Limite máximo: 30 minutos por vídeo."
            )
        print(f"[pipeline] vídeo baixado OK — duração: {int((video_duration or 0) // 60)}min {int((video_duration or 0) % 60)}s")

        # 1b. Tenta buscar legendas separadamente (falha silenciosa → Whisper)
        print(f"[pipeline] buscando legendas nativas (best-effort)...")
        try:
            with yt_dlp.YoutubeDL(ydl_opts_subs) as ydl:
                ydl.extract_info(url, download=True)
        except Exception as sub_err:
            print(f"[pipeline] legendas nativas indisponíveis ({sub_err}), usando Whisper")

        # Localiza o arquivo de vídeo final mesclado (pode ser .mkv ou .webm se merge falhou)
        mp4_candidates = list(tmp_dir.glob("original*.mp4")) or list(tmp_dir.glob("*.mp4")) or list(tmp_dir.glob("*.mkv")) or list(tmp_dir.glob("*.webm"))
        if mp4_candidates:
            video_path = str(mp4_candidates[0])

        # 2. Upload vídeo raw para Supabase Storage (best-effort, não bloqueia pipeline)
        storage_path = f"{user_id}/{video_id}.mp4"
        raw_video_url = None
        try:
            with open(video_path, 'rb') as f:
                supabase.storage.from_("videos").upload(
                    path=storage_path,
                    file=f.read(),
                    file_options={"content-type": "video/mp4", "upsert": "true"},
                )
            raw_video_url = supabase.storage.from_("videos").get_public_url(storage_path)
        except Exception as upload_err:
            print(f"[pipeline] upload vídeo raw falhou (não crítico): {upload_err}")

        # 3. Transcrição: Procura legendas nativas do YouTube (.vtt) para Modo Turbo (~15s)
        vtt_candidates = list(tmp_dir.glob("*.vtt"))
        transcript_data = None
        if vtt_candidates:
            try:
                transcript_data = parse_vtt_subtitles(vtt_candidates[0])
                print(f"[tasks] Modo Turbo ativo: {len(transcript_data.get('segments', []))} falas nativas extraídas")
            except Exception as e:
                print(f"[tasks] falha ao ler legenda nativa .vtt: {e}")

        if not transcript_data or not transcript_data.get("segments"):
            # Fallback: extração de áudio + Whisper tiny (3x mais rápido que base)
            print(f"[pipeline] sem legendas nativas — extraindo áudio para Whisper...")
            subprocess.run([
                "ffmpeg", "-y", "-i", video_path,
                "-vn", "-ar", "16000", "-ac", "1", "-b:a", "128k", "-f", "mp3",
                audio_path,
            ], check=True, capture_output=True, timeout=300)  # 5 min max

            from faster_whisper import WhisperModel
            print(f"[pipeline] iniciando transcrição Whisper tiny...")
            model = WhisperModel("tiny", device="cpu", compute_type="int8")
            fw_segments_gen, _ = model.transcribe(audio_path, word_timestamps=True, beam_size=1)
            fw_segments = list(fw_segments_gen)  # força avaliação completa agora
            print(f"[pipeline] Whisper concluído — {len(fw_segments)} segmentos transcritos")

            segments = []
            words = []
            for seg in fw_segments:
                segments.append({"start": seg.start, "end": seg.end, "text": seg.text})
                if seg.words:
                    for w in seg.words:
                        words.append({"start": w.start, "end": w.end, "word": w.word})
            transcript_data = {"segments": segments, "words": words}

        chapters = info.get("chapters") or []
        transcript_data["chapters"] = chapters
        segments = transcript_data.get("segments", [])
        words = transcript_data.get("words", [])

        # 5. Projeto: atualiza o que a tela de upload já criou ou cria um novo.
        # Criar sempre um novo deixava o projeto aberto pelo usuário em "pending" para sempre.
        project_data = {
            "source_url": url,
            "platform": "youtube",
            "raw_video_url": raw_video_url,
            "transcript": transcript_data,
            "title": title,
            "status": "processing",
        }
        if project_id:
            supabase.table("projects").update(project_data).eq("id", project_id).execute()
        else:
            project_data.update({"user_id": user_id, "source_type": "url"})
            db_response = supabase.table("projects").insert(project_data).execute()
            project_id = db_response.data[0]['id']

        # 6. AI Curator — detectar momentos virais
        print(f"[pipeline] transcrição: {len(segments)} segmentos — enviando para IA Curator...")
        clips_meta = get_viral_clips(transcript_data, clip_duration=clip_duration, chapters=chapters)
        print(f"[pipeline] IA Curator retornou {len(clips_meta)} clipes candidatos")

                # Brand Kit e Template Ativo do Usuário (100% integrado)
        bk_resp = supabase.table("brand_kits").select("*").eq("user_id", user_id).maybe_single().execute()
        brand_kit = bk_resp.data if bk_resp and bk_resp.data else {}
        if template_config:
            existing_cfg = brand_kit.get("layout_config") or {}
            brand_kit["layout_config"] = {**existing_cfg, **template_config}
            if template_config.get("brandName"):
                brand_kit["username"] = template_config.get("brandHandle") or brand_kit.get("username")

        # 7, 8, 9. Cortar + upload + salvar cada clipe
        for i, clip in enumerate(clips_meta):
            clip_out = str(tmp_dir / f"clip_{i}.mp4")
            start, end = snap_to_words(clip["start_time"], clip["end_time"], words)
            # A IA às vezes devolve fim além do vídeo (53s num vídeo de 19s).
            if video_duration:
                end = min(end, float(video_duration))
            if end - start < 1:
                continue
            sub_y = ((brand_kit or {}).get("layout_config") or {}).get("subtitlePos", {}).get("y", 78)
            margin_v = max(80, min(1200, int(1920 * (1.0 - (float(sub_y) / 100.0))) - 40))
            sub_preset = ((brand_kit or {}).get("layout_config") or {}).get("subtitle_preset") or "hormozi_yellow"
            subtitle_file = generate_ass(
                segments, str(tmp_dir / f"subtitles_{i}.ass"),
                clip_start=start, clip_end=end, words=words,
                margin_v=margin_v,
                subtitle_preset=sub_preset,
            )
            try:
                create_vertical_clip(
                    input_video=video_path,
                    output_video=clip_out,
                    start=start,
                    end=end,
                    brand_kit=brand_kit,
                    subtitle_file=subtitle_file,
                    hook_title=clip["hook_title"],
                    remove_silence=remove_silence,
                )
            except Exception as e:
                print(f"[ffmpeg] erro no clipe {i}: {e}")
                continue

            if not os.path.exists(clip_out):
                continue

            # O FFmpeg pode sair com código 0 e deixar arquivo sem áudio ou com
            # duração errada; sem conferir, o clipe quebrado ia para o Storage.
            check = validate_clip(clip_out, expected_duration=end - start)
            if not check["ok"]:
                print(f"[clip {i}] descartado: {'; '.join(check['issues'])}")
                continue

            clip_key = f"{user_id}/{project_id}/clip_{i}.mp4"
            with open(clip_out, "rb") as f:
                supabase.storage.from_("videos").upload(
                    path=clip_key,
                    file=f.read(),
                    file_options={"content-type": "video/mp4", "upsert": "true"},
                )
            clip_url = supabase.storage.from_("videos").get_public_url(clip_key)

            supabase.table("clips").insert({
                "project_id": project_id,
                "user_id": user_id,
                "title": clip["hook_title"],
                "hook": clip["hook_title"],
                "start_time": start,
                "end_time": end,
                "score": clip["ai_score"],
                "storage_url": clip_url,
                "status": "ready",
            }).execute()

        # Atualizar status final
        supabase.table("projects").update({"status": "done"}).eq("id", project_id).execute()
        try:
            increment_clips_used(user_id)
        except Exception as inc_err:
            print(f"[pipeline] increment_clips_used falhou (não crítico): {inc_err}")

        # Auto-publish: se o perfil tiver auto_publish ativado, agenda os clipes no perfil ativo
        try:
            profile_res = supabase.table("profiles").select("auto_publish, active_social_account_id").eq("id", user_id).maybe_single().execute()
            if profile_res and profile_res.data and profile_res.data.get("auto_publish"):
                active_acc_id = profile_res.data.get("active_social_account_id")
                acc_res = None
                if active_acc_id:
                    acc_res = supabase.table("social_accounts").select("id, platform").eq("id", active_acc_id).maybe_single().execute()
                if not acc_res or not acc_res.data:
                    acc_res = supabase.table("social_accounts").select("id, platform").eq("user_id", user_id).eq("is_active", True).maybe_single().execute()
                if acc_res and acc_res.data:
                    clips_res = supabase.table("clips").select("id, title").eq("project_id", project_id).eq("status", "ready").execute()
                    for c in (clips_res.data or []):
                        supabase.table("scheduled_posts").insert({
                            "user_id": user_id,
                            "clip_id": c["id"],
                            "platform": acc_res.data["platform"],
                            "social_account_id": acc_res.data["id"],
                            "caption": c.get("title") or "",
                            "scheduled_at": datetime.now(timezone.utc).isoformat(),
                            "status": "scheduled",
                        }).execute()
                    print(f"[auto-publish] {len(clips_res.data or [])} clipes agendados")
        except Exception as auto_err:
            print(f"[auto-publish] erro (nao critico): {auto_err}")

        return {"status": "success", "project_id": project_id, "title": title}

    except Exception as e:
        import traceback
        print(f"[pipeline] ERRO ao processar {url}: {type(e).__name__}: {e}")
        traceback.print_exc()
        if project_id:
            try:
                msg = str(e)[:900]
                # Evita duplicar o tipo quando a mensagem já começa com ele (ex: "DurationError: ...")
                err_type = type(e).__name__
                error_message = msg if (msg.startswith(err_type) or err_type == "Exception") else f"{err_type}: {msg}"
                supabase.table("projects").update({
                    "status": "failed",
                    "error_message": error_message,
                }).eq("id", project_id).execute()
                print(f"[pipeline] projeto {project_id} marcado como falho")
            except Exception as update_err:
                print(f"[pipeline] não consegui marcar o projeto {project_id} como falho: {update_err}")
        return {"status": "error", "message": str(e)}

    finally:
        if tmp_dir:
            shutil.rmtree(tmp_dir, ignore_errors=True)
