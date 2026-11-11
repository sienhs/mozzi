import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type {
  GestureResponderEvent,
  LayoutChangeEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from './reanimated';
import type { SharedValue } from './reanimated';
import type { CareAction, MotionPhase } from './careModel';
import type { CareSkin } from './careSkin';
import { buildPlayLayout, mouthFeedTarget } from './careChoreography';
import type { Band, PlayLayout, Point, SceneLayout } from './careChoreography';
import { compileExpressionTable, mouthAnchor } from './careExpressions';
import type { ExpressionLayer } from './careExpressions';
import { clamp, fitSkin, playSize, stageBands } from './careGeometry';
import type { SkinFrame } from './careGeometry';
import { petProgress } from './careModel';
import { useCareMotion } from './useCareMotion';
import type { CareMotion } from './useCareMotion';
import { Ball, ContactBurst, Cookie, Heart, PetHand, Plate } from './CareProps';

const STAGE_HEIGHT = 360;
const BALL_RADIUS = 20;
const CRUMBS: readonly (readonly [number, number, number])[] = [
  [-70, -90, 4],
  [-30, -140, 5],
  [10, -120, 4],
  [45, -150, 5],
  [80, -80, 4],
  [-100, -40, 3],
  [110, -50, 3],
];

type Props = {
  skin: CareSkin;
  phase: MotionPhase;
  mode: CareAction;
  interactionId: number;
  round: number;
  /** Keyboard/screen-reader petting: the hand strokes on its own. */
  scripted: boolean;
  enabled: boolean;
  reducedMotion: boolean;
  ballLabel: string;
  onPetStart: () => void;
  onPetProgress: (value: number) => void;
  onPetEnd: (completed: boolean) => void;
  onPetAssist: () => void;
  onFeed: () => void;
  onThrow: () => void;
  onImageError: () => void;
};

type Gesture = {
  kind: 'pet' | 'feed' | 'ball' | null;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  startT: number;
  distance: number;
  moves: number;
  trail: number;
};

function insideBands(bands: readonly Band[], x: number, y: number) {
  return bands.some(
    b => x >= b.left && x <= b.right && y >= b.top && y <= b.bottom,
  );
}

function restingPlay(origin: Point, floor: number): PlayLayout {
  const dock = { x: 10 + BALL_RADIUS, y: floor - BALL_RADIUS };
  return {
    side: 1,
    reach: 0,
    recoil: 0,
    lean: 1,
    radius: BALL_RADIUS,
    floor,
    dock,
    landing: dock,
    contactBall: dock,
    pop: dock,
    throwHeight: dock.y,
    returnHeight: dock.y,
    clearance: true,
  };
}

// 표정 레이어는 같은 이미지 비율로 만든 것만 쓴다.
function usableSet(skin: CareSkin) {
  const set = skin.expressions;
  if (!set) return null;
  return set.canvas.width === skin.geometry.width &&
    set.canvas.height === skin.geometry.height
    ? set
    : null;
}

export function CareStage(props: Props) {
  const [width, setWidth] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  // 썸네일을 받지 못하면 원본 주소로 한 번 다시 시도한다.
  const [useFallback, setUseFallback] = useState(false);
  const [feedFrom, setFeedFrom] = useState<Point | null>(null);
  const gesture = useRef<Gesture>({
    kind: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    startT: 0,
    distance: 0,
    moves: 0,
    trail: 0,
  });
  const dragX = useSharedValue(0),
    dragY = useSharedValue(0),
    dragging = useSharedValue(0),
    hot = useSharedValue(0);
  const trail = useHeartTrail();

  const size =
    props.mode === 'play' || props.phase === 'play'
      ? playSize(props.skin.geometry, Math.max(1, width), STAGE_HEIGHT)
      : 0.9;
  const stage = useMemo(() => {
    const frame = fitSkin(
      props.skin.geometry,
      Math.max(1, width),
      STAGE_HEIGHT,
      size,
    );
    const bands = stageBands(props.skin.geometry, frame);
    const origin = { x: frame.left + frame.width / 2, y: frame.baseline };
    const set = usableSet(props.skin);
    const anchor = mouthAnchor(set);
    const R = clamp(frame.width * 0.12, 18, 28);
    const mouth = anchor
      ? {
          x: frame.left + frame.imageLeft + anchor.x * frame.scale,
          y: frame.top + frame.imageTop + anchor.y * frame.scale,
          height: anchor.height * frame.scale,
          width: anchor.width * frame.scale,
        }
      : null;
    // With a known mouth the snack is held to it; otherwise it rests on a plate in front (shared fallback).
    const target = mouth
      ? mouthFeedTarget(mouth, R)
      : { x: origin.x, y: frame.baseline - R * 0.55 };
    const dock = { x: 18 + R, y: frame.baseline - R - 6 };
    return {
      frame,
      bands,
      origin,
      set,
      table: compileExpressionTable(set),
      R,
      mouth,
      target,
      dock,
    };
  }, [props.skin, width, size]);
  const { frame, bands, origin, set, R, target, dock } = stage;

  const play = useMemo(
    () =>
      props.mode === 'play' && width > 0
        ? buildPlayLayout({
            stageWidth: width,
            floor: frame.baseline,
            origin,
            bands,
            radius: BALL_RADIUS,
            round: props.round,
            reduced: props.reducedMotion,
          })
        : restingPlay(origin, frame.baseline),
    [props.mode, props.round, props.reducedMotion, width, frame, origin, bands],
  );
  const layout: SceneLayout = useMemo(
    () => ({
      origin,
      play,
      reduced: props.reducedMotion,
      feed: {
        from: feedFrom ?? dock,
        target,
        attached: !!stage.mouth,
        radius: R,
      },
    }),
    [origin, play, props.reducedMotion, feedFrom, dock, target, stage.mouth, R],
  );

  const motion = useCareMotion({
    phase: props.phase,
    interactionId: props.interactionId,
    reducedMotion: props.reducedMotion,
    scripted: props.scripted,
    layout,
    table: stage.table,
    body: {
      centerX: origin.x,
      top: frame.top,
      width: frame.width,
      height: frame.height,
    },
  });

  const canAct = props.enabled && loadedId === props.skin.key && width > 0;
  const nearRadius = Math.max(70, R * 3.2),
    dropRadius = Math.max(40, R * 1.8);

  function resetDrag(animated: boolean) {
    dragX.set(animated ? withSpring(0, { damping: 16 }) : 0);
    dragY.set(animated ? withSpring(0, { damping: 16 }) : 0);
    dragging.set(withTiming(0, { duration: 150 }));
    hot.set(0);
    motion.attention.set(0);
    motion.look.set(withSpring(0));
  }

  function start(event: GestureResponderEvent) {
    if (!canAct) return false;
    const { locationX: x, locationY: y } = event.nativeEvent;
    const kind =
      props.mode === 'pet'
        ? insideBands(bands, x, y)
          ? 'pet'
          : null
        : props.mode === 'feed'
          ? Math.hypot(x - dock.x, y - dock.y) <= R + 14
            ? 'feed'
            : null
          : Math.hypot(x - play.dock.x, y - play.dock.y) <= BALL_RADIUS + 16
            ? 'ball'
            : null;
    gesture.current.kind = kind;
    return kind !== null;
  }

  function grant(event: GestureResponderEvent) {
    const { locationX: x, locationY: y } = event.nativeEvent;
    const now = Date.now();
    Object.assign(gesture.current, {
      startX: x,
      startY: y,
      lastX: x,
      lastY: y,
      lastT: now,
      startT: now,
      distance: 0,
      moves: 0,
      trail: 0,
    });
    if (gesture.current.kind === 'pet') {
      props.onPetStart();
      props.onPetProgress(0);
      motion.touch(x, y, 0, 0);
    }
    if (gesture.current.kind === 'feed') {
      dragging.set(withTiming(1, { duration: 120 }));
      motion.attention.set(1);
    }
  }

  function move(event: GestureResponderEvent) {
    const g = gesture.current,
      { locationX: x, locationY: y } = event.nativeEvent;
    if (g.kind === 'pet') {
      const now = Date.now(),
        step = Math.hypot(x - g.lastX, y - g.lastY);
      const velocityX = (x - g.lastX) / Math.max(8, now - g.lastT);
      if (step >= 2) {
        g.distance += Math.min(step, 40);
        g.moves++;
        g.trail += step;
      }
      g.lastX = x;
      g.lastY = y;
      g.lastT = now;
      motion.touch(x, y, velocityX, velocityX * 7);
      if (g.trail > 55) {
        g.trail = 0;
        trail.spawn(x, y - 18);
      }
      props.onPetProgress(
        petProgress({
          durationMs: now - g.startT,
          distancePx: g.distance,
          moveCount: g.moves,
        }),
      );
    } else if (g.kind === 'feed') {
      g.lastX = x;
      g.lastY = y;
      const dx = x - g.startX,
        dy = y - g.startY;
      dragX.set(dx);
      dragY.set(dy);
      const distance = Math.hypot(
        dock.x + dx - target.x,
        dock.y + dy - target.y,
      );
      motion.attention.set(distance < nearRadius ? 2 : 1);
      motion.look.set(
        withSpring(clamp((dock.x + dx - origin.x) / 160, -1, 1), {
          damping: 18,
        }),
      );
      hot.set(distance < dropRadius ? 1 : 0);
    }
  }

  function release() {
    const g = gesture.current;
    if (g.kind === 'pet') {
      motion.release();
      props.onPetEnd(
        petProgress({
          durationMs: Date.now() - g.startT,
          distancePx: g.distance,
          moveCount: g.moves,
        }) >= 1,
      );
    } else if (g.kind === 'feed') {
      const dx = g.lastX - g.startX,
        dy = g.lastY - g.startY;
      const at = { x: dock.x + dx, y: dock.y + dy };
      if (Math.hypot(dx, dy) < 8) {
        setFeedFrom(dock);
        props.onFeed();
        resetDrag(false);
      } else if (Math.hypot(at.x - target.x, at.y - target.y) < dropRadius) {
        setFeedFrom(at);
        props.onFeed();
        resetDrag(false);
      } else resetDrag(true);
    } else if (g.kind === 'ball') props.onThrow();
    g.kind = null;
  }

  function terminate() {
    const g = gesture.current;
    if (g.kind === 'pet') {
      motion.release();
      props.onPetEnd(false);
    }
    if (g.kind === 'feed') resetDrag(true);
    g.kind = null;
  }

  const feeding = props.phase === 'feed',
    playing = props.phase === 'play';
  const idleIn = (mode: CareAction) =>
    props.mode === mode && (props.phase === 'idle' || props.phase === 'pet');
  return (
    <View
      testID="mochi-stage"
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      style={[styles.stage, { height: STAGE_HEIGHT }]}
    >
      <View style={[styles.floor, { top: frame.baseline + 6 }]} />
      {width > 0 && (
        <>
          <Animated.View
            style={[
              styles.shadow,
              {
                left: origin.x - Math.min(90, frame.width * 0.35),
                top: frame.baseline - 6,
                width: Math.min(180, frame.width * 0.7),
              },
              motion.shadowStyle,
            ]}
          />
          {props.mode === 'pet' && (
            <FocusPressable
              testID="pet-assist"
              accessibilityRole="button"
              accessibilityLabel="모찌 쓰다듬기 (자동 동작)"
              disabled={!canAct}
              onPress={props.onPetAssist}
              style={{
                position: 'absolute',
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                borderRadius: 24,
              }}
            />
          )}
          <Animated.View
            testID="mochi-body"
            style={[
              styles.none,
              {
                position: 'absolute',
                left: frame.left,
                top: frame.top,
                width: frame.width,
                height: frame.height,
                transformOrigin: 'center bottom',
              },
              motion.bodyStyle,
            ]}
          >
            <Image
              source={
                useFallback && props.skin.fallbackSource
                  ? props.skin.fallbackSource
                  : props.skin.source
              }
              contentFit="fill"
              transition={0}
              cachePolicy="memory-disk"
              accessibilityLabel={props.skin.name}
              onLoad={() => setLoadedId(props.skin.key)}
              onError={() => {
                if (!useFallback && props.skin.fallbackSource)
                  setUseFallback(true);
                else props.onImageError();
              }}
              style={{
                position: 'absolute',
                left: frame.imageLeft,
                top: frame.imageTop,
                width: frame.imageWidth,
                height: frame.imageHeight,
              }}
            />
            {set?.layers.map((layer, index) => (
              <FaceLayer
                key={layer.id}
                layer={layer}
                index={index}
                face={motion.face}
                frame={frame}
              />
            ))}
          </Animated.View>
          {/* Fallback plate is a foreground prop: drawn in front of the body. */}
          {props.mode === 'feed' && !stage.mouth && (
            <View
              style={[
                styles.none,
                {
                  position: 'absolute',
                  left: origin.x - 55,
                  top: frame.baseline - 22,
                },
              ]}
            >
              <Plate />
            </View>
          )}
          {props.mode === 'feed' && (
            <DropHint
              target={target}
              size={
                stage.mouth ? Math.max(R * 2, stage.mouth.width * 1.6) : 120
              }
              dragging={dragging}
              hot={hot}
            />
          )}
          {idleIn('feed') && (
            <DockedCookie
              dock={dock}
              R={R}
              dragX={dragX}
              dragY={dragY}
              disabled={!canAct}
              onPress={() => {
                setFeedFrom(dock);
                props.onFeed();
              }}
            />
          )}
          {feeding && <SceneCookie motion={motion} R={R} />}
          {CRUMBS.map((crumb, i) => (
            <Crumb
              key={i}
              motion={motion}
              crumb={crumb}
              floor={frame.baseline}
            />
          ))}
          {props.mode === 'play' && !playing && (
            <FocusPressable
              testID="throw-ball"
              accessibilityRole="button"
              accessibilityLabel={props.ballLabel}
              disabled={!canAct || props.phase !== 'idle'}
              onPress={props.onThrow}
              style={{
                position: 'absolute',
                left: play.dock.x - BALL_RADIUS,
                top: play.dock.y - BALL_RADIUS,
                borderRadius: BALL_RADIUS,
              }}
            >
              <Ball size={BALL_RADIUS * 2} />
            </FocusPressable>
          )}
          {playing && <SceneBall motion={motion} floor={frame.baseline} />}
          <Hearts motion={motion} origin={origin} top={frame.top} />
          {props.phase === 'pet' && (
            <Animated.View
              testID="pet-hand"
              style={[styles.none, styles.corner, motion.handStyle]}
            >
              <PetHand />
            </Animated.View>
          )}
          <TrailHearts slots={trail.slots} />
          <View
            testID="gesture-surface"
            accessible={false}
            style={StyleSheet.absoluteFill}
            onStartShouldSetResponder={start}
            onMoveShouldSetResponder={() => false}
            onResponderGrant={grant}
            onResponderMove={move}
            onResponderRelease={release}
            onResponderTerminate={terminate}
            onResponderTerminationRequest={() =>
              gesture.current.kind !== 'feed' && gesture.current.kind !== 'pet'
            }
          />
        </>
      )}
    </View>
  );
}

/** Keyboard/screen-reader control with a visible focus ring (pointer input goes to the gesture surface). */
function FocusPressable({
  style,
  ...rest
}: Omit<PressableProps, 'style'> & { style: StyleProp<ViewStyle> }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...rest}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, focused && styles.focus]}
    />
  );
}

