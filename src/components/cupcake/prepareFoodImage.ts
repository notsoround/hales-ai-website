const MAX_DATA_URL = 1_700_000, MAX_BYTES = 1_274_000;
const fits = (dataUrl: string) => dataUrl.length <= MAX_DATA_URL && Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * .75) <= MAX_BYTES;

/**
 * Resize and encode a photo for upload, inside the server's byte limit. Detail matters (receipt print, plate texture), so the
 * photo is kept as large and as lightly compressed as fits: 2048 px on the long edge at high JPEG quality first, then smaller
 * sizes at the same quality, and heavy compression only as the last resort.
 */
export async function prepareFoodImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d'); if (!context) throw new Error('This browser could not prepare the image.');
    const draw = (limit: number) => {
      const scale = Math.min(1, limit / longEdge);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    let drawn = 0;
    for (const limit of [2048, 1800, 1600]) {
      if (drawn && longEdge <= limit) continue; // already tried at the photo's own size
      draw(limit); drawn = limit;
      for (const quality of [.9, .84, .78, .72]) { const dataUrl = canvas.toDataURL('image/jpeg', quality); if (fits(dataUrl)) return dataUrl; }
    }
    // Very detailed photos: as before, 1600 px with stronger compression.
    if (longEdge > 1600 && drawn !== 1600) draw(1600);
    for (let quality = .66; quality > .42; quality -= .08) { const dataUrl = canvas.toDataURL('image/jpeg', quality); if (fits(dataUrl)) return dataUrl; }
    throw new Error('This image is still too large. Crop the food photo and try again.');
  } finally { URL.revokeObjectURL(objectUrl); }
}
