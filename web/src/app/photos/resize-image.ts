const MAX_SIZE = 1280;
const MAX_BYTES = 400_000;

/**
 * Krymper en bild till högst 1280 px på längsta sidan och sparar den som JPEG.
 * Bilden ritas om på en canvas, så metadata (GPS, telefonmodell) följer inte med.
 */
export async function resizeToJpeg(file: File): Promise<Blob> {
  // 'from-image' vänder bilden rätt enligt telefonens orientering.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Sänk kvaliteten tills bilden är liten nog, så att trafiken håller sig låg.
  for (const quality of [0.82, 0.7, 0.58, 0.45]) {
    const blob = await toJpeg(canvas, quality);
    if (blob.size <= MAX_BYTES) return blob;
  }
  return toJpeg(canvas, 0.35);
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality),
  );
}