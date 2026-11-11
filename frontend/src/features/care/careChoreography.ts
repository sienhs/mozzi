import type { MotionPhase } from './careModel';
import { expressionIndex } from './careExpressions';

/**
 * Authored action scenes. Every value is a pure function of (phase, elapsed ms, layout), so the
 * body, its expression layers, props, shadows, crumbs and hearts all read one clock, and unit
 * tests can check contact timing without rendering anything.
 *
 * Coordinates are stage pixels. `origin` is the bottom-centre of the visible bounds at rest,
 * which is also the body's transform origin.
 */
export const SCENE_DURATION = {
  idle: 0,
  pet: 0,
  feed: 4400,
  play: 2500,
  reward: 1500,
} as const;
export const FEED_BITES = [450, 1250, 2050] as const;
export const FEED_DELIVERY = 450;
export const PLAY_THROW_END = 700;
export const PLAY_SETTLED = 950;
export const PLAY_CONTACT = 1200;
/** Body and ball may overlap only during the impact squash. */
export const PLAY_IMPACT_END = 1260;
/** After contact the ball skids out from under any overhang before lobbing home. */
export const PLAY_POP_END = 1330;
export const PLAY_RETURN_END = 2150;

export type Point = { x: number; y: number };
/** One horizontal slice of the silhouette at rest, in stage pixels. */
export type Band = { top: number; bottom: number; left: number; right: number };
export type FeedLayout = {
  from: Point;
  target: Point;
  attached: boolean;
  radius: number;
};
/** Throw and return are lobs (cubic Bezier with vertical ends): up from the hand, over the body, down. */
export type PlayLayout = {
  /** reach: hop distance to the ball; recoil: bounce back after the bump (wider for overhangs);
   *  lean: 0..1 strength of the anticipation lean toward the ball (reduced when something overhangs it). */
  side: number;
  reach: number;
  recoil: number;
  lean: number;
  radius: number;
  floor: number;
  dock: Point;
  landing: Point;
  contactBall: Point;
  pop: Point;
  throwHeight: number;
  returnHeight: number;
  clearance: boolean;
};
/** `reduced`: reduced-motion mode. The body stays still; props keep the action legible with less travel. */
export type SceneLayout = {
  origin: Point;
  feed: FeedLayout;
  play: PlayLayout;
  reduced: boolean;
};

export type Pose = {
  x: number;
  y: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  propX: number;
  propY: number;
  propRotate: number;
  propScaleX: number;
  propScaleY: number;
  propVisible: number;
  bites: number;
  crumbAge: number;
  crumbX: number;
  crumbY: number;
  effect: number;
  contact: number;
  contactX: number;
  contactY: number;
  expression: number;
  expressionStart: number;
};

type Stops = readonly (readonly [number, number])[];

export function curve(t: number, stops: Stops, smooth = true) {
  'worklet';
  const first = stops[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < stops.length; i++) {
    const previous = stops[i - 1]!,
      next = stops[i]!;
    if (t <= next[0]) {
      const p = (t - previous[0]) / (next[0] - previous[0]);
      const eased = smooth ? p * p * (3 - 2 * p) : p;
      return previous[1] + (next[1] - previous[1]) * eased;
    }
  }
  return stops[stops.length - 1]![1];
}

function lob(a: Point, b: Point, height: number, u: number): Point {
  'worklet';
  const v = 1 - u;
  // Rise straight from the hand and drop straight onto the spot; travel sideways in between.
  const w = Math.max(0, Math.min(1, (u - 0.08) / 0.8));
  const x = a.x + (b.x - a.x) * w * w * (3 - 2 * w);
  return {
    x,
    y:
      v * v * v * a.y +
      3 * v * v * u * height +
      3 * v * u * u * height +
      u * u * u * b.y,
  };
}

/**
 * Snack centre when held to a known mouth (stage pixels at rest): its top edge sits a few pixels
 * under the mouth centre, so the opening and chewing mouth stay visible above it even for tiny mouths.
 */
export function mouthFeedTarget(
  mouth: Point & { height: number },
  radius: number,
): Point {
  return {
    x: mouth.x,
    y: mouth.y + Math.max(mouth.height * 0.25, 6) - 2 + radius,
  };
}

