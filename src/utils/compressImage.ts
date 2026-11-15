import { MAX_RECEIPT_BYTES } from '../domain/validation';

const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4];
const SCALE_STEP = 0.75;
const MAX_SCALE_ROUNDS = 8;

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Re-encodes an image as JPEG, lowering quality and then dimensions until it
 * fits within `maxBytes`. Files that are not JPG/JPEG/PNG (e.g. PDFs) or already
 * fit are returned unchanged. Returns the smallest result if the target cannot
 * be reached, so the caller re-validates the size.
 */
export async function compressImage(file: File, maxBytes: number = MAX_RECEIPT_BYTES): Promise<File> {
  if (!COMPRESSIBLE_TYPES.includes(file.type) || file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  try {
    let scale = 1;
    let best: Blob | null = null;
    for (let round = 0; round < MAX_SCALE_ROUNDS; round++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      // JPEG has no alpha; paint white so transparent PNG areas don't turn black.
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of QUALITY_STEPS) {
        const blob = await toBlob(canvas, quality);
        if (!blob) return file;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= maxBytes) return toFile(blob, file.name);
      }
      scale *= SCALE_STEP;
    }
    if (best && best.size < file.size) return toFile(best, file.name);
    return file;
  } finally {
    bitmap.close();
  }
}

function toFile(blob: Blob, originalName: string): File {
  const base = originalName.replace(/\.[^./\\]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}
