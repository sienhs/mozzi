import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { BalanceChip, GachaChip, TierBadge } from '@/components/gacha/GachaUI';
import { gachaArt, mochis, season, tierOrder, tiers } from '@/constants/gacha';
import { colors, spacing } from '@/theme/tokens';
import { useGachaStore } from '@/stores/useGachaStore';

const openCollection = () => router.push('/gacha/collection');
const startPull = (count: number) =>
  router.push({ pathname: '/gacha/opening', params: { count: String(count) } });

// Figma 05 · P-01 / P-01B / P-01C 뽑기 홈, P-05 확률 시트, P-12 중복 별조각.
export function GachaHomeScreen() {
  const tickets = useGachaStore(state => state.tickets);
  const shards = useGachaStore(state => state.shards);
  const pending = useGachaStore(state => state.pendingDuplicate);
  const [oddsOpen, setOddsOpen] = useState(false);
  const { origin, target, play, style } = useShardFlight();
  const multi = Math.min(tickets, 10);
  useFocusEffect(
    useCallback(() => {
      if (pending) play(() => useGachaStore.getState().applyDuplicate());
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pending]),
  );
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View
        style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }}
      >
        <View
          style={{
            minHeight: 56,
            paddingHorizontal: spacing.page,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AppText
            variant="heading"
            accessibilityRole="header"
            style={{ flex: 1 }}
          >
            모찌 뽑기
          </AppText>
          <BalanceChip label={`뽑기권 ${tickets}`} />
          <View ref={target} collapsable={false}>
            <BalanceChip
              label={`별조각 ${shards}`}
              onPress={() => router.push('/gacha/exchange')}
            />
          </View>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: spacing.page,
            paddingTop: spacing.md,
            paddingBottom: spacing.page,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="small" style={{ color: colors.primary }}>
              {season}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="모찌 도감"
              onPress={openCollection}
              hitSlop={12}
            >
              <AppText variant="small">모찌 도감 ›</AppText>
            </Pressable>
          </View>
          <NightRoom
            origin={origin}
            flightStyle={style}
            duplicate={pending?.id}
          />
          <GachaChip
            label="확률 보기"
            width={150}
            onPress={() => setOddsOpen(true)}
          />
        </ScrollView>
        <View
          style={{
            paddingHorizontal: spacing.page,
            paddingTop: spacing.md,
            paddingBottom: spacing.lg,
            gap: spacing.md,
          }}
        >
          {tickets === 0 ? (
            <Button
              label="뽑기권 없음"
              disabled
              onPress={() => undefined}
              style={{ minHeight: 54 }}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button
                label="1장 · 뽑기권 1"
                variant={multi > 1 ? 'secondary' : 'primary'}
                onPress={() => startPull(1)}
                style={{ flex: 1, minHeight: 54 }}
              />
              {multi > 1 && (
                <Button
                  label={`${multi}장 · 뽑기권 ${multi}`}
                  onPress={() => startPull(multi)}
                  style={{ flex: 1, minHeight: 54 }}
                />
              )}
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="모찌 도감 보기"
            onPress={openCollection}
            style={{
              minHeight: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="small">모찌 도감 {' '}›</AppText>
          </Pressable>
        </View>
      </View>
      <OddsSheet visible={oddsOpen} onClose={() => setOddsOpen(false)} />
    </SafeAreaView>
  );
}

function NightRoom({
  origin,
  flightStyle,
  duplicate,
}: {
  origin: ReturnType<typeof useShardFlight>['origin'];
  flightStyle: ReturnType<typeof useShardFlight>['style'];
  duplicate?: keyof typeof mochis;
}) {
  return (
    <View
      accessibilityLabel="유리병 속에서 빛을 모으는 모찌"
      style={{
        width: '100%',
        aspectRatio: 350 / 324,
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      <Image
        accessible={false}
        source={gachaArt.room}
        style={{ width: '100%', height: '100%' }}
      />
      <View
        style={{
          position: 'absolute',
          left: '30.9%',
          top: '42%',
          width: '38.3%',
          aspectRatio: 1,
          opacity: duplicate ? 0 : 1,
        }}
      >
        <Image
          accessibilityLabel="유리병 속 기본 모찌"
          source={gachaArt.mochi}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
      {duplicate && (
        <View
          ref={origin}
          collapsable={false}
          style={{
            position: 'absolute',
            left: '36.3%',
            top: '52.5%',
            width: '27.4%',
            aspectRatio: 1,
          }}
        >
          <Animated.Image
            accessible={false}
            source={mochis[duplicate].source}
            resizeMode="contain"
            style={[{ width: '100%', height: '100%' }, flightStyle(0)]}
          />
          {[14, 12, 10].map((size, index) => (
            <Animated.Image
              key={size}
              accessible={false}
              source={gachaArt.star}
              style={[
                {
                  position: 'absolute',
                  left: `${19 + index * 19}%`,
                  top: `${19 - index * 10}%`,
                  width: size,
                  height: size,
                },
                flightStyle(index + 1),
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// P-12A 흩어짐 → B 이동 → C 반영. Reduce motion keeps only the fade.
function useShardFlight() {
  const origin = useRef<ComponentRef<typeof View>>(null);
  const target = useRef<ComponentRef<typeof View>>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const [still, setStill] = useState(false);
  const play = (done: () => void) => {
    progress.setValue(0);
    void AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      setStill(reduce);
      const run = () =>
        Animated.sequence([
          Animated.delay(reduce ? 240 : 600),
          Animated.timing(progress, {
            toValue: 1,
            duration: reduce ? 220 : 600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]).start(() => done());
      let started = false;
      const go = () => {
        if (started) return;
        started = true;
        run();
      };
      // If a measurement never arrives, the shards still land (just without travel).
      setTimeout(go, 150);
      origin.current?.measureInWindow((ox, oy, ow, oh) => {
        target.current?.measureInWindow((tx, ty, tw, th) => {
          setDelta({
            x: tx + tw / 2 - (ox + ow / 2),
            y: ty + th / 2 - (oy + oh / 2),
          });
          go();
        });
      });
    });
  };
  const style = (layer: number) => {
    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [1, layer === 0 ? 0 : 0.15],
    });
    if (still) return { opacity };
    return {
      opacity,
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, delta.x],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, delta.y],
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, layer === 0 ? 0.08 : 0.4],
          }),
        },
      ],
    };
  };
  return { origin, target, play, style };
}

function OddsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="등급별 획득 확률">
      <AppText variant="small">
        {season} {' '}/{' '} 1회 뽑기 기준
      </AppText>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row' }}>
          <AppText variant="caption" style={{ width: 128 }}>
            등급
          </AppText>
          <AppText variant="caption" style={{ flex: 1 }}>
            확률
          </AppText>
          <AppText variant="caption" style={{ textAlign: 'right' }}>
            중복 시 별조각
          </AppText>
        </View>
        {tierOrder.map(tier => (
          <View
            key={tier}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <View style={{ width: 128 }}>
              <TierBadge tier={tier} />
            </View>
            <AppText variant="label" style={{ flex: 1 }}>
              {tiers[tier].odds}%
            </AppText>
            <AppText variant="small" style={{ textAlign: 'right' }}>
              +{tiers[tier].duplicateShards}
            </AppText>
          </View>
        ))}
      </View>
      <View
        style={{
          backgroundColor: colors.bg,
          borderRadius: 20,
          padding: 16,
          gap: 8,
        }}
      >
        <AppText variant="small" style={{ color: colors.ink }}>
          매번 같은 등급 확률로 뽑아요.
        </AppText>
        <AppText variant="small">
          {'천장·등급 확정은 없어요.\n전설·신화는 미보유 모찌가 우선 등장해요.'}
        </AppText>
      </View>
      <Button label="확인" onPress={onClose} />
    </Sheet>
  );
}
