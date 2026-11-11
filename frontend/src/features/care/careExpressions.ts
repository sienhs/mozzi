/**
 * Expression contract shared by every skin.
 *
 * Action timelines only name an expression (for example `eat-chew`); a skin's generated
 * manifest maps that name to its own overlay layers. A skin without a manifest, or a manifest
 * without that expression, simply shows the untouched original image: the fallback for any
 * new or imported shape. No code branches on a character id.
 */
export const EXPRESSIONS = [
  'neutral',
  'blink',
  'attentive',
  'pet-happy',
  'eat-open',
  'eat-chew',
  'savour',
  'play-excited',
  'happy',
] as const;
export type ExpressionId = (typeof EXPRESSIONS)[number];
export const NEUTRAL = 0;
export const expressionIndex = (id: ExpressionId) => EXPRESSIONS.indexOf(id);

export type ExpressionFrame = { layers: readonly string[]; durationMs: number };
export type ExpressionClip = {
  loop: boolean;
  frames: readonly ExpressionFrame[];
};
export type ExpressionLayer = {
  id: string;
  source: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type SkinExpressionSet = {
  canvas: { width: number; height: number };
  anchors: { mouth?: { x: number; y: number; width: number; height: number } };
  layers: readonly ExpressionLayer[];
  expressions: Partial<Record<ExpressionId, ExpressionClip>>;
};

/** Worklet-friendly lookup: per expression, frame durations and a bitmask of visible layers. */
export type ExpressionTable = {
  loop: boolean[];
  durations: number[][];
  masks: number[][];
};

export function compileExpressionTable(
  set: SkinExpressionSet | null,
): ExpressionTable {
  const table: ExpressionTable = { loop: [], durations: [], masks: [] };
  const ids = set?.layers.map(layer => layer.id) ?? [];
  if (ids.length > 30)
    throw new Error('Too many expression layers for a bitmask');
  for (const name of EXPRESSIONS) {
    const clip = set?.expressions[name];
    const frames = clip?.frames.length
      ? clip.frames
      : [{ layers: [], durationMs: 0 }];
    table.loop.push(!!clip?.loop);
    table.durations.push(frames.map(frame => Math.max(0, frame.durationMs)));
    table.masks.push(
      frames.map(frame =>
        frame.layers.reduce((mask, id) => {
          const index = ids.indexOf(id);
          if (index < 0)
            throw new Error(
              `Expression ${name} references missing layer ${id}`,
            );
          return mask | (1 << index);
        }, 0),
      ),
    );
  }
  return table;
}

/** Bitmask of layers visible `elapsed` ms after `expression` started. */
export function visibleLayers(
  table: ExpressionTable,
  expression: number,
  elapsed: number,
): number {
  'worklet';
  const masks = table.masks[expression];
  const durations = table.durations[expression];
  if (!masks || !durations || masks.length === 0) return 0;
  if (masks.length === 1) return masks[0]!;
  let total = 0;
  for (let i = 0; i < durations.length; i++) total += durations[i]!;
  if (total <= 0) return masks[0]!;
  let t = Math.max(0, elapsed);
  if (table.loop[expression]) t = t % total;
  else if (t >= total) return masks[masks.length - 1]!;
  for (let i = 0; i < durations.length; i++) {
    if (t < durations[i]!) return masks[i]!;
    t -= durations[i]!;
  }
  return masks[masks.length - 1]!;
}

/** Mouth centre in source pixels, or null for shapes whose mouth is unknown. */
export function mouthAnchor(set: SkinExpressionSet | null) {
  const mouth = set?.anchors.mouth;
  if (
    !mouth ||
    ![mouth.x, mouth.y, mouth.width, mouth.height].every(Number.isFinite) ||
    mouth.width <= 0 ||
    mouth.height <= 0
  )
    return null;
  if (
    set &&
    (mouth.x < 0 ||
      mouth.y < 0 ||
      mouth.x + mouth.width > set.canvas.width ||
      mouth.y + mouth.height > set.canvas.height)
  )
    return null;
  return {
    x: mouth.x + mouth.width / 2,
    y: mouth.y + mouth.height / 2,
    width: mouth.width,
    height: mouth.height,
  };
}