function FaceLayer({
  layer,
  index,
  face,
  frame,
}: {
  layer: ExpressionLayer;
  index: number;
  face: SharedValue<number>;
  frame: SkinFrame;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: (face.value >> index) & 1,
  }));
  return (
    <Animated.View
      testID={`face-layer-${layer.id}`}
      style={[
        styles.none,
        {
          position: 'absolute',
          left: frame.imageLeft + layer.x * frame.scale,
          top: frame.imageTop + layer.y * frame.scale,
          width: layer.width * frame.scale,
          height: layer.height * frame.scale,
        },
        style,
      ]}
    >
      <Image
        source={layer.source}
        contentFit="fill"
        transition={0}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function DropHint({
  target,
  size,
  dragging,
  hot,
}: {
  target: Point;
  size: number;
  dragging: SharedValue<number>;
  hot: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: dragging.value * (0.45 + hot.value * 0.55),
    transform: [{ scale: 1 + hot.value * 0.08 }],
  }));
  return (
    <Animated.View
      testID="feed-target"
      style={[
        styles.none,
        styles.hint,
        {
          left: target.x - size / 2,
          top: target.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    />
  );
}

function DockedCookie({
  dock,
  R,
  dragX,
  dragY,
  disabled,
  onPress,
}: {
  dock: Point;
  R: number;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  disabled: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));
  return (
    <>
      <View
        style={[
          styles.none,
          {
            position: 'absolute',
            left: dock.x - R * 1.35,
            top: dock.y + R * 0.45,
          },
        ]}
      >
        <Plate width={R * 2.7} />
      </View>
      <Animated.View
        style={[
          { position: 'absolute', left: dock.x - R, top: dock.y - R },
          style,
        ]}
      >
        <FocusPressable
          testID="dock-cookie"
          accessibilityRole="button"
          accessibilityLabel="간식 주기"
          disabled={disabled}
          onPress={onPress}
          style={{ borderRadius: R }}
        >
          <Cookie size={R * 2} />
        </FocusPressable>
      </Animated.View>
    </>
  );
}

function SceneCookie({ motion, R }: { motion: CareMotion; R: number }) {
  const style = useAnimatedStyle(() => {
    const p = motion.pose.value;
    return {
      opacity: p.propVisible,
      transform: [
        { translateX: p.propX - R },
        { translateY: p.propY - R },
        { rotate: `${p.propRotate}deg` },
        { scale: p.propScaleX },
      ],
    };
  });
  return (
    <Animated.View
      testID="scene-cookie"
      style={[
        styles.none,
        styles.corner,
        { width: R * 2, height: R * 2 },
        style,
      ]}
    >
      {([0, 1, 2] as const).map(n => (
        <BiteVariant key={n} motion={motion} n={n} size={R * 2} />
      ))}
    </Animated.View>
  );
}

/** The cookie with 0, 1 or 2 bites; exactly one variant is visible, switched on the scene clock. */
function BiteVariant({
  motion,
  n,
  size,
}: {
  motion: CareMotion;
  n: 0 | 1 | 2;
  size: number;
}) {
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(2, Math.floor(motion.pose.value.bites)) === n ? 1 : 0,
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, animated]}>
      <Cookie size={size} bites={n} />
    </Animated.View>
  );
}

