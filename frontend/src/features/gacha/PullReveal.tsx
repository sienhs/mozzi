import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { CardImage } from '@/components/gacha/CardImage';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useReducedMotion } from '@/components/ui/Motion';
import {
  CardGrid,
  GachaChip,
  MochiCard,
  pullCardState,
} from '@/components/gacha/GachaUI';
import { gachaArt, tierOrder, tiers } from '@/constants/gacha';
import { colors, fonts } from '@/theme/tokens';
import type { PullItem, Tier } from '@/types/gacha';
import { useGachaStore } from '@/stores/useGachaStore';

// P-04 여러 장 뽑기 결과: 한 장씩 공개한다. 낮은 등급부터 보여 주어 가장 좋은 카드가 마지막에 나온다.
// 일반~영웅은 탭 한 번에 다음 장으로 넘어가고, 전설·신화는 뒤집기 전 기운(색)으로 먼저 알린 뒤
// 섬광·빛줄기·별 터짐으로 공개한다. 연타하다 지나치지 않도록 예고와 공개 직후에는 탭을 잠시 받지 않는다.
// 다 보면 전체 결과를 모아 보여 준다.

const SPECIAL: Tier[] = ['legend', 'myth'];
const isSpecial = (tier: Tier) => SPECIAL.includes(tier);
// 예고 화면에서 탭을 받기 시작할 때까지. 연타가 그대로 카드를 여는 걸 막는다.
export const CHARGE_LOCK_MS = 650;
// 공개 직후 탭을 받지 않는 시간. 연출을 다 보기 전에 다음 장으로 넘어가지 않게 한다.
export const REVEAL_LOCK_MS: Record<'legend' | 'myth', number> = {
  legend: 1300,
  myth: 1700,
};
const rank = (tier: Tier) => tierOrder.indexOf(tier);

// 무대 배경색. 등급이 올라갈수록 색이 짙고 밝아진다(카드보다 먼저 보이는 등급 신호).
const stage: Record<Tier, { glow: string; base: string; ink: string }> = {
  basic: { glow: '#6B5E68', base: '#231A22', ink: '#F3EADC' },
  common: { glow: '#5E6A80', base: '#1D1E27', ink: '#EDF0F4' },
  rare: { glow: '#2F6FD6', base: '#141C33', ink: '#CFE1FF' },
  epic: { glow: '#9A4BE0', base: '#1F1233', ink: '#EBD8FF' },
  legend: { glow: '#F2A93B', base: '#2B1A0A', ink: '#FFE2AE' },
  myth: { glow: '#FF4F8B', base: '#2E0B1C', ink: '#FFD1E2' },
};
const headline: Record<'legend' | 'myth', string> = {
  legend: '전설 등급 획득!',
  myth: '신화 등급 획득!',
};

const native = Platform.OS !== 'web';
function buzz(kind: 'tick' | 'omen' | 'legend' | 'myth') {
  if (!native) return;
  const run =
    kind === 'tick'
      ? Haptics.selectionAsync()
      : kind === 'omen'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : kind === 'legend'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).then(() =>
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              ),
            );
  void run.catch(() => undefined);
}

export function ResultsScreen() {
  const items = useGachaStore(state => state.lastPull);
  // 공개 순서: 등급 오름차순(같은 등급은 받은 순서). 결과 묶음이 바뀌지 않는 한 고정한다.
  const [order] = useState(() =>
    items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => rank(a.item.card.tier) - rank(b.item.card.tier))
      .map(({ item }) => item),
  );
  const [done, setDone] = useState(false);
  if (!items.length) return <Redirect href="/gacha" />;
  if (done || !order.length) return <PullSummary items={items} />;
  return <RevealStage order={order} onFinish={() => setDone(true)} />;
}

type Phase = 'charging' | 'locked' | 'shown';

