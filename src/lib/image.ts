/** Shrink a photo on the phone before upload (saves data and storage). Returns a JPEG blob. */
export async function resizeImage(file: File, maxSide = 1280, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPG, PNG or WebP).");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("That photo couldn't be read. Try another one."));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process the photo."))), "image/jpeg", quality),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
