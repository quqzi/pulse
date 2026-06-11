// Downscale a picked image to a compact JPEG data-URI so it fits comfortably in
// localStorage (guest) and a Postgres text column (auth) without a storage bucket.

const MAX_DIM = 1000;   // px — longest edge
const QUALITY = 0.72;   // JPEG quality

export async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  // White matte so transparent PNGs don't turn black when flattened to JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ('close' in bitmap) (bitmap as ImageBitmap).close();

  return canvas.toDataURL('image/jpeg', QUALITY);
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
