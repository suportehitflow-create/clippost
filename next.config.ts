import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static / ffprobe-static precisam ficar fora do bundle para o caminho do binário funcionar
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],

  // O editor em massa roda num servidor Node persistente (Fly) e a tela fica na Vercel:
  // as rotas dele precisam aceitar chamadas de outra origem. A autorização é por token
  // Bearer (não cookie), então liberar a origem não expõe sessão.
  async headers() {
    return [
      {
        source: "/api/editor-massa/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type, x-nome-arquivo, Range" },
          { key: "Access-Control-Expose-Headers", value: "Content-Range, Content-Length, Accept-Ranges, Content-Disposition" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
