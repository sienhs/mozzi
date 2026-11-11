import { useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from './reanimated';
import type { MotionPhase } from './careModel';
import { clamp } from './careGeometry';
import { curve, sampleScene, SCENE_DURATION } from './careChoreography';
import type { SceneLayout } from './careChoreography';
import { expressionIndex, visibleLayers } from './careExpressions';
import type { ExpressionTable } from './careExpressions';
import { ASSISTED_PET_DURATION } from './careController';

const BLINK = expressionIndex('blink'),
  PET_HAPPY = expressionIndex('pet-happy');
const ATTENTIVE = expressionIndex('attentive'),
  EAT_OPEN = expressionIndex('eat-open'),
  NEUTRAL = expressionIndex('neutral');
const BLINK_PERIOD = 3800,
  BLINK_LENGTH = 140;
const linear = { easing: Easing.linear, reduceMotion: ReduceMotion.Never };

type Options = {
  phase: MotionPhase;
  interactionId: number;
  reducedMotion: boolean;
  /** Preview or keyboard/screen-reader petting: the hand strokes on its own. */
  scripted: boolean;
  layout: SceneLayout;
  table: ExpressionTable;
  body: { centerX: number; top: number; width: number; height: number };
};

/** Scripted stroke used by the pet preview and the assisted (keyboard / screen reader) path. */
function scriptedStroke(t: number) {
  'worklet';
  const pressure = curve(t, [
    [0, 0],
    [250, 1],
    [ASSISTED_PET_DURATION - 300, 1],
    [ASSISTED_PET_DURATION, 0],
  ]);
  return { pressure, sway: Math.sin(t / 260) };
}

/**
 * One clock per interaction drives the body, its expression layers and every prop; idle blinking
 * runs on its own loop. Touch-driven petting values are shared values written by input handlers.
 */
export function useCareMotion({
  phase,
  interactionId,
  reducedMotion,
  scripted,
  layout,
  table,
  body,
}: Options) {
  const clock = useSharedValue(0),
    idle = useSharedValue(0),
    breath = useSharedValue(0);
  const pressure = useSharedValue(0),
    tilt = useSharedValue(0),
    skew = useSharedValue(0);
  const touchX = useSharedValue(0),
    touchY = useSharedValue(0);
  const attention = useSharedValue(0),
    look = useSharedValue(0);

  useEffect(() => {
    for (const value of [
      clock,
      idle,
      breath,
      pressure,
      tilt,
      skew,
      attention,
      look,
    ])
      cancelAnimation(value);
    clock.set(0);
    pressure.set(0);
    tilt.set(0);
    skew.set(0);
    attention.set(0);
    look.set(0);
    breath.set(0);
    idle.set(0);
    const duration =
      phase === 'pet'
        ? scripted
          ? ASSISTED_PET_DURATION
          : 0
        : SCENE_DURATION[phase];
    // The scene clock ignores the OS reduce-motion flag: props still move so the action stays legible.
    if (duration) clock.set(withTiming(duration, { duration, ...linear }));
    if (phase === 'idle') {
      idle.set(
        withRepeat(
          withTiming(BLINK_PERIOD, { duration: BLINK_PERIOD, ...linear }),
          -1,
          false,
        ),
      );
      if (!reducedMotion)
        breath.set(
          withRepeat(
            withSequence(
              withTiming(1, { duration: 1700 }),
              withTiming(0, { duration: 1700 }),
            ),
            -1,
          ),
        );
    }
    return () => {
      for (const value of [clock, idle, breath, pressure, tilt, skew])
        cancelAnimation(value);
    };
  }, [
    phase,
    interactionId,
    reducedMotion,
    scripted,
    clock,
    idle,
    breath,
    pressure,
    tilt,
    skew,
    attention,
    look,
  ]);

  const pose = useDerivedValue(() => sampleScene(phase, clock.value, layout));

  /** Bitmask of visible expression layers for this frame. */
  const face = useDerivedValue(() => {
    const p = pose.value;
    let expression = p.expression,
      elapsed = clock.value - p.expressionStart;
    if (phase === 'idle') {
      elapsed = 0;
      if (attention.value >= 2) expression = EAT_OPEN;
      else if (attention.value >= 1) expression = ATTENTIVE;
      else if (idle.value > BLINK_PERIOD - BLINK_LENGTH) {
        expression = BLINK;
        elapsed = idle.value - (BLINK_PERIOD - BLINK_LENGTH);
      }
    } else if (phase === 'pet') {
      const pr = scripted
        ? scriptedStroke(clock.value).pressure
        : pressure.value;
      expression = pr > 0.35 ? PET_HAPPY : NEUTRAL;
      elapsed = 0;
    }
    return visibleLayers(table, expression, elapsed);
  });

  const bodyStyle = useAnimatedStyle(() => {
    if (reducedMotion)
      return {
        transform: [
          { translateX: 0 },
          { translateY: 0 },
          { rotate: '0deg' },
          { skewX: '0deg' },
          { scaleX: 1 },
          { scaleY: 1 },
        ],
      };
    const p = pose.value;
    let pr = 0,
      lean = 0,
      shear = 0;
    if (phase === 'pet') {
      if (scripted) {
        const s = scriptedStroke(clock.value);
        pr = s.pressure;
        lean = s.sway * 2.5 * s.pressure;
        shear = s.sway * 1.5 * s.pressure;
      } else {
        pr = pressure.value;
        lean = tilt.value;
        shear = skew.value;
      }
    } else if (phase === 'idle') lean = look.value * 3;
    return {
      transform: [
        { translateX: p.x },
        { translateY: p.y },
        { rotate: `${p.rotate + lean}deg` },
        { skewX: `${shear}deg` },
        { scaleX: p.scaleX * (1 + pr * 0.02) },
        { scaleY: p.scaleY * (1 + breath.value * 0.008) * (1 - pr * 0.03) },
      ],
    };
  });

  const shadowStyle = useAnimatedStyle(() => {
    const p = pose.value,
      height = Math.max(0, -p.y);
    return {
      opacity: 0.22 + (1 - height / 100) * 0.18,
      transform: [
        { translateX: p.x },
        { scaleX: Math.max(0.5, 1 - height / 90) },
        { scaleY: Math.max(0.5, 1 - height / 110) },
      ],
    };
  });

  const handStyle = useAnimatedStyle(() => {
    if (scripted && phase === 'pet') {
      const s = scriptedStroke(clock.value);
      return {
        opacity: s.pressure,
        transform: [
          { translateX: body.centerX - 27 + s.sway * body.width * 0.22 },
          { translateY: body.top + body.height * 0.22 - 54 },
          { rotate: `${s.sway * 6}deg` },
        ],
      };
    }
    // The touch point is the heel of the palm, so the hand reaches up and the reacting face stays visible.
    return {
      opacity: phase === 'pet' ? Math.max(0.0001, pressure.value) : 0,
      transform: [
        { translateX: touchX.value - 27 },
        { translateY: touchY.value - 54 },
        { rotate: `${tilt.value * 3}deg` },
      ],
    };
  });

  return {
    clock,
    pose,
    face,
    bodyStyle,
    shadowStyle,
    handStyle,
    attention,
    look,
    touch(x: number, y: number, velocityX: number, stepX: number) {
      touchX.set(x);
      touchY.set(y);
      pressure.set(withSpring(1, { damping: 18 }));
      if (reducedMotion) return;
      tilt.set(
        withSpring(clamp(stepX * 0.5, -4, 4), { damping: 15, stiffness: 180 }),
      );
      // The top of the body trails the stroke a little (a jelly shear), capped so crowns keep their shape.
      skew.set(
        withSpring(clamp(-velocityX * 2.2, -3, 3), {
          damping: 14,
          stiffness: 160,
        }),
      );
    },
    release() {
      tilt.set(withSpring(0, { damping: 7, stiffness: 140 }));
      skew.set(withSpring(0, { damping: 6, stiffness: 150 }));
      pressure.set(withTiming(0, { duration: 380 }));
    },
  };
}
export type CareMotion = ReturnType<typeof useCareMotion>;
