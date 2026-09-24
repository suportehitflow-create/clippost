/**
 * Helper para upload seguro no Supabase Storage sem ser bloqueado por RLS.
 * Obtém URL assinada e token temporário gerados com chave de serviço no servidor.
 */
export async function uploadFileViaSignedUrl(
  supabase: any,
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean }
): Promise<{ path: string; publicUrl: string }> {
  const normalizedPath = path.replace(/^\/+/, '');

  try {
    const res = await fetch('/api/storage/signed-upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket, path: normalizedPath, upsert: options?.upsert ?? true }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .uploadToSignedUrl(data.path, data.token, file, options);

        if (!upErr) {
          const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
          return { path: data.path, publicUrl };
        }
      }

      if (data?.signedUrl) {
        const putRes = await fetch(data.signedUrl, {
          method: 'PUT',
          headers: options?.contentType ? { 'Content-Type': options.contentType } : undefined,
          body: file,
        });

        if (putRes.ok) {
          const publicUrl = supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
          return { path: data.path, publicUrl };
        }
      }
    }
  } catch (e) {
    console.warn('Falha no upload assinado, tentando upload padrão:', e);
  }

  // Fallback: upload direto caso a rota não responda
  const { error: fallbackErr } = await supabase.storage.from(bucket).upload(normalizedPath, file, options);
  if (fallbackErr) {
    throw new Error('Falha no upload do arquivo: ' + fallbackErr.message);
  }
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(normalizedPath).data.publicUrl;
  return { path: normalizedPath, publicUrl };
}