function RevealStage({
  order,
  onFinish,
}: {
  order: PullItem[];
  onFinish: () => void;
}) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [cursor, setCursor] = useState(0);
  const [phase, setPhaseState] = useState<Phase>(() =>
    isSpecial(order[0].card.tier) ? 'charging' : 'shown',
  );
  // 열어 본 장. 진행 점의 색과 건너뛰기 판단에 쓴다.
  const [seen, setSeen] = useState<boolean[]>(() =>
    order.map((item, i) => i === 0 && !isSpecial(item.card.tier)),
  );
  const [chargeReady, setChargeReady] = useState(false);
  // 탭 처리기는 렌더를 기다리지 않고 지금 상태를 읽는다. 같은 틱의 연타도 한 번만 처리된다.
  const live = useRef({ cursor: 0, phase, chargeReady: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [enter] = useState(() => new Animated.Value(1));
  const [flash] = useState(() => new Animated.Value(0));
  const [burst] = useState(() => new Animated.Value(0));
  const [spin] = useState(() => new Animated.Value(0));
  const [shake] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));

  const item = order[cursor];
  const tier = item.card.tier;
  const special = isSpecial(tier);
  const revealed = phase !== 'charging';
  const palette = stage[tier];

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const setPhase = (next: Phase) => {
    live.current.phase = next;
    setPhaseState(next);
  };
  const markSeen = (index: number) =>
    setSeen(value => value.map((open, i) => open || i === index));

  // 보통 카드: 살짝 뒤집히며 튀어 오른다. 빠르게 넘겨도 끊기지 않게 짧게 둔다.
  const playEnter = (fast: boolean) => {
    enter.stopAnimation();
    if (reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: fast ? 240 : 620,
      easing: fast ? Easing.out(Easing.cubic) : Easing.out(Easing.back(1.6)),
      useNativeDriver: native,
    }).start();
  };
  // 전설·신화를 연다: 섬광 → 카드 확대 → 별 터짐, 그 뒤 잠깐 탭을 받지 않는다.
  const reveal = (index: number) => {
    const current = order[index];
    const key = current.card.tier as 'legend' | 'myth';
    clearTimer();
    shake.stopAnimation();
    shake.setValue(0);
    setPhase('locked');
    markSeen(index);
    buzz(key);
    playEnter(false);
    if (!reduced) {
      flash.setValue(1);
      Animated.timing(flash, {
        toValue: 0,
        duration: key === 'myth' ? 900 : 650,
        easing: Easing.out(Easing.quad),
        useNativeDriver: native,
      }).start();
      burst.setValue(0);
      Animated.timing(burst, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }).start();
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      if (live.current.cursor === index) setPhase('shown');
    }, REVEAL_LOCK_MS[key]);
  };
  // index 장으로 옮긴다. 전설·신화면 예고부터, 아니면 바로 보여 준다.
  const goTo = (index: number) => {
    clearTimer();
    live.current.cursor = index;
    setCursor(index);
    const next = order[index];
    if (isSpecial(next.card.tier)) {
      setPhase('charging');
      live.current.chargeReady = false;
      setChargeReady(false);
      buzz('omen');
      enter.setValue(1);
      timer.current = setTimeout(() => {
        timer.current = null;
        live.current.chargeReady = true;
        setChargeReady(true);
      }, CHARGE_LOCK_MS);
    } else {
      setPhase('shown');
      markSeen(index);
      buzz('tick');
      playEnter(true);
    }
  };
  // 첫 장이 전설·신화면 예고 잠금을 건다.
  useEffect(() => {
    if (live.current.phase !== 'charging') return;
    buzz('omen');
    timer.current = setTimeout(() => {
      timer.current = null;
      live.current.chargeReady = true;
      setChargeReady(true);
    }, CHARGE_LOCK_MS);
  }, []);

  // 화면 어디를 눌러도 이 함수 하나로 간다.
  const tap = () => {
    const { cursor: at, phase: now, chargeReady: ready } = live.current;
    if (now === 'locked') return;
    if (now === 'charging') {
      if (ready) reveal(at);
      return;
    }
    if (at + 1 >= order.length) onFinish();
    else goTo(at + 1);
  };
  // 건너뛰기: 아직 열지 않은 전설·신화에서는 멈춘다(좋은 카드를 놓치지 않게). 없으면 결과로 간다.
  const skip = () => {
    const { cursor: at, phase: now } = live.current;
    if (now === 'charging') {
      reveal(at);
      return;
    }
    const nextSpecial = order.findIndex(
      (candidate, i) => i > at && isSpecial(candidate.card.tier),
    );
    if (nextSpecial >= 0) goTo(nextSpecial);
    else onFinish();
  };

  // 빛줄기는 영웅 이상에서 천천히 돈다. 예고 중에는 카드가 떨리고 기운이 맥박처럼 뛴다.
  const rays = revealed ? rank(tier) >= rank('epic') : special;
  useEffect(() => {
    if (reduced || !rays) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: native,
        isInteraction: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rays, reduced, spin]);
  useEffect(() => {
    if (reduced || phase !== 'charging') return;
    const intense = tier === 'myth';
    const wobble = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 1,
          duration: intense ? 60 : 80,
          useNativeDriver: native,
          isInteraction: false,
        }),
        Animated.timing(shake, {
          toValue: -1,
          duration: intense ? 120 : 160,
          useNativeDriver: native,
          isInteraction: false,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: intense ? 60 : 80,
          useNativeDriver: native,
          isInteraction: false,
        }),
        Animated.delay(intense ? 260 : 420),
      ]),
    );
    const beat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
          isInteraction: false,
        }),
      ]),
    );
    wobble.start();
    beat.start();
    return () => {
      wobble.stop();
      beat.stop();
    };
  }, [phase, cursor, tier, reduced, shake, pulse]);

  const cardWidth = Math.min(width * 0.62, 300, height * 0.36);
  const raySize = Math.max(width, height) * 1.5;
  const last = cursor === order.length - 1;
  const hint =
    phase === 'charging'
      ? chargeReady
        ? '톡! 눌러서 열기'
        : ' '
      : phase === 'locked'
        ? ' '
        : last
          ? '탭해서 결과 모아 보기'
          : '탭해서 다음';
  const label = revealed
    ? `${cursor + 1}번째 보상, ${tiers[tier].label} ${item.card.name}${item.isNew ? ', 새로 만난 모찌' : `, 별조각 ${item.shards}개`}`
    : `${cursor + 1}번째 보상, 아직 열지 않은 특별한 카드`;

  return (
    <View style={[styles.fill, { backgroundColor: palette.base }]}>
      <StatusBar style="light" />
      <StageGlow color={palette.glow} pulse={phase === 'charging'} />
      {rays && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.center,
            {
              opacity: revealed ? 0.9 : 0.55,
              transform: [
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Rays
            size={raySize}
            color={palette.glow}
            count={tier === 'myth' ? 18 : 14}
          />
        </Animated.View>
      )}
      {revealed && tier === 'myth' && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.center,
            {
              opacity: 0.5,
              transform: [
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['360deg', '0deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <Rays size={raySize * 0.8} color="#FFE07A" count={9} />
        </Animated.View>
      )}
      {/* 화면 전체가 입력 영역이다. 위쪽 진행 표시와 건너뛰기는 이 위에 따로 둔다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint.trim() || undefined}
        accessibilityState={{ disabled: phase === 'locked' }}
        onPress={tap}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView pointerEvents="box-none" style={styles.fill}>
        <View pointerEvents="box-none" style={styles.top}>
          <Progress order={order} seen={seen} cursor={cursor} />
          <GachaChip label="건너뛰기" dark width={92} onPress={skip} />
        </View>
        <View pointerEvents="none" style={styles.middle}>
          {special && revealed && (
            <Animated.View
              style={{
                opacity: enter,
                transform: [
                  {
                    translateY: enter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              }}
            >
              <AppText
                style={[
                  styles.headline,
                  {
                    color: palette.ink,
                    textShadowColor: palette.glow,
                  },
                ]}
              >
                {headline[tier as 'legend' | 'myth']}
              </AppText>
            </Animated.View>
          )}
          <Animated.View
            style={{
              transform: [
                {
                  translateX: shake.interpolate({
                    inputRange: [-1, 1],
                    outputRange: tier === 'myth' ? [-9, 9] : [-6, 6],
                  }),
                },
                {
                  scale: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: special ? [0.35, 1] : [0.86, 1],
                  }),
                },
                { perspective: 900 },
                {
                  rotateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: special ? ['0deg', '0deg'] : ['70deg', '0deg'],
                  }),
                },
              ],
              opacity: enter.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0, 1, 1],
              }),
            }}
          >
            {revealed ? (
              <PrizeCard item={item} width={cardWidth} />
            ) : (
              <SealedCard
                tier={tier}
                width={cardWidth}
                pulse={pulse}
                glow={palette.glow}
              />
            )}
          </Animated.View>
          <View style={styles.caption}>
            {revealed ? (
              <>
                <AppText
                  variant="title"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{ color: colors.white, textAlign: 'center' }}
                >
                  {item.card.name}
                </AppText>
                <View style={styles.badges}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: tiers[tier].badge },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={{ color: tiers[tier].color }}
                    >
                      {tiers[tier].label}
                    </AppText>
                  </View>
                  {item.isNew ? (
                    <View style={[styles.badge, styles.newBadge]}>
                      <AppText
                        variant="caption"
                        style={{ color: colors.white }}
                      >
                        NEW
                      </AppText>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.dupBadge]}>
                      <AppText
                        variant="caption"
                        style={{ color: colors.white }}
                      >
                        ✦ 별조각 +{item.shards}
                      </AppText>
                    </View>
                  )}
                </View>
              </>
            ) : null}
          </View>
        </View>
        <View pointerEvents="none" style={styles.bottom}>
          <AppText variant="small" style={{ color: 'rgba(255,255,255,0.72)' }}>
            {hint}
          </AppText>
        </View>
      </SafeAreaView>
      {special && revealed && !reduced && (
        <Sparkles burst={burst} color={palette.ink} />
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: tier === 'myth' ? '#FFE3EE' : '#FFF6DF',
            opacity: flash,
          },
        ]}
      />
    </View>
  );
}

// 위쪽 진행: 연 장은 등급 색으로 채우고, 지금 장은 크게, 아직 안 연 장은 비워 둔다.
function Progress({
  order,
  seen,
  cursor,
}: {
  order: PullItem[];
  seen: boolean[];
  cursor: number;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${order.length}장 중 ${cursor + 1}번째`}
      style={{ flexShrink: 1, gap: 6 }}
    >
      <AppText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
        {cursor + 1} / {order.length}
      </AppText>
      <View style={{ flexDirection: 'row', gap: 5, flexWrap: 'wrap' }}>
        {order.map((item, i) => (
          <View
            key={i}
            style={{
              width: i === cursor ? 16 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: seen[i]
                ? tiers[item.card.tier].color
                : 'rgba(255,255,255,0.18)',
              borderWidth: seen[i] ? 1 : 0,
              borderColor: 'rgba(255,255,255,0.6)',
            }}
          />
        ))}
      </View>
    </View>
  );
}

function StageGlow({ color, pulse }: { color: string; pulse: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="stageGlow" cx="50%" cy="44%" r="62%">
            <Stop
              offset="0"
              stopColor={color}
              stopOpacity={pulse ? 0.75 : 0.62}
            />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.16} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#stageGlow)" />
      </Svg>
    </View>
  );
}

function Rays({
  size,
  color,
  count,
}: {
  size: number;
  color: string;
  count: number;
}) {
  const r = size / 2;
  const gradient = `ray${color.replace(/[^0-9a-z]/gi, '')}`;
  const step = (Math.PI * 2) / count;
  const d = Array.from({ length: count }, (_, i) => {
    const a = i * step;
    const b = a + step * 0.42;
    return `M${r} ${r} L${r + Math.cos(a) * r} ${r + Math.sin(a) * r} L${r + Math.cos(b) * r} ${r + Math.sin(b) * r} Z`;
  }).join(' ');
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={gradient} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Path d={d} fill={`url(#${gradient})`} />
    </Svg>
  );
}

// 별 조각이 가운데서 사방으로 튀어 나간다. 각도와 거리는 고정이라 매번 같은 모양이다.
const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2 + (i % 2 ? 0.18 : 0),
  distance: 130 + ((i * 37) % 90),
  size: 14 + ((i * 11) % 14),
}));
function Sparkles({ burst, color }: { burst: Animated.Value; color: string }) {
  return (
    <View pointerEvents="none" style={styles.center}>
      {SPARKS.map((spark, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            opacity: burst.interpolate({
              inputRange: [0, 0.15, 0.7, 1],
              outputRange: [0, 1, 0.9, 0],
            }),
            transform: [
              {
                translateX: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.cos(spark.angle) * spark.distance],
                }),
              },
              {
                translateY: burst.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.sin(spark.angle) * spark.distance],
                }),
              },
              {
                scale: burst.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0.2, 1.2, 0.6],
                }),
              },
            ],
          }}
        >
          <Image
            source={gachaArt.star}
            accessible={false}
            tintColor={color}
            style={{ width: spark.size, height: spark.size }}
          />
        </Animated.View>
      ))}
    </View>
  );
}

// 아직 열지 않은 전설·신화 카드. 등급 색 기운이 맥박처럼 번진다.
function SealedCard({
  tier,
  width,
  pulse,
  glow,
}: {
  tier: Tier;
  width: number;
  pulse: Animated.Value;
  glow: string;
}) {
  return (
    <View style={{ width, aspectRatio: 278 / 366 }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: 28,
            backgroundColor: glow,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.8],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.04, 1.14],
                }),
              },
            ],
          },
        ]}
      />
      <View
        style={[
          styles.sealed,
          {
            borderColor: tiers[tier].color,
            boxShadow: `0 0 26px ${glow}`,
          },
        ]}
      >
        <View style={[styles.sealedInner, { borderColor: `${glow}88` }]}>
          <AppText style={[styles.sealedMark, { color: glow }]}>✦</AppText>
        </View>
      </View>
    </View>
  );
}

// 공개된 카드 앞면. 1장 결과(P-03)와 같은 종이 카드에 등급 색 테두리와 빛을 더한다.
function PrizeCard({ item, width }: { item: PullItem; width: number }) {
  const { tier, name, imageUrl } = item.card;
  const special = isSpecial(tier);
  return (
    <View
      style={[
        styles.card,
        {
          width,
          borderColor: special ? tiers[tier].color : colors.gachaGold,
          borderWidth: special ? 3 : 2,
          boxShadow: `0 0 ${special ? 34 : 16}px ${stage[tier].glow}`,
        },
      ]}
    >
      <Image
        accessible={false}
        source={gachaArt.frame}
        contentFit="fill"
        style={styles.frame}
      />
      {/* 등급과 NEW는 카드 아래 배지에만 둔다(모서리에 두면 테두리에 걸린다). */}
      <View style={styles.art}>
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: width,
              backgroundColor: tiers[tier].badge,
              transform: [{ scale: 0.86 }],
            },
          ]}
        />
        <CardImage
          full
          accessibilityLabel={name}
          uri={imageUrl}
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    </View>
  );
}