function Crumb({
  motion,
  crumb,
  floor,
}: {
  motion: CareMotion;
  crumb: readonly [number, number, number];
  floor: number;
}) {
  const [vx, vy, size] = crumb;
  const style = useAnimatedStyle(() => {
    const p = motion.pose.value;
    if (p.crumbAge < 0)
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }] };
    const s = p.crumbAge / 1000;
    const y = Math.min(floor - size, p.crumbY + vy * s + 0.5 * 900 * s * s);
    return {
      opacity: Math.max(0, 1 - p.crumbAge / 760),
      transform: [
        { translateX: p.crumbX + vx * s },
        { translateY: y },
        { rotate: `${p.crumbAge * 0.6}deg` },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.none,
        styles.corner,
        {
          width: size,
          height: size,
          borderRadius: 1.5,
          backgroundColor: '#B9814A',
        },
        style,
      ]}
    />
  );
}

function SceneBall({ motion, floor }: { motion: CareMotion; floor: number }) {
  const ball = useAnimatedStyle(() => {
    const p = motion.pose.value;
    return {
      opacity: p.propVisible,
      transform: [
        { translateX: p.propX - BALL_RADIUS },
        { translateY: p.propY - BALL_RADIUS },
        { rotate: `${p.propRotate}deg` },
        { scaleX: p.propScaleX },
        { scaleY: p.propScaleY },
      ],
    };
  });
  const shadow = useAnimatedStyle(() => {
    const p = motion.pose.value,
      height = Math.max(0, floor - BALL_RADIUS - p.propY);
    return {
      opacity: p.propVisible * Math.max(0.08, 0.3 - height / 600),
      transform: [
        { translateX: p.propX - 16 },
        { translateY: floor - 4 },
        { scale: Math.max(0.4, 1 - height / 260) },
      ],
    };
  });
  const burst = useAnimatedStyle(() => {
    const p = motion.pose.value;
    return {
      opacity: p.contact,
      transform: [
        { translateX: p.contactX - 17 },
        { translateY: p.contactY - 17 },
        { scale: 0.6 + p.contact * 0.6 },
      ],
    };
  });
  return (
    <>
      <Animated.View
        style={[
          styles.none,
          styles.corner,
          { width: 32, height: 8, borderRadius: 4, backgroundColor: '#B8A991' },
          shadow,
        ]}
      />
      <Animated.View
        testID="scene-ball"
        style={[
          styles.none,
          styles.corner,
          { width: BALL_RADIUS * 2, height: BALL_RADIUS * 2 },
          ball,
        ]}
      >
        <Ball size={BALL_RADIUS * 2} />
      </Animated.View>
      <Animated.View
        testID="contact-burst"
        style={[styles.none, styles.corner, burst]}
      >
        <ContactBurst />
      </Animated.View>
    </>
  );
}

