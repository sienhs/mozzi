import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useEventListener } from 'expo';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlbumCover,
  AlbumChip,
  AlbumCard,
} from '@/components/gacha/CollectionAlbum';
import { CozyScreen, CozyButton } from '@/components/ui/CozyUI';
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
import { ErrorBanner, Loading, StatePanel } from '@/components/ui/Feedback';
import {
  gachaArt,
  getOpeningClip,
  highestTier,
  OPENING_BACKDROP,
  OPENING_INTRO_SECONDS,
  openingClips,
  tiers,
  tierOrder,
  type OpeningClip,
} from '@/constants/gacha';
import { colors } from '@/theme/tokens';
import type { MochiCard as Card, Tier } from '@/types/gacha';
import { useGachaStore } from '@/stores/useGachaStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { gachaApi, gachaKeys } from '@/services/gachaApi';
import { apiErrorMessage } from '@/services/authErrors';
import { queryClient } from '@/services/queryClient';
import { useCollection } from './useGachaQueries';

// 화면 경로의 카드 ID.
const cardIdOf = (id: unknown) => {
  const value = Number(id);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
};
const openDetail = (cardId: number) =>
  router.push({
    pathname: '/gacha/mochi/[id]',
    params: { id: String(cardId) },
  });
const fixed = { minHeight: 54 };

type OpeningPhase =
  'loading' | 'intro' | 'awaitingInteraction' | 'continuation' | 'completed';
// 옆으로 이만큼(논리 단위) 끌면 손을 떼기 전에 바로 잇는다.
const DRAG_TO_CONTINUE = 36;
// 탭으로 볼 손가락 이동 한도.
const TAP_SLOP = 10;
// 재생 위치가 이 시간 동안 나아가지 않으면 재생 오류로 보고 결과로 넘어간다.
// 입력 대기와 백그라운드에서는 세지 않는다.
const STALL_MS = 8000;
const setupOpeningPlayer = (video: VideoPlayer) => {
  video.muted = true;
  video.loop = false;
  // 영상 자체가 이미 1.5배속이라 다시 빠르게 틀지 않는다.
  video.playbackRate = 1;
  video.timeUpdateEventInterval = 0.25;
};