/** Where a point attached to the body (relative to the origin at rest) is drawn for this pose. */
export function transformPoint(pose: Pose, origin: Point, point: Point): Point {
  'worklet';
  const dx = (point.x - origin.x) * pose.scaleX,
    dy = (point.y - origin.y) * pose.scaleY;
  const r = (pose.rotate * Math.PI) / 180,
    c = Math.cos(r),
    s = Math.sin(r);
  return {
    x: origin.x + pose.x + dx * c - dy * s,
    y: origin.y + pose.y + dx * s + dy * c,
  };
}

function cue(t: number, cues: readonly (readonly [number, number])[], p: Pose) {
  'worklet';
  let index = 0;
  for (let i = 0; i < cues.length; i++) if (t >= cues[i]![0]) index = i;
  p.expression = cues[index]![1];
  p.expressionStart = cues[index]![0];
}

const E = {
  neutral: expressionIndex('neutral'),
  attentive: expressionIndex('attentive'),
  eatOpen: expressionIndex('eat-open'),
  eatChew: expressionIndex('eat-chew'),
  savour: expressionIndex('savour'),
  excited: expressionIndex('play-excited'),
  happy: expressionIndex('happy'),
};
const FEED_CUES = [
  [0, E.eatOpen],
  [450, E.eatChew],
  [1100, E.eatOpen],
  [1250, E.eatChew],
  [1900, E.eatOpen],
  [2050, E.eatChew],
  [2750, E.neutral],
  [2950, E.savour],
  [4100, E.neutral],
] as const;
const PLAY_CUES = [
  [0, E.attentive],
  [PLAY_THROW_END, E.excited],
  [PLAY_POP_END, E.happy],
  [2250, E.neutral],
] as const;
const REWARD_CUES = [
  [0, E.happy],
  [1300, E.neutral],
] as const;
const CHEW_WINDOWS = [
  [520, 1100],
  [1320, 1900],
  [2120, 2700],
] as const;

export function restPose(): Pose {
  'worklet';
  return {
    x: 0,
    y: 0,
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    propX: 0,
    propY: 0,
    propRotate: 0,
    propScaleX: 1,
    propScaleY: 1,
    propVisible: 0,
    bites: 0,
    crumbAge: -1,
    crumbX: 0,
    crumbY: 0,
    effect: 0,
    contact: 0,
    contactX: 0,
    contactY: 0,
    expression: E.neutral,
    expressionStart: 0,
  };
}

