"""
Camada estática do template (PNG transparente) sobreposta ao vídeo pelo FFmpeg.

Reproduz o preview do editor (src/app/(dashboard)/templates/page.tsx): o celular do
editor tem 324px de largura, então todo tamanho em px do editor é multiplicado por
canvas_w / 324 e as posições em % são aplicadas direto no canvas 9:16.
"""
import base64
import glob
import io
import re
from functools import lru_cache

import httpx
from PIL import Image, ImageDraw, ImageFont

EDITOR_PHONE_W = 324.0

_EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U00002B00-\U00002BFF\U0000FE0F\U0000200D]"
)

_FONT_PATTERNS = {
    "anton": ["Anton-Regular.ttf"],
    "montserrat_black": ["Montserrat-Black.otf", "Montserrat-Black.ttf", "Montserrat-ExtraBold.otf", "Montserrat-ExtraBold.ttf"],
    "sans_black": ["Roboto-Black.ttf", "Roboto-Bold.ttf"],
    "sans_bold": ["Roboto-Bold.ttf"],
    "sans_medium": ["Roboto-Medium.ttf", "Roboto-Regular.ttf"],
}
_FONT_FALLBACK = {
    "anton": "DejaVuSans-Bold.ttf",
    "montserrat_black": "DejaVuSans-Bold.ttf",
    "sans_black": "DejaVuSans-Bold.ttf",
    "sans_bold": "DejaVuSans-Bold.ttf",
    "sans_medium": "DejaVuSans.ttf",
}


@lru_cache(maxsize=None)
def _font_path(kind: str) -> str | None:
    for name in _FONT_PATTERNS.get(kind, []) + [_FONT_FALLBACK.get(kind, "DejaVuSans-Bold.ttf")]:
        for root in ("/usr/share/fonts", "/usr/local/share/fonts"):
            hits = glob.glob(f"{root}/**/{name}", recursive=True)
            if hits:
                return hits[0]
    return None


def _font(kind: str, size: float) -> ImageFont.ImageFont:
    path = _font_path(kind)
    size = max(8, int(round(size)))
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _title_font_kind(font_family: str) -> str:
    fam = (font_family or "").lower()
    if "anton" in fam or "impact" in fam:
        return "anton"
    if "montserrat" in fam:
        return "montserrat_black"
    return "sans_black"


def _hex(color: str | None, default=(255, 255, 255)) -> tuple[int, int, int]:
    if not color or not isinstance(color, str):
        return default
    c = color.strip().lstrip("#")
    if len(c) == 3:
        c = "".join(ch * 2 for ch in c)
    try:
        return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]
    except ValueError:
        return default


def _pos(layout: dict, key: str, default: tuple[float, float]) -> tuple[float, float]:
    p = layout.get(key) or {}
    try:
        return float(p.get("x", default[0])), float(p.get("y", default[1]))
    except (TypeError, ValueError, AttributeError):
        return default


def _load_image(url: str | None) -> Image.Image | None:
    if not url:
        return None
    try:
        if url.startswith("data:image/") and ";base64," in url and "svg" not in url[:20]:
            return Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA")
        if url.startswith("http"):
            resp = httpx.get(url, timeout=8.0, follow_redirects=True)
            resp.raise_for_status()
            return Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception as e:
        print(f"[template_overlay] imagem ignorada ({url[:60]}): {e}")
    return None


def _default_avatar(d: int) -> Image.Image:
    c1 = Image.new("RGBA", (d, d), (99, 102, 241, 255))
    c2 = Image.new("RGBA", (d, d), (236, 72, 153, 255))
    grad = Image.linear_gradient("L").rotate(45, expand=True).resize((d, d))
    img = Image.composite(c2, c1, grad)
    dr = ImageDraw.Draw(img)
    u = d / 120.0
    dr.ellipse([45 * u, 34 * u, 75 * u, 64 * u], fill=(255, 255, 255, 242))
    dr.chord([40 * u, 68 * u, 80 * u, 108 * u], 180, 360, fill=(255, 255, 255, 242))
    return img


def _circle(img: Image.Image, d: int) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    img = img.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)).resize((d, d), Image.LANCZOS)
    mask = Image.new("L", (d * 4, d * 4), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, d * 4 - 1, d * 4 - 1], fill=255)
    out = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask.resize((d, d), Image.LANCZOS))
    return out


def _badge(size: int) -> Image.Image:
    big = size * 4
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    dr = ImageDraw.Draw(img)
    dr.ellipse([0, 0, big - 1, big - 1], fill=(59, 130, 246, 255))
    u = big / 24.0
    dr.line([(7 * u, 12.3 * u), (10.3 * u, 15.6 * u), (17 * u, 8.6 * u)], fill=(255, 255, 255, 255), width=max(2, int(2.4 * u)), joint="curve")
    return img.resize((size, size), Image.LANCZOS)


