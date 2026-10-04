/** A picture kept with the documents: the bytes live in IndexedDB, the document only names them. */
export interface Asset {
  id: string;
  type: ImageType;
  width: number;
  height: number;
  /** Size of the stored bytes. */
  bytes: number;
  createdAt: number;
}

/** Raster formats every browser shows. SVG is left out on purpose: it can carry scripts. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** A file bigger than this is refused before it is read. */
export const MAX_IMAGE_FILE = 20 * 1024 * 1024;
/** Longest side kept: sharp on a laptop screen and in print, light enough for a long document. */
export const MAX_IMAGE_SIDE = 2000;