function feedScene(p: Pose, t: number, layout: SceneLayout) {
  'worklet';
  const feed = layout.feed;
  if (feed.attached) {
    // Reach up to the offered snack, chomp at each bite, munch, swallow, then savour.
    p.y = curve(t, [
      [0, 0],
      [350, -4],
      [450, -5],
      [520, 1.5],
      [650, 0],
      [1150, -4],
      [1250, -5],
      [1320, 1.5],
      [1450, 0],
      [1950, -4],
      [2050, -5],
      [2120, 1.5],
      [2250, 0],
      [2750, 0],
      [2850, -6],
      [2980, 1],
      [3100, 0],
      [3400, -8],
      [3650, 0],
      [3850, -5],
      [4050, 0],
    ]);
    p.scaleX = curve(t, [
      [0, 1],
      [450, 0.985],
      [520, 1.045],
      [650, 1],
      [1250, 0.985],
      [1320, 1.045],
      [1450, 1],
      [2050, 0.985],
      [2120, 1.045],
      [2250, 1],
      [2800, 0.97],
      [2950, 1.03],
      [3100, 1],
      [3400, 0.98],
      [3650, 1.03],
      [3850, 1],
    ]);
    p.rotate = curve(t, [
      [0, 0],
      [450, 2],
      [650, 0],
      [1250, -2],
      [1450, 0],
      [2050, 2],
      [2250, 0],
      [3200, 0],
      [3400, -3],
      [3650, 3],
      [3850, -2],
      [4050, 0],
    ]);
  } else {
    // Fallback for shapes without a known mouth: lean down over the plate in front.
    p.y = curve(t, [
      [0, 0],
      [180, -5],
      [400, 9],
      [1250, 9],
      [2050, 9],
      [2450, 9],
      [2700, 0],
      [3400, -8],
      [3650, 0],
      [3850, -5],
      [4050, 0],
    ]);
    for (const bite of FEED_BITES)
      p.y += curve(t, [
        [bite - 80, 0],
        [bite + 40, 4],
        [bite + 220, 0],
      ]);
    p.scaleX = curve(t, [
      [0, 1],
      [180, 0.98],
      [400, 1.035],
      [2450, 1.035],
      [2700, 1],
      [3400, 0.98],
      [3650, 1.03],
      [3850, 1],
    ]);
    p.rotate = curve(t, [
      [0, 0],
      [3200, 0],
      [3400, -3],
      [3650, 3],
      [3850, -2],
      [4050, 0],
    ]);
  }
  for (const [start, end] of CHEW_WINDOWS) {
    if (t > start && t < end) {
      const envelope = Math.min(1, (t - start) / 90, (end - t) / 90);
      const wave = Math.sin(((t - start) / 280) * Math.PI * 2);
      p.y += 1.4 * wave * envelope;
      p.scaleX += 0.012 * wave * envelope;
    }
  }
  p.scaleY = 2 - p.scaleX;
  // Snack: delivered from where the user let go, then held to the mouth (or rests on the plate).
  let bites = 0,
    lastBite = -1;
  for (const bite of FEED_BITES)
    if (t >= bite) {
      bites++;
      lastBite = bite;
    }
  p.bites = bites;
  let target = feed.target;
  let lift = 0;
  if (feed.attached) {
    target = transformPoint(p, layout.origin, feed.target);
    // Between bites the snack sits a little lower so the chewing mouth stays visible.
    lift = 7;
    for (const bite of FEED_BITES)
      lift = Math.min(
        lift,
        curve(t, [
          [bite - 160, 7],
          [bite, 0],
          [bite + 130, 7],
        ]),
      );
    if (t < FEED_DELIVERY) lift = 0;
  }
  const u = Math.min(1, t / FEED_DELIVERY),
    eased = 1 - (1 - u) * (1 - u) * (1 - u);
  const distance = Math.hypot(target.x - feed.from.x, target.y - feed.from.y);
  p.propX = feed.from.x + (target.x - feed.from.x) * eased;
  p.propY =
    feed.from.y +
    (target.y - feed.from.y) * eased +
    lift -
    Math.sin(Math.PI * u) * Math.min(56, distance * 0.3);
  p.propRotate = curve(t, [
    [0, -12],
    [FEED_DELIVERY, 0],
    [1250, 6],
    [2050, -4],
  ]);
  const gone = curve(t, [
    [FEED_BITES[2], 1],
    [FEED_BITES[2] + 90, 0],
  ]);
  p.propScaleX = p.propScaleY =
    curve(t, [
      [0, 0.92],
      [FEED_DELIVERY, 1],
    ]) * gone;
  p.propVisible = gone;
  if (lastBite >= 0 && t - lastBite < 760) {
    p.crumbAge = t - lastBite;
    p.crumbX = target.x;
    p.crumbY = target.y - feed.radius * 0.55 + (feed.attached ? 0 : 6);
  }
  p.effect = curve(t, [
    [0, 0],
    [2950, 0],
    [3150, 1],
    [3900, 1],
    [4300, 0],
  ]);
  cue(t, FEED_CUES, p);
}

