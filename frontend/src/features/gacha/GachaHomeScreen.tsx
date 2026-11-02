import { useCallback, useRef, useState, type ComponentRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Sparkles, Star, Ticket } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { gachaArt } from '@/constants/gacha';
import { useGachaStore } from '@/stores/useGachaStore';
import type { MochiCard } from '@/types/gacha';
import { useGachaStatus } from './useGachaQueries';
import { GachaOddsSheet } from './GachaOddsSheet';

const startPull = (count: number) =>
  router.push({ pathname: '/gacha/opening', params: { count: String(count) } });

// Figma 05 · P-01 / P-01B / P-01C 뽑기 홈, P-05 확률 시트, P-12 중복 별조각.
// 잔액은 서버(GET /gacha/status) 값이다. 받기 전에는 뽑기 버튼을 열지 않는다.
// 상단에는 뽑기권·별조각만 두고, 도감은 마이페이지에서 연다.
export function GachaHomeScreen() {
  const status = useGachaStatus();
  const wallet = useGachaStore(state => state.wallet);
  const tickets = wallet?.tickets ?? 0;
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
    <View style={roomStyles.room}>
      <Image
        accessible={false}
        source={require('../../../assets/gacha/Gacha_back.png')}
        resizeMode="cover"
        style={roomStyles.background}
      />
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={roomStyles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={roomStyles.balances}>
            <RoomBalance
              kind="ticket"
              label={`뽑기권 ${wallet ? wallet.tickets : '-'}`}
            />
            <View ref={target} collapsable={false}>
              <RoomBalance
                kind="star"
                label={`별조각 ${wallet ? wallet.shards : '-'}`}
                onPress={() => router.push('/gacha/exchange')}
              />
            </View>
          </View>
          <View style={roomStyles.machineSpace} pointerEvents="none">
            {pending && (
              <DuplicateFlight
                origin={origin}
                flightStyle={style}
                duplicate={pending.card}
              />
            )}
          </View>
          <View style={roomStyles.controls}>
            {status.isError && !wallet && (
              <StatePanel
                compact
                title="뽑기권을 확인하지 못했어요"
                description="연결 상태를 확인하고 다시 시도해 주세요."
                retry={() => void status.refetch()}
                retryLabel="다시 불러오기"
              />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="확률 보기"
              onPress={() => setOddsOpen(true)}
              style={roomStyles.odds}
            >
              <Sparkles size={15} color={roomInk} />
              <AppText variant="caption" style={roomStyles.ink}>
                확률 보기
              </AppText>
            </Pressable>
            {!wallet ? (
              status.isPending && (
                <View style={roomStyles.loading}>
                  <Loading label="뽑기권을 확인하고 있어요" />
                </View>
              )
            ) : tickets === 0 ? (
              <Button
                label="뽑기권 없음"
                disabled
                onPress={() => undefined}
                style={[roomStyles.drawButton, roomStyles.disabled]}
                labelStyle={roomStyles.disabledLabel}
              />
            ) : (
              <View style={roomStyles.draws}>
                <Button
                  label="1장 · 뽑기권 1"
                  onPress={() => startPull(1)}
                  style={[
                    roomStyles.drawButton,
                    { flex: 1 },
                    multi > 1 && roomStyles.secondaryDraw,
                  ]}
                  labelStyle={roomStyles.ink}
                />
                {multi > 1 && (
                  <Button
                    label={`${multi}장 · 뽑기권 ${multi}`}
                    onPress={() => startPull(multi)}
                    style={[roomStyles.drawButton, { flex: 1 }]}
                    labelStyle={roomStyles.ink}
                  />
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
      <GachaOddsSheet visible={oddsOpen} onClose={() => setOddsOpen(false)} />
    </View>
  );
}

const roomInk = '#754A52';
const roomStyles = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#F9DCE4' },
  background: { position: 'absolute', width: '100%', height: '100%' },
  // The tab bar owns the bottom safe area. Only unusually short screens or
  // enlarged text scroll; on regular phones the controls rest above the tabs.
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  balances: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 249, 245, 0.9)',
    backgroundColor: 'rgba(255, 249, 245, 0.88)',
  },
  ink: { color: roomInk },
  machineSpace: {
    flex: 1,
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: { gap: 12 },
  odds: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 249, 245, 0.9)',
    backgroundColor: 'rgba(255, 249, 245, 0.9)',
  },
  draws: { flexDirection: 'row', gap: 10 },
  drawButton: {
    minHeight: 56,
    paddingHorizontal: 10,
    borderRadius: 22,
    borderColor: '#E4A7B3',
    backgroundColor: 'rgba(255, 249, 245, 0.96)',
    boxShadow: '0 4px 12px rgba(117, 74, 82, 0.16)',
  },
  secondaryDraw: { backgroundColor: '#F9DCE4' },
  disabled: {
    backgroundColor: 'rgba(248, 230, 233, 0.96)',
    borderColor: '#DDBDC5',
    boxShadow: 'none',
  },
  disabledLabel: { color: '#84616A' },
  loading: { borderRadius: 22, backgroundColor: 'rgba(255, 249, 245, 0.94)' },
});

function RoomBalance({
  kind,
  label,
  onPress,
}: {
  kind: 'ticket' | 'star';
  label: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      {kind === 'ticket' ? (
        <Ticket size={15} color={roomInk} />
      ) : (
        <Star size={15} color={roomInk} fill="#EFCB84" />
      )}
      <AppText variant="caption" style={roomStyles.ink}>
        {label}
      </AppText>
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={roomStyles.balance}
    >
      {content}
    </Pressable>
  ) : (
    <View style={roomStyles.balance}>{content}</View>
  );
}

// Only the returned duplicate and its shards are overlaid during the existing
// reward flight. The machine and all idle characters are already in the room art.
function DuplicateFlight({
  origin,
  flightStyle,
  duplicate,
}: {
  origin: ReturnType<typeof useShardFlight>['origin'];
  flightStyle: ReturnType<typeof useShardFlight>['style'];
  duplicate: MochiCard;
}) {
  return (
    <View
      ref={origin}
      collapsable={false}
      style={{ width: 96, aspectRatio: 1 }}
    >
      <Animated.Image
        accessible={false}
        source={{ uri: duplicate.imageUrl }}
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