// P-02 개봉: 뽑기 결과가 확정되면 최고 등급의 연출을 튼다. 앞 3초(intro)가 끝나면
// 한 번의 탭이나 옆 드래그를 기다렸다가 남은 11초(continuation)를 끝까지 틀고 결과로 간다.
// 화면 입력은 영상만 잇고, 결과로 바로 가는 것은 오른쪽 위 '건너뛰기'뿐이다. 어느 쪽도 다시 뽑지 않는다.
export function OpeningScreen() {
  const params = useLocalSearchParams<{ count?: string }>();
  const count = Math.max(
    1,
    Math.min(10, Math.floor(Number(params.count) || 1)),
  );
  const { width, height } = useWindowDimensions();
  const [result, setResult] = useState<'pending' | 'done' | 'failed'>(
    'pending',
  );
  const [clip, setClip] = useState<OpeningClip>(openingClips.base);
  const [phase, setPhaseState] = useState<OpeningPhase>('loading');
  // 각 영상의 첫 프레임이 실제로 그려졌는지. 그 전까지는 같은 장면의 정지 이미지로 덮는다.
  const [introShown, setIntroShown] = useState(false);
  const [continuationShown, setContinuationShown] = useState(false);
  const [continuationMoving, setContinuationMoving] = useState(false);
  // 소스 교체가 끝난 영상. 그 뒤에야 VideoView를 붙이고, 붙은 다음(effect)에 재생한다.
  // 웹 VideoView는 소스가 바뀐 채 다시 그려지면 영상을 새로 불러와 진행 중인 play()를 끊고,
  // 웹 플레이어의 교체는 이미 붙은 영상을 바로 재생하기 때문이다.
  const [sourced, setSourced] = useState({
    intro: false,
    continuation: false,
  });
  // 결과를 받기 전에는 영상을 로드하지 않는다. 두 플레이어를 함께 준비해 입력 직후 바로 잇는다.
  const intro = useVideoPlayer(null, setupOpeningPlayer);
  const continuation = useVideoPlayer(null, setupOpeningPlayer);
  // 이벤트 처리기와 타이머는 렌더를 기다리지 않고 지금 단계를 읽어야 해서 ref에 함께 둔다.
  // 입력을 받는 순간 여기서 단계가 바뀌므로, 같은 틱의 연속 탭·드래그 뒤 손 떼기는 모두 막힌다.
  const phaseRef = useRef<OpeningPhase>('loading');
  const outcome = useRef<'pending' | 'done' | 'failed'>('pending');
  const started = useRef(false);
  const loadStarted = useRef(false);
  const loaded = useRef({ intro: false, continuation: false });
  const continuationStarted = useRef(false);
  const finished = useRef(false);
  const mounted = useRef(true);
  const reduceMotion = useRef(false);
  const foreground = useRef(AppState.currentState !== 'background');
  const touchFrom = useRef<{ x: number; y: number } | null>(null);
  const watching = useRef(false);
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTime = useRef(-1);

  const setPhase = (next: OpeningPhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  };
  const go = () => {
    if (outcome.current === 'failed') {
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
  const stopWatch = () => {
    watching.current = false;
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = null;
  };
  // 재생·준비 중에만 멈춤을 감시한다. 위치가 나아갈 때마다 다시 센다.
  const watch = () => {
    stopWatch();
    watching.current = true;
    lastTime.current = -1;
    if (foreground.current) stallTimer.current = setTimeout(stalled, STALL_MS);
  };
  // 결과 화면으로 한 번만 이동한다. 재생을 마쳤거나 실패하면 마지막 장면을 덮어 둔다.
  const finish = (showEnd: boolean) => {
    if (finished.current || !mounted.current) return;
    finished.current = true;
    stopWatch();
    intro.pause();
    continuation.pause();
    if (showEnd) setPhase('completed');
    go();
  };
  const startIntro = () => {
    if (
      phaseRef.current !== 'loading' ||
      !loaded.current.intro ||
      finished.current ||
      !foreground.current
    )
      return;
    setPhase('intro');
    intro.play();
    watch();
  };
  const introEnded = () => {
    if (phaseRef.current !== 'intro' || finished.current) return;
    stopWatch();
    intro.pause();
    setPhase('awaitingInteraction');
  };
  const playContinuation = () => {
    if (
      phaseRef.current !== 'continuation' ||
      continuationStarted.current ||
      !loaded.current.continuation ||
      finished.current ||
      !foreground.current
    )
      return;
    continuationStarted.current = true;
    continuation.play();
    watch();
  };
  // 결과가 확정된 뒤에만 건너뛴다. 영상만 멈추고 같은 결과로 이동하며, 다시 뽑지 않는다.
  const skip = () => {
    if (outcome.current === 'done') finish(false);
  };
  // 탭·드래그·접근성 동작이 모두 이 함수 하나로 이어진다.
  const proceed = () => {
    if (phaseRef.current !== 'awaitingInteraction') return;
    setPhase('continuation');
    if (Platform.OS !== 'web')
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined,
      );
    // 아직 준비 중이면 대기 이미지를 둔 채 준비되는 즉시 튼다.
    watch();
    playContinuation();
  };
  // intro 종료 이벤트만 놓쳤으면 입력 대기로 간다. 그 밖의 멈춤은 정지 이미지를 두고 결과로 간다.
  const stalled = () => {
    stallTimer.current = null;
    if (!mounted.current || finished.current) return;
    if (
      phaseRef.current === 'intro' &&
      intro.currentTime >= OPENING_INTRO_SECONDS - 0.25
    )
      introEnded();
    else finish(true);
  };
  const progressed = (currentTime: number) => {
    if (!watching.current || currentTime <= lastTime.current) return;
    watch();
    lastTime.current = currentTime;
  };

  useEffect(() => {
    mounted.current = true;
    // Strict Mode의 effect 재실행으로 지운 감시 타이머를 되살린다.
    if (watching.current && !stallTimer.current && foreground.current)
      stallTimer.current = setTimeout(stalled, STALL_MS);
    return () => {
      mounted.current = false;
      if (stallTimer.current) clearTimeout(stallTimer.current);
      stallTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const memberId = useAuthStore.getState().member?.memberId;
    const wallet = useGachaStore.getState().wallet;
    // 잔액을 이미 알면 모자란 요청은 보내지 않는다. 모르면 서버가 판단한다.
    if (memberId === undefined || (wallet && count > wallet.tickets)) {
      router.back();
      return;
    }
    // 이 effect는 한 번만 요청을 보낸다. Strict Mode의 정리 단계에서 응답을 버리지 않도록
    // 취소 여부는 effect 지역 변수가 아니라 mounted로 판단한다.
    const settle = (next: 'done' | 'failed') => {
      outcome.current = next;
      if (mounted.current) setResult(next);
    };
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        reduceMotion.current = reduce;
      })
      .catch(() => undefined)
      .finally(() => {
        if (!mounted.current) return;
        useGachaStore
          .getState()
          .pull(memberId, count)
          .then(items => {
            if (items.length)
              setClip(
                getOpeningClip(highestTier(items.map(item => item.card.tier))),
              );
            settle(items.length ? 'done' : 'failed');
          })
          .catch(() => settle('failed'));
      });
  }, [count]);

  // 한 묶음에 연출은 한 번만 재생한다. 실패·동작 줄이기는 영상 없이 결과로 이동한다.
  useEffect(() => {
    if (result === 'pending' || loadStarted.current) return;
    loadStarted.current = true;
    if (result === 'failed' || reduceMotion.current) {
      finish(false);
      return;
    }
    watch();
    const load = (key: 'intro' | 'continuation') =>
      (key === 'intro' ? intro : continuation)
        .replaceAsync(clip[key])
        .then(() => {
          if (mounted.current && !finished.current)
            setSourced(value => ({ ...value, [key]: true }));
        })
        .catch(() => finish(true));
    void load('intro');
    void load('continuation');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, clip]);

  // VideoView가 붙은 뒤에 튼다. 준비 전에 불러도 세 플랫폼 모두 준비되는 대로 재생한다.
  useEffect(() => {
    if (finished.current) return;
    loaded.current = sourced;
    startIntro();
    playContinuation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourced]);

  // 백그라운드에서는 멈추고, 돌아오면 그 단계와 위치에서 잇는다. 입력 대기는 그대로 기다린다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        foreground.current = false;
        if (stallTimer.current) clearTimeout(stallTimer.current);
        stallTimer.current = null;
        intro.pause();
        continuation.pause();
        return;
      }
      if (state !== 'active' || foreground.current) return;
      foreground.current = true;
      if (!mounted.current || finished.current) return;
      const current = phaseRef.current;
      if (current === 'loading') {
        watch();
        startIntro();
      } else if (current === 'intro') {
        intro.play();
        watch();
      } else if (current === 'continuation') {
        watch();
        if (continuationStarted.current) continuation.play();
        else playContinuation();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEventListener(intro, 'statusChange', ({ status }) => {
    if (status === 'error' && outcome.current === 'done') finish(true);
  });
  useEventListener(intro, 'timeUpdate', ({ currentTime }) => {
    if (phaseRef.current !== 'intro') return;
    progressed(currentTime);
    if (currentTime > 0.1) setIntroShown(true);
  });
  useEventListener(intro, 'playToEnd', introEnded);
  useEventListener(continuation, 'statusChange', ({ status }) => {
    if (status === 'error' && outcome.current === 'done') finish(true);
  });
  useEventListener(continuation, 'timeUpdate', ({ currentTime }) => {
    if (phaseRef.current !== 'continuation') return;
    progressed(currentTime);
    // 첫 프레임 콜백을 못 받은 플랫폼에서도 영상이 흐르기 시작하면 대기 이미지를 걷는다.
    if (currentTime > 0.1) {
      setContinuationShown(true);
      setContinuationMoving(true);
    }
  });
  useEventListener(continuation, 'playingChange', ({ isPlaying }) => {
    if (isPlaying && phaseRef.current === 'continuation')
      setContinuationMoving(true);
  });
  useEventListener(continuation, 'playToEnd', () => {
    if (phaseRef.current === 'continuation') finish(true);
  });

  const still = openingStill(
    phase,
    clip,
    introShown,
    continuationShown && continuationMoving,
  );
  const awaiting = phase === 'awaitingInteraction';
  // 9:16 장면 전체를 화면 안에 담는다. 남는 쪽은 장면과 어울리는 단색으로 둔다.
  const stageWidth = Math.min(width, (height * 9) / 16);
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: OPENING_BACKDROP,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <StatusBar style="light" />
      <View
        pointerEvents="none"
        style={{
          width: stageWidth,
          height: (stageWidth * 16) / 9,
          overflow: 'hidden',
        }}
      >
        {sourced.intro && (
          <VideoView
            testID="opening-intro-video"
            player={intro}
            nativeControls={false}
            contentFit="contain"
            playsInline
            // Android: 영상 둘과 정지 이미지를 겹쳐 그리려면 TextureView여야 한다.
            surfaceType="textureView"
            onFirstFrameRender={() => setIntroShown(true)}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* continuation은 미리 붙여 두되 차례가 오기 전에는 보이지 않게 intro 위에 둔다. */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity:
                phase === 'continuation' || phase === 'completed' ? 1 : 0,
            },
          ]}
        >
          {sourced.continuation && (
            <VideoView
              testID="opening-continuation-video"
              player={continuation}
              nativeControls={false}
              contentFit="contain"
              playsInline
              surfaceType="textureView"
              onFirstFrameRender={() => setContinuationShown(true)}
              style={StyleSheet.absoluteFill}
            />
          )}
        </View>
        {still && (
          <Image
            testID="opening-still"
            accessible={false}
            source={still}
            resizeMode="contain"
            fadeDuration={0}
            // 웹 Image는 에셋의 원본 크기를 기본 width·height로 넣어 absoluteFill만으로는 줄지 않는다.
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          />
        )}
        {awaiting && <WakeHint />}
      </View>
      {/* 화면 전체가 입력 영역이다. 대기 중이 아닐 때의 터치는 받기만 하고 아무것도 하지 않는다. */}
      <View
        accessible
        accessibilityRole={awaiting ? 'button' : undefined}
        accessibilityLabel={awaiting ? '모찌 볼을 당겨 깨우기' : '모찌 개봉 중'}
        accessibilityState={{ disabled: !awaiting }}
        accessibilityActions={awaiting ? [{ name: 'activate' }] : undefined}
        onAccessibilityAction={event => {
          if (event.nativeEvent.actionName === 'activate') proceed();
        }}
        onAccessibilityTap={proceed}
        onStartShouldSetResponder={() => true}
        onResponderGrant={event => {
          touchFrom.current = {
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          };
        }}
        onResponderMove={event => {
          const from = touchFrom.current;
          if (
            from &&
            Math.abs(event.nativeEvent.pageX - from.x) >= DRAG_TO_CONTINUE
          )
            proceed();
        }}
        onResponderRelease={event => {
          const from = touchFrom.current;
          touchFrom.current = null;
          if (
            from &&
            Math.abs(event.nativeEvent.pageX - from.x) < TAP_SLOP &&
            Math.abs(event.nativeEvent.pageY - from.y) < TAP_SLOP
          )
            proceed();
        }}
        onResponderTerminate={() => {
          touchFrom.current = null;
        }}
        style={StyleSheet.absoluteFill}
      />
      {/* 입력 영역보다 위에 두어 건너뛰기 터치가 영상 잇기로 새지 않게 한다. */}
      {result === 'done' && phase !== 'completed' && (
        <SafeAreaView
          pointerEvents="box-none"
          style={[
            StyleSheet.absoluteFill,
            { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 6 },
          ]}
        >
          <GachaChip label="건너뛰기" dark width={98} onPress={skip} />
        </SafeAreaView>
      )}
    </View>
  );
}