function playScene(p: Pose, t: number, layout: SceneLayout) {
  'worklet';
  const play = layout.play,
    s = play.side;
  // Notice the throw, crouch, hop to the ball (arriving at contact with speed), bump and recoil, hop home.
  const recoil = play.recoil;
  p.x =
    t <= PLAY_CONTACT
      ? s *
        play.reach *
        curve(
          t,
          [
            [0, 0],
            [900, 0],
            [PLAY_CONTACT, 1],
          ],
          false,
        )
      : s *
        curve(t, [
          [PLAY_CONTACT, play.reach],
          [1290, play.reach - recoil],
          [1350, play.reach - recoil],
          [1900, 0],
        ]);
  p.y = curve(t, [
    [0, 0],
    [500, 0],
    [700, 4],
    [900, 6],
    [1050, -24],
    [PLAY_CONTACT, 0],
    [1260, 5],
    [1350, 0],
    [1620, -14],
    [1900, 0],
    [1980, 4],
    [2100, 0],
  ]);
  const lean = t > PLAY_THROW_END && t < PLAY_CONTACT ? play.lean : 1;
  p.rotate =
    s *
    lean *
    curve(t, [
      [0, 0],
      [350, -3],
      [PLAY_THROW_END, -1],
      [850, 5],
      [950, 6],
      [1100, 2],
      [PLAY_CONTACT, 0],
      [1300, -2],
      [1600, -4],
      [1900, 0],
      [2100, 1.5],
      [2300, 0],
    ]);
  p.scaleX = curve(t, [
    [0, 1],
    [PLAY_THROW_END, 1.02],
    [900, 1.05],
    [960, 0.96],
    [1100, 0.97],
    [PLAY_CONTACT, 1],
    [1260, 1.04],
    [1350, 1],
    [1450, 0.97],
    [1620, 0.98],
    [1900, 1],
    [1980, 1.05],
    [2100, 1],
  ]);
  p.scaleY = 2 - p.scaleX;
  // Ball: parabolic throw over the body, settle, bump at the silhouette edge, pop up, arc home.
  const r = play.radius,
    rest = play.contactBall;
  let ball: Point;
  let squash = 1;
  if (t < PLAY_THROW_END) {
    ball = lob(play.dock, play.landing, play.throwHeight, t / PLAY_THROW_END);
  } else if (t < PLAY_SETTLED) {
    const u = (t - PLAY_THROW_END) / (PLAY_SETTLED - PLAY_THROW_END);
    const rolls = play.landing.x !== rest.x; // reduced motion: roll in flat under any overhang
    ball = {
      x: play.landing.x + (rest.x - play.landing.x) * u,
      y: rest.y - (rolls ? 0 : 18 * Math.sin(Math.PI * u)),
    };
    squash = curve(t, [
      [PLAY_THROW_END, 0.8],
      [PLAY_THROW_END + 90, 1],
    ]);
  } else if (t < PLAY_CONTACT) {
    ball = rest;
  } else if (t < PLAY_POP_END) {
    const u = (t - PLAY_CONTACT) / (PLAY_POP_END - PLAY_CONTACT);
    ball = {
      x: rest.x + (play.pop.x - rest.x) * (1 - (1 - u) * (1 - u)),
      y: rest.y,
    }; // flat: slides out under overhangs
    squash = curve(t, [
      [PLAY_CONTACT, 0.82],
      [PLAY_CONTACT + 110, 1],
    ]);
  } else if (t < PLAY_RETURN_END) {
    ball = lob(
      play.pop,
      play.dock,
      play.returnHeight,
      (t - PLAY_POP_END) / (PLAY_RETURN_END - PLAY_POP_END),
    );
  } else {
    const u = Math.min(1, (t - PLAY_RETURN_END) / 200);
    ball = { x: play.dock.x, y: play.dock.y - 14 * Math.sin(Math.PI * u) };
    squash = curve(t, [
      [PLAY_RETURN_END, 0.82],
      [PLAY_RETURN_END + 100, 1],
    ]);
  }
  let visible = 1;
  if (layout.reduced && t >= PLAY_CONTACT) {
    // Less travel: the ball fades where it was touched and reappears in the dock.
    const out = curve(t, [
      [PLAY_CONTACT + 120, 1],
      [PLAY_CONTACT + 320, 0],
    ]);
    const back = curve(t, [
      [1900, 0],
      [PLAY_RETURN_END, 1],
    ]);
    ball = out > 0 ? rest : play.dock;
    visible = Math.max(out, back);
    squash = 1;
  }
  p.propX = ball.x;
  p.propY = ball.y;
  p.propScaleX = 2 - squash;
  p.propScaleY = squash;
  p.propVisible = visible;
  p.propRotate = ((ball.x - play.dock.x) / r) * (180 / Math.PI);
  p.contact = curve(t, [
    [0, 0],
    [PLAY_CONTACT - 10, 0],
    [PLAY_CONTACT + 30, 1],
    [PLAY_CONTACT + 220, 0],
  ]);
  p.contactX = rest.x - s * r;
  p.contactY = rest.y;
  cue(t, PLAY_CUES, p);
}

