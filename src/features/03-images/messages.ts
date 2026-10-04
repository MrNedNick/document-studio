import type { ImagesError } from "../../domain/03-images";

export function describeImagesError(error: ImagesError): string {
  const name = error.name ? `“${error.name}”` : "That file";
  switch (error.reason) {
    case "not-an-image":
      return `${name} isn't a picture.`;
    case "unsupported-type":
      return `${name} is in a format pictures can't use here — JPEG, PNG, WebP and GIF work. (SVG is left out on purpose: it can run code.)`;
    case "image-too-large":
      return `${name} is over 20 MB. Save a smaller copy and add that.`;
    case "image-unreadable":
      return `${name} couldn't be opened as a picture — it may be damaged.`;
    case "missing-asset":
      return "That picture isn't stored on this device.";
  }
}
