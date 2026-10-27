import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import {
  BalanceChip,
  CardGrid,
  GachaChip,
  MochiCard,
  TierBadge,
  pullCardState,
} from '@/components/gacha/GachaUI';
import {
  gachaArt,
  getOpeningClip,
  highestTier,
  mochiName,
  openingClips,
  mochiOrder,
  mochis,
  season,
  tiers,
  type OpeningClip,
} from '@/constants/gacha';
import { colors } from '@/theme/tokens';
import type { MochiId } from '@/types/gacha';
import {
  exchangeCandidate,
  exchangeCost,
  useGachaStore,
} from '@/stores/useGachaStore';

const isMochi = (id: unknown): id is MochiId =>
  typeof id === 'string' && id in mochis;
const openDetail = (id: MochiId) =>
  router.push({ pathname: '/gacha/mochi/[id]', params: { id } });
const toCollection = () => router.replace('/gacha/collection');
const fixed = { minHeight: 54 };

// P-02 개봉: 뽑기 요청이 끝나면 개봉 영상을 틀고, 빛이 터지는 순간 하얗게 번쩍이며 결과로 넘어간다.
// 화면 아무 곳이나 '건너뛰기'를 누르면 결과가 온 뒤 바로 넘어간다.
export function OpeningScreen() {
  const params = useLocalSearchParams<{ count?: string }>();
  const count = Math.max(
    1,
    Math.min(10, Math.floor(Number(params.count) || 1)),
  );
  const [result, setResult] = useState<'pending' | 'done' | 'failed'>(
    'pending',
  );
  const [flash] = useState(() => new Animated.Value(0));
  const [clip, setClip] = useState<OpeningClip>(openingClips.basic);
  // 결과를 받기 전에는 영상을 로드하지 않는다. 확정된 최고 등급 영상만 준비한다.
  const player = useVideoPlayer(null, video => {
    video.muted = true;
    video.loop = false;
    video.timeUpdateEventInterval = 0.05;
  });
  const started = useRef(false);
  const finished = useRef(false);
  const begun = useRef(false);
  const mounted = useRef(true);
  const reduceMotion = useRef(false);
  const beatsDone = useRef(new Set<number>());
  const sourceLoaded = useRef(false);

  // 영상 재생 중 결과 화면으로 넘어간다. 한 번만 실행된다.
  const go = () => {
    if (result === 'failed') {
      router.replace({
        pathname: '/gacha/failed',
        params: { count: String(count) },
      });
      return;
    }
    const items = useGachaStore.getState().lastPull;
    if (count > 1) router.replace('/gacha/results');
    else if (items[0]?.isNew) router.replace('/gacha/reveal');
    // A single duplicate goes home, where its shards fly to the chip (P-12).
    else router.back();
  };
  const finish = () => {
    if (result === 'pending' || finished.current) return;
    finished.current = true;
    player.pause();
    if (result === 'failed' || reduceMotion.current) {
      go();
      return;
    }
    Animated.timing(flash, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start(() => {
      if (mounted.current) go();
    });
  };
  // 영상이 재생 준비가 된 뒤에 시작점으로 옮기고 튼다(준비 전에 옮기면 무시될 수 있다).
  const begin = () => {
    if (
      !sourceLoaded.current ||
      player.status !== 'readyToPlay' ||
      begun.current ||
      finished.current ||
      !mounted.current
    )
      return;
    begun.current = true;
    // currentTime을 직접 쓰지 않는 건 React 컴파일러 규칙 때문. 처음(0초)에서 앞으로 옮긴다.
    if (clip.startAt > 0) player.seekBy(clip.startAt);
    player.play();
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (count > useGachaStore.getState().tickets) {
      router.back();
      return;
    }
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        reduceMotion.current = reduce;
      })
      .catch(() => undefined)
      .finally(() => {
        if (cancelled) return;
        useGachaStore
          .getState()
          .pull(count)
          .then(items => {
            if (cancelled) return;
            if (items.length) {
              setClip(getOpeningClip(highestTier(items.map(item => item.id))));
              setResult('done');
            } else setResult('failed');
          })
          .catch(() => {
            if (!cancelled) setResult('failed');
          });
      });
    return () => {
      cancelled = true;
    };
  }, [count]);

  // 한 묶음에 영상은 한 번만 재생한다. 실패/동작 줄이기는 영상 없이 결과로 이동한다.
  useEffect(() => {
    if (result === 'pending') return;
    if (result === 'failed' || reduceMotion.current) {
      finish();
      return;
    }
    let cancelled = false;
    // 비동기 교체 완료와 재생 가능 상태를 둘 다 확인해 이전/빈 소스 재생을 막는다.
    void player
      .replaceAsync(clip.source)
      .then(() => {
        if (cancelled || !mounted.current || finished.current) return;
        sourceLoaded.current = true;
        begin();
      })
      .catch(() => {
        if (!cancelled && mounted.current) finish();
      });
    // 재생 오류나 종료 이벤트 누락 시에도 뽑기 결과를 잃지 않는다.
    const fallback = setTimeout(
      finish,
      (clip.duration - clip.startAt + 3) * 1000,
    );
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, clip]);

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!begun.current || finished.current) return;
    for (const beat of clip.beats) {
      if (
        beat.at >= clip.startAt &&
        currentTime >= beat.at &&
        !beatsDone.current.has(beat.at)
      ) {
        beatsDone.current.add(beat.at);
        pulse(beat.strength);
      }
    }
    if (currentTime >= clip.flashAt) finish();
  });
  useEventListener(player, 'playToEnd', finish);
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay' && result === 'done') begin();
    if (status === 'error') finish();
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.gachaCocoa }}>
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { alignItems: 'center' }]}
      >
        <View style={styles.stage}>
          <Image
            accessible={false}
            source={clip.poster}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          <VideoView
            player={player}
            nativeControls={false}
            contentFit="cover"
            playsInline
            // Android: TextureView라야 위에 얹은 번쩍임·버튼이 영상과 제대로 겹친다.
            surfaceType="textureView"
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
      {/* The whole scene skips too; it sits behind the chip so buttons don't nest. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="모찌 개봉 중, 눌러서 건너뛰기"
        onPress={finish}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView
        pointerEvents="box-none"
        style={{ paddingHorizontal: 20, paddingTop: 6 }}
      >
        <GachaChip label="건너뛰기" dark width={98} onPress={finish} />
      </SafeAreaView>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: colors.white, opacity: flash },
        ]}
      />
    </View>
  );
}

// 진동은 휴대폰에서만. 웹이나 진동이 없는 기기에서는 조용히 넘어간다.
function pulse(strength: 'light' | 'medium' | 'heavy') {
  if (Platform.OS === 'web') return;
  const style = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
  }[strength];
  void Haptics.impactAsync(style).catch(() => undefined);
}

const styles = StyleSheet.create({
  // 영상은 2:3. 넓은 화면(웹)에서도 위아래가 과하게 잘리지 않게 앱 화면 폭(600)까지만 채운다.
  stage: { flex: 1, width: '100%', maxWidth: 600, overflow: 'hidden' },
});

// P-03 새로운 모찌 · 1장.
export function RevealScreen() {
  const item = useGachaStore(state => state.lastPull[0]);
  const tickets = useGachaStore(state => state.tickets);
  if (!item) return <Redirect href="/gacha" />;
  const { tier } = mochis[item.id];
  return (
    <Screen
      action={{ icon: 'close', label: '닫기', onPress: () => router.back() }}
      contentStyle={{ alignItems: 'center', gap: 32, paddingTop: 48 }}
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            label="확인"
            variant="secondary"
            onPress={() => router.back()}
            style={{ flex: 11, ...fixed }}
          />
          <Button
            label="한 번 더 · 1장"
            disabled={tickets < 1}
            onPress={() =>
              router.replace({
                pathname: '/gacha/opening',
                params: { count: '1' },
              })
            }
            style={{ flex: 23, ...fixed }}
          />
        </View>
      }
    >
      <View
        accessibilityLabel={`새로운 모찌, ${tiers[tier].label} ${mochiName(item.id)}`}
        style={{
          width: '71.3%',
          maxWidth: 320,
          aspectRatio: 278 / 366,
          backgroundColor: colors.white,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: colors.gachaGold,
          shadowColor: '#4D3B29',
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 16 },
          elevation: 6,
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 6,
            right: 6,
            top: 6,
            bottom: 6,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.gachaCream,
          }}
        />
        <Image
          accessible={false}
          source={gachaArt.frame}
          resizeMode="stretch"
          style={{
            position: 'absolute',
            left: -2,
            top: -2,
            width: '101.5%',
            height: '101.1%',
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 18,
          }}
        >
          <AppText variant="caption" style={{ color: colors.gachaRose }}>
            NEW
          </AppText>
          <AppText variant="caption" style={{ color: tiers[tier].color }}>
            {tiers[tier].label}
          </AppText>
        </View>
        <View
          style={{
            width: '88.5%',
            aspectRatio: 1,
            alignSelf: 'center',
            marginTop: 30,
          }}
        >
          <Image
            accessible={false}
            source={mochis[item.id].source}
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {mochiName(item.id)}
      </AppText>
    </Screen>
  );
}

// P-04 / P-04B / P-04C: 2~10장은 봉인된 카드로 시작해 하나씩 또는 모두 연다.
export function ResultsScreen() {
  const items = useGachaStore(state => state.lastPull);
  const [opened, setOpened] = useState<boolean[]>(() => items.map(() => false));
  if (!items.length) return <Redirect href="/gacha" />;
  const remaining = opened.filter(open => !open).length;
  return (
    <Screen
      title={`${items.length}장 뽑기 결과`}
      action={{ icon: 'close', label: '닫기', onPress: () => router.back() }}
      footer={
        remaining ? (
          <Button
            label={`남은 ${remaining}장 모두 열기`}
            onPress={() => setOpened(items.map(() => true))}
            style={fixed}
          />
        ) : (
          <Button
            label="확인 · 도감으로"
            onPress={toCollection}
            style={fixed}
          />
        )
      }
    >
      <CardGrid>
        {items.map((item, index) =>
          opened[index] ? (
            <MochiCard
              key={index}
              state={pullCardState(item)}
              onPress={() => openDetail(item.id)}
            />
          ) : (
            <MochiCard
              key={index}
              state={{ kind: 'sealed' }}
              onPress={() =>
                setOpened(value => value.map((open, i) => open || i === index))
              }
            />
          ),
        )}
      </CardGrid>
    </Screen>
  );
}

// P-06 모찌 도감.
export function CollectionScreen() {
  const owned = useGachaStore(state => state.owned);
  const unseen = useGachaStore(state => state.unseen);
  const shards = useGachaStore(state => state.shards);
  const [filter, setFilter] = useState<'all' | 'missing'>('all');
  const list = mochiOrder.filter(id => filter === 'all' || !owned.includes(id));
  return (
    <Screen
      title="모찌 도감"
      back
      contentStyle={{ gap: 12 }}
      footer={
        <Button
          label={`✦ ${shards}  ·  별조각으로 모찌 만나기`}
          onPress={() => router.push('/gacha/exchange')}
          style={fixed}
        />
      }
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <GachaChip
          label="전체"
          width={62}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <GachaChip
          label="미보유"
          width={72}
          active={filter === 'missing'}
          onPress={() => setFilter('missing')}
        />
        <GachaChip label="과일 모찌" width={100} />
      </View>
      {list.length ? (
        <CardGrid>
          {list.map(id =>
            owned.includes(id) ? (
              <MochiCard
                key={id}
                state={{ kind: 'owned', id, isNew: unseen.includes(id) }}
                onPress={() => openDetail(id)}
              />
            ) : (
              <MochiCard key={id} state={{ kind: 'locked', id }} />
            ),
          )}
        </CardGrid>
      ) : (
        <AppText style={{ color: colors.muted, textAlign: 'center' }}>
          모든 모찌를 만났어요.
        </AppText>
      )}
    </Screen>
  );
}

// P-07 모찌 상세.
export function MochiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const owned = useGachaStore(state => state.owned);
  useEffect(() => {
    if (isMochi(id)) useGachaStore.getState().markSeen(id);
  }, [id]);
  if (!isMochi(id) || !owned.includes(id))
    return <Redirect href="/gacha/collection" />;
  return (
    <Screen
      title="모찌 도감"
      back
      footer={
        <Button
          label="도감으로 돌아가기"
          onPress={() => router.back()}
          style={fixed}
        />
      }
    >
      <MochiFeature id={id} size={246}>
        <AppText variant="small">{season}</AppText>
      </MochiFeature>
    </Screen>
  );
}
function MochiFeature({
  id,
  size,
  chip,
  children,
}: {
  id: MochiId;
  size: number;
  chip?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: 20,
        padding: 16,
        gap: 12,
        alignItems: 'center',
      }}
    >
      {chip ?? <TierBadge tier={mochis[id].tier} />}
      <Image
        accessibilityLabel={mochiName(id)}
        source={mochis[id].source}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
      <AppText variant="heading">{mochiName(id)}</AppText>
      {children}
    </View>
  );
}

// P-08 별조각으로 만나기.
export function ExchangeScreen() {
  const owned = useGachaStore(state => state.owned);
  const shards = useGachaStore(state => state.shards);
  const id = exchangeCandidate(owned);
  const cost = id ? exchangeCost(id) : 0;
  return (
    <Screen title="별조각으로 만나기" back contentStyle={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="small">내 별조각</AppText>
        <BalanceChip label={`✦ ${shards}`} compact />
      </View>
      {id ? (
        <>
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <Image
              accessibilityLabel={mochiName(id)}
              source={mochis[id].source}
              resizeMode="contain"
              style={{ width: 100, height: 100 }}
            />
            <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
              <TierBadge tier={mochis[id].tier} />
              <AppText variant="label">{mochiName(id)}</AppText>
              <AppText variant="small">필요한 별조각 {cost}</AppText>
            </View>
          </View>
          <Button
            label={
              shards < cost
                ? '별조각이 부족해요'
                : `${mochiName(id)} 교환   ✦ ${cost}`
            }
            disabled={shards < cost}
            onPress={() =>
              router.push({
                pathname: '/gacha/exchange-confirm',
                params: { id },
              })
            }
            style={fixed}
          />
        </>
      ) : (
        <AppText style={{ color: colors.muted, textAlign: 'center' }}>
          모든 모찌를 만났어요.
        </AppText>
      )}
    </Screen>
  );
}

// P-09 교환 확인.
export function ExchangeConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shards = useGachaStore(state => state.shards);
  const owned = useGachaStore(state => state.owned);
  const [busy, setBusy] = useState(false);
  // Judge ownership on entry only; the exchange adds the mochi before we move on.
  const [ownedOnEntry] = useState(() => isMochi(id) && owned.includes(id));
  if (!isMochi(id) || ownedOnEntry)
    return <Redirect href="/gacha/collection" />;
  const cost = exchangeCost(id);
  const rows: [string, string][] = [
    ['보유 별조각', String(shards)],
    ['사용할 별조각', `−${cost}`],
    ['교환 후', String(shards - cost)],
  ];
  return (
    <Screen
      title="별조각 교환"
      back
      contentStyle={{ gap: 12 }}
      footer={
        <>
          <Button
            label="교환하기"
            loading={busy}
            disabled={shards < cost}
            onPress={() => {
              setBusy(true);
              void useGachaStore
                .getState()
                .exchange(id)
                .then(() =>
                  router.replace({
                    pathname: '/gacha/exchanged',
                    params: { id },
                  }),
                )
                .finally(() => setBusy(false));
            }}
            style={fixed}
          />
          <Button
            label="취소"
            variant="secondary"
            disabled={busy}
            onPress={() => router.back()}
            style={fixed}
          />
        </>
      }
    >
      <MochiFeature id={id} size={220} />
      <View
        style={{
          backgroundColor: colors.gachaCream,
          borderRadius: 20,
          padding: 16,
          gap: 8,
        }}
      >
        {rows.map(([label, value]) => (
          <View
            key={label}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <AppText variant="small">{label}</AppText>
            <AppText variant="label">{value}</AppText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

// P-13 교환 완료.
export function ExchangedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shards = useGachaStore(state => state.shards);
  if (!isMochi(id)) return <Redirect href="/gacha/collection" />;
  const backToCollection = () => router.dismissTo('/gacha/collection');
  return (
    <Screen
      title="모찌 도감"
      action={{ icon: 'close', label: '닫기', onPress: backToCollection }}
      contentStyle={{ gap: 12 }}
      footer={
        <Button label="도감으로" onPress={backToCollection} style={fixed} />
      }
    >
      <MochiFeature
        id={id}
        size={220}
        chip={
          <View
            style={{
              width: 110,
              paddingVertical: 5,
              borderRadius: 12,
              alignItems: 'center',
              backgroundColor: colors.sageSoft,
            }}
          >
            <AppText variant="caption" style={{ color: colors.gachaSageInk }}>
              새로운 만남
            </AppText>
          </View>
        }
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="small">남은 별조각</AppText>
        <AppText variant="label" style={{ color: colors.primary }}>
          ✦ {shards}
        </AppText>
      </View>
    </Screen>
  );
}

// P-11 요청 실패.
export function GachaFailedScreen() {
  const params = useLocalSearchParams<{ count?: string }>();
  return (
    <Screen
      title="모찌 뽑기"
      back
      contentStyle={{ paddingTop: 36 }}
      footer={
        <>
          <Button
            label="다시 시도"
            onPress={() =>
              router.replace({
                pathname: '/gacha/opening',
                params: { count: params.count ?? '1' },
              })
            }
            style={fixed}
          />
          <Button
            label="돌아가기"
            variant="secondary"
            onPress={() => router.back()}
            style={fixed}
          />
        </>
      }
    >
      <View
        accessibilityRole="alert"
        style={{
          backgroundColor: colors.white,
          borderRadius: 20,
          padding: 16,
          gap: 12,
          alignItems: 'center',
        }}
      >
        <Image
          accessible={false}
          source={gachaArt.error}
          style={{ width: 150, height: 150 }}
        />
        <AppText variant="heading">다시 시도해 주세요</AppText>
        <AppText style={{ color: colors.muted, textAlign: 'center' }}>
          {'뽑기권은 사용되지 않았어요.\n연결을 확인하고 다시 시도해 주세요.'}
        </AppText>
      </View>
    </Screen>
  );
}
