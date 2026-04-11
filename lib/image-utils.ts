import sharp from "sharp";

/**
 * Takes a transparent PNG (from background removal) and creates an inverted mask:
 * - White = background area (to be replaced by inpainting)
 * - Black = person area (to be preserved)
 */
export async function createInvertedMaskFromAlpha(transparentPngBuffer: Buffer): Promise<Buffer> {
  const image = sharp(transparentPngBuffer);
  const { width, height } = await image.metadata();

  if (!width || !height) throw new Error("Could not read image dimensions");

  // Extract alpha channel
  const { data } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Create mask: invert alpha (transparent -> white, opaque -> black)
  const maskPixels = Buffer.alloc(width * height);
  for (let i = 0; i < width * height; i++) {
    const alpha = data[i * 4 + 3]; // RGBA, get A
    maskPixels[i] = 255 - alpha; // Invert: transparent (0) -> white (255), opaque (255) -> black (0)
  }

  return sharp(maskPixels, {
    raw: { width, height, channels: 1 },
  })
    .png()
    .toBuffer();
}

/**
 * Resize/crop image to target aspect ratio for Instagram
 */
export async function cropToAspectRatio(
  imageBuffer: Buffer,
  aspectRatio: "4:5" | "1:1" | "9:16"
): Promise<Buffer> {
  const ratios: Record<string, number> = {
    "4:5": 4 / 5,
    "1:1": 1,
    "9:16": 9 / 16,
  };

  const targetRatio = ratios[aspectRatio] || 4 / 5;
  const { width, height } = await sharp(imageBuffer).metadata();

  if (!width || !height) throw new Error("Could not read image dimensions");

  const currentRatio = width / height;
  let cropWidth = width;
  let cropHeight = height;

  if (currentRatio > targetRatio) {
    // Too wide, crop sides
    cropWidth = Math.round(height * targetRatio);
  } else {
    // Too tall, crop top/bottom
    cropHeight = Math.round(width / targetRatio);
  }

  return sharp(imageBuffer)
    .extract({
      left: Math.round((width - cropWidth) / 2),
      top: Math.round((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .png()
    .toBuffer();
}
