import type { Document } from "../01-blocks";
import type { Asset } from "../03-images";

/** A picture inside a bundle: its description and its bytes as base64. */
export interface BundledAsset extends Asset {
  data: string;
}

/**
 * A document with everything it needs to open on another device: its text and the pictures it shows.
 * Written as JSON with a format name and version, so a foreign or future file is recognised.
 */
export interface Bundle {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: number;
  document: Document;
  assets: BundledAsset[];
}

export const BUNDLE_FORMAT = "document-studio";
export const BUNDLE_VERSION = 1;