/** Authored action beats, independent of anatomy. Shared by the renderer and tests. */
export function sampleScene(
  phase: MotionPhase,
  elapsed: number,
  layout: SceneLayout,
): Pose {
  'worklet';
  const t = Math.max(0, elapsed);
  const p = restPose();
  if (phase === 'feed') feedScene(p, t, layout);
  else if (phase === 'play') playScene(p, t, layout);
  else if (phase === 'reward') {
    p.y = curve(t, [
      [0, 0],
      [180, 5],
      [430, -24],
      [700, 0],
      [820, 4],
      [1100, 0],
    ]);
    p.scaleX = curve(t, [
      [0, 1],
      [180, 1.05],
      [430, 0.98],
      [700, 1.06],
      [1000, 1],
    ]);
    p.scaleY = 2 - p.scaleX;
    p.effect = curve(t, [
      [0, 0],
      [220, 1],
      [1000, 1],
      [1500, 0],
    ]);
    cue(t, REWARD_CUES, p);
  }
  if (layout.reduced) {
    p.x = 0;
    p.y = 0;
    p.rotate = 0;
    p.scaleX = 1;
    p.scaleY = 1;
  }
  return p;
}

/** True when the ball circle overlaps the posed silhouette (each band's transformed bounding box). */
export function ballTouchesBody(
  ball: Point,
  radius: number,
  bands: readonly Band[],
  pose: Pose,
  origin: Point,
  margin = 0,
) {
  for (const band of bands) {
    const corners = [
      transformPoint(pose, origin, { x: band.left, y: band.top }),
      transformPoint(pose, origin, { x: band.right, y: band.top }),
      transformPoint(pose, origin, { x: band.left, y: band.bottom }),
      transformPoint(pose, origin, { x: band.right, y: band.bottom }),
    ];
    const left = Math.min(...corners.map(c => c.x)) - margin,
      right = Math.max(...corners.map(c => c.x)) + margin;
    const top = Math.min(...corners.map(c => c.y)) - margin,
      bottom = Math.max(...corners.map(c => c.y)) + margin;
    const nx = Math.max(left, Math.min(ball.x, right)),
      ny = Math.max(top, Math.min(ball.y, bottom));
    if ((ball.x - nx) ** 2 + (ball.y - ny) ** 2 < radius * radius) return true;
  }
  return false;
}

/** Ball-centre x at which a ball at height `ballY` just touches the resting silhouette on `side`. */
export function touchingBallX(
  bands: readonly Band[],
  ballY: number,
  radius: number,
  side: number,
) {
  let x = side > 0 ? -Infinity : Infinity;
  for (const band of bands) {
    const dy =
      ballY < band.top
        ? band.top - ballY
        : ballY > band.bottom
          ? ballY - band.bottom
          : 0;
    if (dy >= radius) continue;
    const reach = Math.sqrt(radius * radius - dy * dy);
    x =
      side > 0
        ? Math.max(x, band.right + reach)
        : Math.min(x, band.left - reach);
  }
  if (!Number.isFinite(x))
    for (const band of bands)
      x =
        side > 0
          ? Math.max(x, band.right + radius)
          : Math.min(x, band.left - radius);
  return x;
}

/**
 * Builds a play round for any silhouette: the ball lands beyond the body edge, the body hops so
 * that its edge meets the ball exactly at PLAY_CONTACT, and both lobs are searched (landing spot,
 * skid-out point, height) until they clear the posed silhouette, sampled on the real timeline.
 * `clearance` reports whether a fully on-stage solution was found.
 */
/** Gap between the stage's left edge and the waiting ball, so its highlight ring stays inside the stage. */
export const BALL_DOCK_INSET = 22;