function Hearts({
  motion,
  origin,
  top,
}: {
  motion: CareMotion;
  origin: Point;
  top: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = motion.pose.value;
    return {
      opacity: p.effect,
      transform: [
        { translateX: origin.x + p.x - 46 },
        { translateY: top + p.y - 30 - p.effect * 14 },
      ],
    };
  });
  return (
    <Animated.View
      testID="hearts"
      style={[
        styles.none,
        styles.corner,
        { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
        style,
      ]}
    >
      <Heart size={18} />
      <Heart size={28} />
      <Heart size={15} />
    </Animated.View>
  );
}

type TrailSlot = readonly [
  SharedValue<number>,
  SharedValue<number>,
  SharedValue<number>,
];

/** Small hearts left along a stroke while petting (three recycled slots). */
function useHeartTrail() {
  const a0 = useSharedValue(1),
    a1 = useSharedValue(1),
    a2 = useSharedValue(1);
  const x0 = useSharedValue(0),
    x1 = useSharedValue(0),
    x2 = useSharedValue(0);
  const y0 = useSharedValue(0),
    y1 = useSharedValue(0),
    y2 = useSharedValue(0);
  const next = useRef(0);
  const slots: readonly TrailSlot[] = useMemo(
    () => [
      [a0, x0, y0],
      [a1, x1, y1],
      [a2, x2, y2],
    ],
    [a0, a1, a2, x0, x1, x2, y0, y1, y2],
  );
  return {
    slots,
    spawn(x: number, y: number) {
      const [age, sx, sy] = slots[next.current % 3]!;
      next.current++;
      sx.set(x);
      sy.set(y);
      age.set(0);
      age.set(withTiming(1, { duration: 900 }));
    },
  };
}

function TrailHearts({ slots }: { slots: readonly TrailSlot[] }) {
  return (
    <>
      {slots.map(([age, x, y], i) => (
        <TrailHeart key={i} age={age} x={x} y={y} />
      ))}
    </>
  );
}

function TrailHeart({
  age,
  x,
  y,
}: {
  age: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: age.value >= 1 ? 0 : 1 - age.value,
    transform: [
      { translateX: x.value - 8 },
      { translateY: y.value - age.value * 34 },
      { scale: 0.7 + age.value * 0.4 },
    ],
  }));
  return (
    <Animated.View style={[styles.none, styles.corner, style]}>
      <Heart size={16} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#F8F4EC',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#EEE8DC',
    borderTopWidth: 1,
    borderTopColor: '#E8E0D2',
    pointerEvents: 'none',
  },
  shadow: {
    position: 'absolute',
    height: 14,
    borderRadius: 100,
    backgroundColor: '#B8A991',
    pointerEvents: 'none',
  },
  none: { pointerEvents: 'none' },
  corner: { position: 'absolute', left: 0, top: 0 },
  hint: {
    position: 'absolute',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A65E46',
  },
  focus: { outlineWidth: 3, outlineStyle: 'solid', outlineColor: '#4D7A9A' },
});
