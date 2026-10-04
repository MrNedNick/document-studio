export type ImagesReason = "not-an-image" | "unsupported-type" | "image-too-large" | "image-unreadable" | "missing-asset";

export interface ImagesError {
  kind: "images";
  reason: ImagesReason;
  /** The file name or asset id concerned. */
  name?: string;
}

export function imagesError(reason: ImagesReason, name?: string): ImagesError {
  return { kind: "images", reason, ...(name !== undefined ? { name } : {}) };
}
