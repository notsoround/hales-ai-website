export async function prepareFoodImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Choose a JPEG, PNG, or WebP image.');
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = objectUrl; await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('This browser could not prepare the image.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = .86; let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (quality > .42 && (dataUrl.length > 1_700_000 || Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * .75) > 1_274_000)) { quality -= .08; dataUrl = canvas.toDataURL('image/jpeg', quality); }
    if (dataUrl.length > 1_700_000 || Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * .75) > 1_274_000) throw new Error('This image is still too large. Crop the food photo and try again.');
    return dataUrl;
  } finally { URL.revokeObjectURL(objectUrl); }
}