def _fit(draw: ImageDraw.ImageDraw, text: str, font, max_w: float) -> str:
    if draw.textlength(text, font=font) <= max_w:
        return text
    while text and draw.textlength(text + "…", font=font) > max_w:
        text = text[:-1]
    return text + "…"


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_w: float) -> list[str]:
    lines: list[str] = []
    cur = ""
    for word in text.split():
        cand = f"{cur} {word}".strip()
        if draw.textlength(cand, font=font) <= max_w or not cur:
            cur = cand
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _draw_header(canvas: Image.Image, layout: dict, brand_kit: dict, s: float, light: bool):
    W, H = canvas.size
    draw = ImageDraw.Draw(canvas)
    scale = float(layout.get("brandScale") or 14)
    stacked = layout.get("brandLayout") == "stacked"
    align = layout.get("brandAlign") or "center"

    d = int(round(scale * 2.85 * s))
    gap = max(6, round(scale * 0.65)) * s
    name_font = _font("sans_bold", scale * s)
    handle_font = _font("sans_medium", max(9, round(scale * 0.75)) * s)
    badge_size = int(round(max(10, round(scale * 0.85)) * s))
    show_badge = layout.get("showVerifiedBadge", True) is not False

    name = str(layout.get("brandName") or "")
    handle = str(layout.get("brandHandle") or brand_kit.get("username") or "")
    side_pad = 20 * s
    max_text_w = (W - 2 * side_pad) - (0 if stacked else d + gap)
    badge_room = (6 * s + badge_size) if show_badge else 0
    name = _fit(draw, name, name_font, max_text_w - badge_room)
    handle = _fit(draw, handle, handle_font, max_text_w)

    name_w = draw.textlength(name, font=name_font) + badge_room
    handle_w = draw.textlength(handle, font=handle_font)
    name_h = scale * s * 1.375
    handle_h = max(9, round(scale * 0.75)) * s * 1.25 if handle else 0
    text_w = max(name_w, handle_w)
    text_h = name_h + handle_h

    if stacked:
        block_w, block_h = max(d, text_w), d + gap + text_h
    else:
        block_w, block_h = d + gap + text_w, max(d, text_h)

    _, cy_pct = _pos(layout, "headerPos", (50, 16))
    cy = H * cy_pct / 100.0
    if align == "left":
        x0 = side_pad
    elif align == "right":
        x0 = W - side_pad - block_w
    else:
        x0 = (W - block_w) / 2
    y0 = cy - block_h / 2

    avatar = _circle(_load_image(brand_kit.get("avatar_url")) or _default_avatar(d), d)
    ax = x0 + (block_w - d) / 2 if stacked else x0
    ay = y0 if stacked else y0 + (block_h - d) / 2
    canvas.alpha_composite(avatar, (int(ax), int(ay)))
    border = (212, 212, 216, 255) if light else (255, 255, 255, 153)
    draw.ellipse([ax, ay, ax + d - 1, ay + d - 1], outline=border, width=max(2, int(round(2 * s))))

    if stacked:
        tx0, ty0, col_w, text_align = x0 + (block_w - text_w) / 2, y0 + d + gap, text_w, "center"
    else:
        tx0, ty0, col_w, text_align = x0 + d + gap, y0 + (block_h - text_h) / 2, text_w, align

    def line_x(w: float) -> float:
        if text_align == "center":
            return tx0 + (col_w - w) / 2
        if text_align == "right":
            return tx0 + col_w - w
        return tx0

    name_color = (9, 9, 11, 255) if light else (255, 255, 255, 255)
    handle_color = (82, 82, 91, 255) if light else (161, 161, 170, 255)

    nx = line_x(name_w)
    draw.text((nx, ty0 + name_h / 2), name, font=name_font, fill=name_color, anchor="lm")
    if show_badge:
        bx = nx + draw.textlength(name, font=name_font) + 6 * s
        canvas.alpha_composite(_badge(badge_size), (int(bx), int(ty0 + (name_h - badge_size) / 2)))
    if handle:
        draw.text((line_x(handle_w), ty0 + name_h + handle_h / 2), handle, font=handle_font, fill=handle_color, anchor="lm")


def _draw_title(canvas: Image.Image, layout: dict, hook_title: str, s: float, light: bool):
    text = _EMOJI_RE.sub("", hook_title or "")
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return
    if layout.get("titleCapsLock", True) is not False:
        text = text.upper()

    W, H = canvas.size
    draw = ImageDraw.Draw(canvas)
    fs = float(layout.get("fontSize") or 14) * s
    font = _font(_title_font_kind(layout.get("fontFamily", "")), fs)
    box_w = W * 0.88
    lines = _wrap(draw, text, font, box_w)
    line_h = fs * 1.25

    color_hex = (layout.get("titleColor") or "#ffffff").lower()
    if light and color_hex in ("#ffffff", "#fff"):
        color_hex = "#000000"
    fill = _hex(color_hex) + (255,)
    stroke_px = {"thin": 1.0, "medium": 2.0, "thick": 3.0}.get(layout.get("titleStroke") or "none", 0.0)
    stroke_w = int(round(stroke_px * s))
    stroke_fill = _hex(layout.get("titleStrokeColor"), (0, 0, 0)) + (255,)
    align = layout.get("textAlign") or "center"

    cx_pct, cy_pct = _pos(layout, "titlePos", (50, 24))
    box_x0 = W * cx_pct / 100.0 - box_w / 2
    y = H * cy_pct / 100.0 - (line_h * len(lines)) / 2
    for line in lines:
        lw = draw.textlength(line, font=font)
        if align == "left":
            x = box_x0
        elif align == "right":
            x = box_x0 + box_w - lw
        else:
            x = box_x0 + (box_w - lw) / 2
        draw.text((x, y + line_h / 2), line, font=font, fill=fill, anchor="lm",
                  stroke_width=stroke_w, stroke_fill=stroke_fill)
        y += line_h


