import type { RasterGeometry, Rect, SilhouetteProfile } from './careModel';
import type { Band } from './careChoreography';

export const PROFILE_BANDS = 24;
const ALPHA_THRESHOLD = 16;

function safeSize(geometry: RasterGeometry) {
  return {
    width: Math.max(1, Number.isFinite(geometry.width) ? geometry.width : 1),
    height: Math.max(1, Number.isFinite(geometry.height) ? geometry.height : 1),
  };
}

/** Alpha bounds when they are valid for the raster, otherwise the full raster. */
export function visibleBounds(geometry: RasterGeometry): Rect {
  const { width, height } = safeSize(geometry);
  const raw = geometry.bounds;
  const valid =
    raw &&
    [raw.x, raw.y, raw.width, raw.height].every(Number.isFinite) &&
    raw.x >= 0 &&
    raw.y >= 0 &&
    raw.width > 0 &&
    raw.height > 0 &&
    raw.x + raw.width <= width &&
    raw.y + raw.height <= height;
  return valid ? raw : { x: 0, y: 0, width, height };
}

/** Fits visible pixels without changing their aspect ratio or knowing facial anatomy. */
export function fitSkin(
  geometry: RasterGeometry,
  stageWidth: number,
  stageHeight: number,
  size = 1,
) {
  const { width, height } = safeSize(geometry);
  const bounds = visibleBounds(geometry);
  const baseline = Math.max(1, stageHeight - 44);
  // Reserve space for rotation/jumps even for tall crowns, wide bodies, and asymmetry.
  const fit = Math.min(
    Math.max(1, stageWidth - 96) / bounds.width,
    Math.max(1, baseline - 72) / bounds.height,
  );
  const scale =
    fit * (Number.isFinite(size) && size > 0 ? Math.min(1, size) : 1);
  const visibleWidth = bounds.width * scale;
  const visibleHeight = bounds.height * scale;
  return {
    width: visibleWidth,
    height: visibleHeight,
    scale,
    left: (stageWidth - visibleWidth) / 2,
    top: baseline - visibleHeight,
    imageWidth: width * scale,
    imageHeight: height * scale,
    imageLeft: -bounds.x * scale,
    imageTop: -bounds.y * scale,
    baseline,
  };
}
export type SkinFrame = ReturnType<typeof fitSkin>;

/** Play needs room on both sides (toy dock on the left, landing spot on the right). */
export const PLAY_SIDE_ROOM = 84;
export function playSize(
  geometry: RasterGeometry,
  stageWidth: number,
  stageHeight: number,
) {
  const natural = fitSkin(geometry, stageWidth, stageHeight).width;
  return Math.max(
    0.5,
    Math.min(0.8, (stageWidth - 2 * PLAY_SIDE_ROOM) / Math.max(1, natural)),
  );
}

export function boundsFromRgba(
  bytes: ArrayLike<number>,
  width: number,
  height: number,
): Rect | null {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    bytes.length !== width * height * 4
  )
    return null;
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if ((bytes[(y * width + x) * 4 + 3] ?? 0) >= ALPHA_THRESHOLD) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  return right < 0
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/** Horizontal extent of visible pixels in PROFILE_BANDS slices (same rule as scripts/analyze-assets.py). */
export function profileFromRgba(
  bytes: ArrayLike<number>,
  width: number,
  bounds: Rect,
  bands = PROFILE_BANDS,
): SilhouetteProfile {
  const profile: ([number, number] | null)[] = [];
  for (let i = 0; i < bands; i++) {
    const y0 = bounds.y + Math.floor((i * bounds.height) / bands);
    const y1 = Math.max(
      y0 + 1,
      bounds.y + Math.floor(((i + 1) * bounds.height) / bands),
    );
    let left = Infinity,
      right = -Infinity;
    for (let y = y0; y < y1; y++)
      for (let x = bounds.x; x < bounds.x + bounds.width; x++) {
        if ((bytes[(y * width + x) * 4 + 3] ?? 0) >= ALPHA_THRESHOLD) {
          left = Math.min(left, x);
          right = Math.max(right, x + 1);
        }
      }
    profile.push(Number.isFinite(left) ? [left, right] : null);
  }
  return profile;
}

/**
 * Silhouette slices in stage pixels for a fitted skin. A missing or inconsistent profile falls back
 * to the visible-bounds rectangle, which is conservative for contact and clearance.
 */
export function stageBands(geometry: RasterGeometry, frame: SkinFrame): Band[] {
  const bounds = visibleBounds(geometry);
  const whole = [
    {
      top: frame.top,
      bottom: frame.baseline,
      left: frame.left,
      right: frame.left + frame.width,
    },
  ];
  const profile = geometry.profile;
  if (!profile || profile.length === 0) return whole;
  const bands: Band[] = [];
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const slice = profile[i];
    if (!slice) continue;
    const [minX, maxX] = slice;
    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      minX < bounds.x ||
      maxX > bounds.x + bounds.width ||
      maxX <= minX
    )
      return whole;
    const y0 = Math.floor((i * bounds.height) / n),
      y1 = Math.max(y0 + 1, Math.floor(((i + 1) * bounds.height) / n));
    bands.push({
      top: frame.top + y0 * frame.scale,
      bottom: frame.top + y1 * frame.scale,
      left: frame.left + (minX - bounds.x) * frame.scale,
      right: frame.left + (maxX - bounds.x) * frame.scale,
    });
  }
  return bands.length ? bands : whole;
}

export function containsPoint(rect: Rect, x: number, y: number) {
  return (
    x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height
  );
}

export function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, Number.isFinite(value) ? value : 0));
}