export function buildPlayLayout(input: {
  stageWidth: number;
  floor: number;
  origin: Point;
  bands: readonly Band[];
  radius: number;
  round: number;
  reduced: boolean;
}): PlayLayout {
  const { stageWidth, floor, bands, radius: r } = input;
  const side = 1;
  const touching = touchingBallX(bands, floor - r, r, side);
  const factor = [1, 0.78, 0.9][input.round % 3]!;
  const maxReach = input.reduced
    ? 0
    : Math.min(96, Math.max(36, stageWidth * 0.13)) * factor;
  const widest = Math.max(...bands.map(band => band.right));
  // The ball drops from above, so its spot must clear every protrusion (crowns, knots, held props).
  const columnClear = widest + r + 3;
  // How far the silhouette overhangs the floor-level contact point; the body recoils past it.
  const overhang = Math.max(0, widest - (touching - r));
  const edge = stageWidth - r - 2;
  const limit = edge - 4 - 18; // leaves room for the ball to skid out after the bump
  const top = Math.min(...bands.map(band => band.top));
  const dock = {
    x: Math.max(
      BALL_DOCK_INSET + r,
      Math.min(
        stageWidth * 0.25,
        Math.min(...bands.map(band => band.left)) - r - 40,
      ),
    ),
    y: floor - r,
  };
  const apex = (a: Point, b: Point, height: number) => {
    let highest = Infinity;
    for (let u = 0; u <= 1; u += 0.02)
      highest = Math.min(highest, lob(a, b, height, u).y);
    return highest;
  };
  let layout: PlayLayout | null = null;
  for (let extra = 0; ; extra += 6) {
    const spot = Math.max(touching + maxReach, columnClear) + extra;
    const ballX = input.reduced
      ? touching
      : Math.max(touching, Math.min(limit, spot));
    const reach = ballX - touching;
    const contactBall = { x: ballX, y: floor - r };
    // Normally it lands on its spot; with reduced motion the body stays put, so it lands clear and rolls in.
    const landing = {
      x: input.reduced
        ? Math.max(ballX, Math.min(edge - 4, columnClear + extra))
        : ballX,
      y: floor - r,
    };
    const pop = { x: Math.min(edge, ballX + 18 * side), y: floor - r };
    const candidate: PlayLayout = {
      side,
      reach,
      recoil: Math.min(reach, Math.max(22, overhang + 6)),
      lean: 1,
      radius: r,
      floor,
      dock,
      landing,
      contactBall,
      pop,
      clearance: false,
      throwHeight: top - 30,
      returnHeight: top - 40,
    };
    const scene: SceneLayout = {
      origin: input.origin,
      play: candidate,
      feed: { from: dock, target: dock, attached: false, radius: 0 },
      reduced: input.reduced,
    };
    const clear = (from: number, to: number, margin = 3) => {
      for (let t = from; t <= to; t += 15) {
        const pose = sampleScene('play', t, scene);
        if (
          pose.propVisible > 0 &&
          ballTouchesBody(
            { x: pose.propX, y: pose.propY },
            r,
            bands,
            pose,
            input.origin,
            margin,
          )
        )
          return false;
      }
      return true;
    };
    while (
      !clear(0, PLAY_THROW_END - 120) &&
      apex(dock, landing, candidate.throwHeight - 6) >= r + 2
    )
      candidate.throwHeight -= 6;
    let ok = clear(0, PLAY_THROW_END - 120);
    // While the ball waits beside the body, the anticipation lean must not swing anything into it.
    if (ok && !input.reduced) {
      // (the hop itself closes the gap to zero exactly at PLAY_CONTACT, hence the thin margin)
      for (const lean of [1, 0.5, 0]) {
        candidate.lean = lean;
        if (clear(PLAY_THROW_END - 120, PLAY_CONTACT - 30, 0.5)) break;
      }
      ok = clear(PLAY_THROW_END - 120, PLAY_CONTACT - 30, 0.5);
    }
    if (ok && !input.reduced) {
      // Nearest skid-out point first (cheap), then the lowest lob home that clears.
      const firstHeight = candidate.returnHeight;
      ok = false;
      search: for (; pop.x <= edge; pop.x += 4) {
        if (!clear(PLAY_IMPACT_END, PLAY_POP_END + 45)) continue;
        for (
          candidate.returnHeight = firstHeight;
          apex(pop, dock, candidate.returnHeight) >= r + 2;
          candidate.returnHeight -= 8
        ) {
          if (clear(PLAY_POP_END, PLAY_RETURN_END)) {
            ok = true;
            break search;
          }
        }
      }
      if (!ok) {
        pop.x = Math.min(edge, ballX + 18 * side);
        candidate.returnHeight = firstHeight;
      }
    }
    candidate.clearance = ok;
    layout = candidate;
    const exhausted = input.reduced ? landing.x >= edge - 4 : ballX >= limit;
    if (ok || exhausted) return layout;
  }
}
