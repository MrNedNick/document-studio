import { err, ok, type Result } from "../domain/result";
import { checkImageFile, fitWithin, imagesError, type Asset, type ImagesError } from "../domain/03-images";

const newId = () => (globalThis.crypto && "randomUUID" in globalThis.crypto ? globalThis.crypto.randomUUID() : `asset-${Date.now()}-${Math.random()}`);

/**
 * A picture file made ready to keep: checked, decoded with the camera's rotation applied, and stored no
 * larger than 2000 px on its long side. An animated GIF small enough is kept byte for byte, so it still moves.
 */
export async function prepareImage(file: File, now = Date.now()): Promise<Result<{ asset: Asset; blob: Blob }, ImagesError>> {
  const checked = checkImageFile(file);
  if (!checked.ok) return checked;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return err(imagesError("image-unreadable", file.name));
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  if (!size.scaled && (checked.value === "image/gif" || file.size < 1_500_000)) {
    bitmap.close();
    return ok({ asset: { id: newId(), type: checked.value, width: size.width, height: size.height, bytes: file.size, createdAt: now }, blob: file });
  }
  const canvas = new OffscreenCanvas(size.width, size.height);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  // Transparency needs PNG; everything else is a photo and goes to JPEG.
  const type = checked.value === "image/png" || checked.value === "image/gif" ? "image/png" : "image/jpeg";
  const blob = await canvas.convertToBlob({ type, quality: 0.85 });
  return ok({ asset: { id: newId(), type, width: size.width, height: size.height, bytes: blob.size, createdAt: now }, blob });
}