def _draw_watermark(canvas: Image.Image, layout: dict, brand_kit: dict, s: float, box: tuple[int, int, int, int]):
    if layout.get("showWatermark", True) is False:
        return
    bx, by, bw, bh = box
    op = layout.get("watermarkOpacity", 45)
    try:
        op = float(op)
    except (TypeError, ValueError):
        op = 45.0
    alpha = op if op <= 1 else op / 100.0
    alpha = max(0.0, min(1.0, alpha))

    pad_x, pad_y = 10 * s, 4 * s
    content: Image.Image | None = None
    if layout.get("watermarkType") == "image":
        img = _load_image(layout.get("watermarkImage"))
        if img:
            h = int(round(16 * s))
            w = min(int(round(80 * s)), max(1, int(img.width * h / max(1, img.height))))
            content = img.resize((w, h), Image.LANCZOS)
    if content is None:
        text = str(layout.get("watermarkText") or layout.get("brandHandle") or brand_kit.get("username") or "").strip()
        if not text:
            return
        font = _font("sans_bold", 10 * s)
        tmp = ImageDraw.Draw(canvas)
        dot, gap = 6 * s, 6 * s
        tw = tmp.textlength(text, font=font)
        th = 10 * s * 1.5
        content = Image.new("RGBA", (int(dot + gap + tw) + 2, int(th)), (0, 0, 0, 0))
        cd = ImageDraw.Draw(content)
        cd.ellipse([0, th / 2 - dot / 2, dot, th / 2 + dot / 2], fill=(129, 140, 248, 255))
        cd.text((dot + gap, th / 2), text, font=font, fill=(255, 255, 255, 255), anchor="lm")

    pw, ph = int(content.width + 2 * pad_x), int(content.height + 2 * pad_y)
    pill = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pill)
    pd.rounded_rectangle([0, 0, pw - 1, ph - 1], radius=ph // 2, fill=(0, 0, 0, 128),
                         outline=(255, 255, 255, 51), width=max(1, int(round(s))))
    pill.alpha_composite(content, (int(pad_x), int(pad_y)))
    if alpha < 1:
        a = pill.getchannel("A").point(lambda v: int(v * alpha))
        pill.putalpha(a)

    inset = (8 + 10) * s
    pos = layout.get("watermarkPosition") or "bottom_center"
    if pos == "center":
        x, y = bx + (bw - pw) / 2, by + (bh - ph) / 2
    elif pos == "top_right":
        x, y = bx + bw - inset - pw, by + inset
    elif pos == "top_left":
        x, y = bx + inset, by + inset
    else:
        x, y = bx + (bw - pw) / 2, by + bh - inset - ph
    canvas.alpha_composite(pill, (int(x), int(y)))


def _round_video_corners(canvas: Image.Image, box: tuple[int, int, int, int], radius: int, bg_rgb: tuple[int, int, int]):
    bx, by, bw, bh = box
    if radius <= 0 or bw <= 0 or bh <= 0:
        return
    k = 4
    mask = Image.new("L", (bw * k, bh * k), 255)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, bw * k - 1, bh * k - 1], radius=radius * k, fill=0)
    mask = mask.resize((bw, bh), Image.LANCZOS)
    corners = Image.new("RGBA", (bw, bh), bg_rgb + (255,))
    corners.putalpha(mask)
    canvas.alpha_composite(corners, (bx, by))


def render_template_overlay(
    brand_kit: dict,
    hook_title: str,
    out_path: str,
    canvas_w: int,
    canvas_h: int,
    video_box: tuple[int, int, int, int],
    bg_rgb: tuple[int, int, int],
) -> str:
    layout = (brand_kit or {}).get("layout_config") or {}
    s = canvas_w / EDITOR_PHONE_W
    light = bg_rgb == (255, 255, 255)
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    if layout.get("videoRounded"):
        _round_video_corners(canvas, video_box, int(round(16 * s)), bg_rgb)
    _draw_watermark(canvas, layout, brand_kit or {}, s, video_box)
    _draw_header(canvas, layout, brand_kit or {}, s, light)
    _draw_title(canvas, layout, hook_title, s, light)

    canvas.save(out_path, "PNG")
    return out_path