// 입력을 기다리는 동안 영상 아래쪽에 떠서 오르내리는 안내. 터치는 아래 입력 영역으로 그대로 간다.
// 화면 읽기 프로그램에는 입력 영역의 이름("모찌 볼을 당겨 깨우기")으로 이미 알리므로 숨긴다.
function WakeHint() {
  const [float] = useState(() => new Animated.Value(0));
  const [shown] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(shown, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
    const bob = (toValue: number) =>
      Animated.timing(float, {
        toValue,
        duration: 700,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
    const loop = Animated.loop(Animated.sequence([bob(1), bob(0)]));
    loop.start();
    return () => loop.stop();
  }, [float, shown]);
  return (
    <Animated.View
      testID="opening-wake-hint"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '11%',
        alignItems: 'center',
        gap: 8,
        opacity: shown,
      }}
    >
      <Animated.Text
        style={{
          fontSize: 44,
          transform: [
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -12],
              }),
            },
          ],
        }}
      >
        👆
      </Animated.Text>
      <Animated.View
        style={{
          paddingHorizontal: 18,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: 'rgba(68, 42, 29, 0.6)',
          opacity: float.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.72],
          }),
        }}
      >
        <AppText variant="label" style={{ color: colors.white }}>
          화면을 톡! 모찌를 깨워 주세요
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

