FROM python:3.11-slim

# fonts-dejavu-core: o drawtext do FFmpeg usa DejaVuSans-Bold; sem a fonte o filtro
# falha e o clipe cai no render simples, sem legenda e sem brand kit.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-dejavu-core \
    fonts-roboto-unhinted \
    fonts-montserrat \
    git \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Anton = opção "Anton / Impact" do editor de template (camada do título nos cortes)
RUN mkdir -p /usr/local/share/fonts/anton \
    && wget -q https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf -O /usr/local/share/fonts/anton/Anton-Regular.ttf \
    && fc-cache -f >/dev/null 2>&1 || true

# Deno: o yt-dlp atual precisa de um runtime JavaScript para extrair formatos do
# YouTube; sem ele o download falha com "nsig extraction failed".
RUN wget -q https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip -O /tmp/deno.zip \
    && unzip -q /tmp/deno.zip -d /usr/local/bin \
    && rm /tmp/deno.zip \
    && deno --version

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir --upgrade yt-dlp

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
