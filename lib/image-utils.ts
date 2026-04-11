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
 * Composite two images using a mask: take masked (white) regions from `edited`,
 * keep everything else from `original`. Both images must be the same size.
 */
export async function compositeWithMask(
  originalBuffer: Buffer,
  editedBuffer: Buffer,
  maskBuffer: Buffer,
): Promise<Buffer> {
  const { width, height } = await sharp(originalBuffer).metadata();
  if (!width || !height) throw new Error("Could not read image dimensions");

  // Resize edited and mask to match original dimensions
  const resizedEdited = await sharp(editedBuffer)
    .resize(width, height, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const resizedMask = await sharp(maskBuffer)
    .resize(width, height, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  const originalRaw = await sharp(originalBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // Blend: where mask is white (255) use edited, where black (0) use original
  const result = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const maskVal = resizedMask[i] / 255; // 0..1
    const oi = i * 4;
    result[oi] = Math.round(originalRaw[oi] * (1 - maskVal) + resizedEdited[oi] * maskVal);
    result[oi + 1] = Math.round(originalRaw[oi + 1] * (1 - maskVal) + resizedEdited[oi + 1] * maskVal);
    result[oi + 2] = Math.round(originalRaw[oi + 2] * (1 - maskVal) + resizedEdited[oi + 2] * maskVal);
    result[oi + 3] = 255;
  }

  return sharp(result, { raw: { width, height, channels: 4 } })
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