// 영상 위를 덮는 정지 이미지. 영상과 같은 장면이라 전환 순간 빈 화면이 보이지 않는다.
// continuation은 첫 프레임이 그려지고 재생이 시작된 뒤에야 대기 이미지를 걷는다.
function openingStill(
  phase: OpeningPhase,
  clip: OpeningClip,
  introVisible: boolean,
  continuationVisible: boolean,
) {
  if (phase === 'completed') return clip.end;
  if (phase === 'awaitingInteraction') return clip.touch;
  if (phase === 'continuation') return continuationVisible ? null : clip.touch;
  if (phase === 'intro' && introVisible) return null;
  return clip.start;
}

// P-03 새로운 모찌 · 1장.
export function RevealScreen() {
  const item = useGachaStore(state => state.lastPull[0]);
  const tickets = useGachaStore(state => state.wallet?.tickets ?? 0);
  if (!item) return <Redirect href="/gacha" />;
  const { tier, name } = item.card;
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
        accessibilityLabel={`새로운 모찌, ${tiers[tier].label} ${name}`}
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
            source={{ uri: item.card.imageUrl }}
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {name}
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
          // 1장 결과(P-03)와 같이 뽑기 화면으로 돌아간다. 도감은 카드를 눌러 상세로 볼 수 있다.
          <Button label="확인" onPress={() => router.back()} style={fixed} />
        )
      }
    >
      <CardGrid>
        {items.map((item, index) =>
          opened[index] ? (
            <MochiCard
              key={index}
              state={pullCardState(item)}
              onPress={() => openDetail(item.card.cardId)}
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

// 도감 응답을 못 받았을 때. 임의 목록으로 대신하지 않는다.
function CollectionState({
  query,
}: {
  query: ReturnType<typeof useCollection>;
}) {
  return query.isError ? (
    <StatePanel
      compact
      title="도감을 불러오지 못했어요"
      description="연결 상태를 확인하고 다시 시도해 주세요."
      retry={() => void query.refetch()}
      retryLabel="다시 불러오기"
    />
  ) : (
    <Loading label="도감을 불러오고 있어요" />
  );
}

// P-06 모찌 도감 (GET /gacha/collection). 없는 카드는 "?" 칸으로 가린다.
export function CollectionScreen() {
  const collection = useCollection();
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all');
  const [tier, setTier] = useState<Tier | null>(null);
  const data = collection.data;
  // 도감에 있는 등급만 칩으로 둔다. 컨셉(시리즈)별로는 거르지 않는다.
  const tierList = tierOrder.filter(id =>
    (data?.cards ?? []).some(card => card.tier === id),
  );
  // Sort a filtered copy for the album only; keep the shared API cache untouched.
  const list = (data?.cards ?? [])
    .filter(
      card =>
        (filter === 'all' || card.owned === (filter === 'owned')) &&
        (!tier || card.tier === tier),
    )
    .sort(
      (a, b) =>
        tierOrder.indexOf(b.tier) - tierOrder.indexOf(a.tier) ||
        a.name.localeCompare(b.name, 'ko'),
    );
  return (
    <CozyScreen
      title="모찌 도감"
      back
      contentStyle={{ gap: 16 }}
      footer={
        data && (
          <CozyButton
            label={`✦ ${data.shards}  ·  별조각으로 모찌 만나기`}
            onPress={() => router.push('/gacha/exchange')}
            style={[
              fixed,
              {
                backgroundColor: '#F0EBF6',
                borderColor: '#D9CFE3',
                boxShadow: 'none',
              },
            ]}
            labelStyle={{ color: '#665176' }}
          />
        )
      }
    >
      {!data ? (
        <CollectionState query={collection} />
      ) : (
        <>
          <AlbumCover owned={data.owned} total={data.total} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AlbumChip
              label="전체"
              width={62}
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <AlbumChip
              label="보유"
              width={62}
              active={filter === 'owned'}
              onPress={() => setFilter('owned')}
            />
            <AlbumChip
              label="미보유"
              width={72}
              active={filter === 'missing'}
              onPress={() => setFilter('missing')}
            />
            {tierList.map(id => (
              <AlbumChip
                key={id}
                label={tiers[id].label}
                width={62}
                active={tier === id}
                onPress={() => setTier(tier === id ? null : id)}
              />
            ))}
          </View>
          {list.length ? (
            <CardGrid>
              {list.map(card =>
                card.owned ? (
                  <AlbumCard
                    key={card.cardId}
                    state={{ kind: 'owned', card, isNew: card.isNew }}
                    onPress={() => openDetail(card.cardId)}
                  />
                ) : (
                  <AlbumCard
                    key={card.cardId}
                    state={{ kind: 'locked', card }}
                  />
                ),
              )}
            </CardGrid>
          ) : (
            <AppText style={{ color: colors.muted, textAlign: 'center' }}>
              {filter === 'owned'
                ? `아직 만난 ${tier ? `${tiers[tier].label} ` : ''}모찌가 없어요.`
                : tier
                  ? `${tiers[tier].label} 모찌는 모두 만났어요.`
                  : '모든 모찌를 만났어요.'}
            </AppText>
          )}
        </>
      )}
    </CozyScreen>
  );
}

// P-07 모찌 상세. 보고 나면 NEW 표시를 지운다(POST /gacha/collection/seen).
export function MochiDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = cardIdOf(id);
  const memberId = useAuthStore(state => state.member?.memberId);
  const collection = useCollection();
  const card = collection.data?.cards.find(item => item.cardId === cardId);
  const unseen = !!card?.owned && card.isNew;
  useEffect(() => {
    if (!unseen || cardId === null || memberId === undefined) return;
    void gachaApi
      .seen([cardId])
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: gachaKeys.collection(memberId),
        }),
      )
      .catch(() => undefined);
  }, [unseen, cardId, memberId]);
  if (!collection.data)
    return (
      <CozyScreen title="모찌 도감" back>
        <CollectionState query={collection} />
      </CozyScreen>
    );
  if (!card?.owned) return <Redirect href="/gacha/collection" />;
  return (
    <CozyScreen
      title="모찌 도감"
      back
      footer={
        <CozyButton
          label="도감으로 돌아가기"
          onPress={() => router.back()}
          style={[
            fixed,
            {
              backgroundColor: '#F0EBF6',
              borderColor: '#D9CFE3',
              boxShadow: 'none',
            },
          ]}
          labelStyle={{ color: '#665176' }}
        />
      }
    >
      <MochiFeature card={card} size={246}>
        {!!card.series && <AppText variant="small">{card.series}</AppText>}
      </MochiFeature>
    </CozyScreen>
  );
}
function MochiFeature({
  card,
  size,
  chip,
  children,
}: {
  card: Card;
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
      {chip ?? <TierBadge tier={card.tier} />}
      <Image
        accessibilityLabel={card.name}
        source={{ uri: card.imageUrl }}
        resizeMode="contain"
        style={{ width: size, height: size }}
      />
      <AppText variant="heading">{card.name}</AppText>
      {children}
    </View>
  );
}