// 다 본 뒤 모아 보기. 좋은 등급부터 놓고, 새로 만난 모찌와 받은 별조각을 한 줄로 알린다.
function PullSummary({ items }: { items: PullItem[] }) {
  const tickets = useGachaStore(state => state.wallet?.tickets ?? 0);
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(b.item.card.tier) - rank(a.item.card.tier))
    .map(({ item }) => item);
  const fresh = items.filter(item => item.isNew).length;
  const shards = items.reduce((sum, item) => sum + item.shards, 0);
  const best = sorted[0].card.tier;
  const again = Math.min(items.length, 10);
  return (
    <Screen
      title={`${items.length}장 뽑기 결과`}
      action={{ icon: 'close', label: '닫기', onPress: () => router.back() }}
      contentStyle={{ gap: 18 }}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label="확인"
            variant="secondary"
            onPress={() => router.back()}
            style={{ flex: 11, minHeight: 54 }}
          />
          <Button
            label={`한 번 더 · ${again}장`}
            disabled={tickets < again}
            onPress={() =>
              router.replace({
                pathname: '/gacha/opening',
                params: { count: String(again) },
              })
            }
            style={{ flex: 17, minHeight: 54 }}
          />
        </View>
      }
    >
      <View style={styles.summary}>
        <SummaryStat
          label="최고 등급"
          value={tiers[best].label}
          color={tiers[best].color}
        />
        <View style={styles.summaryRule} />
        <SummaryStat label="새로 만난 모찌" value={`${fresh}마리`} />
        <View style={styles.summaryRule} />
        <SummaryStat label="받은 별조각" value={`✦ ${shards}`} />
      </View>
      <CardGrid>
        {sorted.map((item, index) => (
          <MochiCard
            key={index}
            state={pullCardState(item)}
            onPress={() =>
              router.push({
                pathname: '/gacha/mochi/[id]',
                params: { id: String(item.card.cardId) },
              })
            }
          />
        ))}
      </CardGrid>
    </Screen>
  );
}
function SummaryStat({
  label,
  value,
  color = colors.ink,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <AppText variant="caption" style={{ color: colors.muted }}>
        {label}
      </AppText>
      <AppText variant="label" style={{ color }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  bottom: { alignItems: 'center', paddingBottom: 28, minHeight: 56 },
  headline: {
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 42,
    textAlign: 'center',
    textShadowRadius: 18,
    textShadowOffset: { width: 0, height: 0 },
  },
  caption: { alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  badges: { flexDirection: 'row', gap: 8 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  newBadge: { backgroundColor: colors.gachaRose },
  dupBadge: { backgroundColor: 'rgba(255,255,255,0.18)' },
  sealed: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    backgroundColor: '#2A2030',
    padding: 8,
  },
  sealedInner: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sealedMark: { fontSize: 64, lineHeight: 76 },
  card: {
    aspectRatio: 278 / 366,
    backgroundColor: colors.white,
    borderRadius: 24,
    justifyContent: 'center',
  },
  frame: {
    position: 'absolute',
    left: -2,
    top: -2,
    width: '101.5%',
    height: '101.1%',
  },
  art: {
    width: '84%',
    aspectRatio: 1,
    alignSelf: 'center',
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: colors.gachaCream,
  },
  summaryRule: { width: 1, height: 28, backgroundColor: colors.line },
});