// P-08 별조각으로 만나기. 전설·신화 중 아직 없는 카드를 교환가 순으로 보여 준다.
export function ExchangeScreen() {
  const collection = useCollection();
  const data = collection.data;
  const candidates = (data?.cards ?? [])
    .filter(card => !card.owned && card.exchangeCost !== null)
    .sort(
      (a, b) =>
        a.exchangeCost! - b.exchangeCost! || a.code.localeCompare(b.code),
    );
  return (
    <Screen title="별조각으로 만나기" back contentStyle={{ gap: 12 }}>
      {!data ? (
        <CollectionState query={collection} />
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <AppText variant="small">내 별조각</AppText>
            <BalanceChip label={`✦ ${data.shards}`} compact />
          </View>
          {candidates.length ? (
            candidates.map(card => (
              <View
                key={card.cardId}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 20,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <Image
                    accessibilityLabel={card.name}
                    source={{ uri: card.imageUrl }}
                    resizeMode="contain"
                    style={{ width: 100, height: 100 }}
                  />
                  <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
                    <TierBadge tier={card.tier} />
                    <AppText variant="label">{card.name}</AppText>
                    <AppText variant="small">
                      필요한 별조각 {card.exchangeCost}
                    </AppText>
                  </View>
                </View>
                <Button
                  label={
                    data.shards < card.exchangeCost!
                      ? '별조각이 부족해요'
                      : `${card.name} 교환   ✦ ${card.exchangeCost}`
                  }
                  disabled={data.shards < card.exchangeCost!}
                  onPress={() =>
                    router.push({
                      pathname: '/gacha/exchange-confirm',
                      params: { id: String(card.cardId) },
                    })
                  }
                  style={fixed}
                />
              </View>
            ))
          ) : (
            <AppText style={{ color: colors.muted, textAlign: 'center' }}>
              교환할 수 있는 모찌를 모두 만났어요.
            </AppText>
          )}
        </>
      )}
    </Screen>
  );
}

// P-09 교환 확인 (POST /gacha/exchanges).
export function ExchangeConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cardId = cardIdOf(id);
  const memberId = useAuthStore(state => state.member?.memberId);
  const collection = useCollection();
  const card = collection.data?.cards.find(item => item.cardId === cardId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // 교환이 끝나면 카드가 보유로 바뀐다. 그때는 완료 화면으로 가는 중이니 도감으로 되돌리지 않는다.
  const [done, setDone] = useState(false);
  if (!collection.data)
    return (
      <Screen title="별조각 교환" back>
        <CollectionState query={collection} />
      </Screen>
    );
  if (!card || card.exchangeCost === null || (card.owned && !done))
    return <Redirect href="/gacha/collection" />;
  const shards = collection.data.shards;
  const cost = card.exchangeCost;
  const rows: [string, string][] = [
    ['보유 별조각', String(shards)],
    ['사용할 별조각', `−${cost}`],
    ['교환 후', String(shards - cost)],
  ];
  async function exchange() {
    if (memberId === undefined || cardId === null) return;
    setBusy(true);
    setError('');
    try {
      await useGachaStore.getState().exchange(memberId, cardId);
      setDone(true);
      router.replace({
        pathname: '/gacha/exchanged',
        params: { id: String(cardId) },
      });
    } catch (failure) {
      setError(
        apiErrorMessage(failure, '교환하지 못했어요. 다시 시도해 주세요.'),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      title="별조각 교환"
      back
      contentStyle={{ gap: 12 }}
      footer={
        <>
          {!!error && <ErrorBanner message={error} />}
          <Button
            label="교환하기"
            loading={busy}
            disabled={shards < cost}
            onPress={() => void exchange()}
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
      <MochiFeature card={card} size={220} />
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
  const cardId = cardIdOf(id);
  const exchanged = useGachaStore(state => state.lastExchange);
  const collection = useCollection();
  const card =
    exchanged?.cardId === cardId
      ? exchanged
      : collection.data?.cards.find(item => item.cardId === cardId);
  const shards = collection.data?.shards;
  if (cardId === null || (!card && collection.data))
    return <Redirect href="/gacha/collection" />;
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
      {card ? (
        <MochiFeature
          card={card}
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
      ) : (
        <CollectionState query={collection} />
      )}
      {shards !== undefined && (
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
      )}
    </Screen>
  );
}

// P-11 요청 실패.
// 서버가 실패를 알려 줬으면 뽑기권은 쓰이지 않았다. 응답을 받지 못했으면 단정하지 않고,
// 다시 시도할 때 같은 키로 보내 이미 처리된 뽑기면 그 결과를 받는다.
export function GachaFailedScreen() {
  const params = useLocalSearchParams<{ count?: string }>();
  const error = useGachaStore(state => state.drawError);
  const unknown = useGachaStore(state => state.drawUnknown);
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
          {unknown
            ? '뽑기 결과를 확인하지 못했어요. 다시 시도하면 같은 뽑기로 확인하고, 뽑기권은 한 번만 써요.'
            : '뽑기권은 사용되지 않았어요.'}
        </AppText>
        {!!error && !unknown && (
          <AppText variant="small" style={{ textAlign: 'center' }}>
            {error}
          </AppText>
        )}
      </View>
    </Screen>
  );
}
