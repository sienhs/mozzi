import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { useReducedMotion } from '@/components/ui/Motion';
import { isEmotion } from '@/constants/emotions';
import { colors, fonts } from '@/theme/tokens';
import { Ball, Cookie, PetHand } from './CareProps';
import { CareStage } from './CareStage';
import { mouthAnchor } from './careExpressions';
import { CARE_POLICY, type CareAction } from './careModel';
import { resolveCareSkin } from './careSkin';
import { useCareController } from './useCareController';
import {
  useCareRewardOutcome,
  useCareRewardStore,
  type CareRewardOutcome,
} from './useCareRewards';

const ACTIONS: CareAction[] = ['pet', 'feed', 'play'];
const LABEL: Record<CareAction, string> = {
  pet: '쓰다듬기',
  feed: '간식 주기',
  play: '공놀이',
};
// 화면 틀(Screen)이 폭을 600으로 묶으므로 창 크기가 아니라 실제로 받은 자리로 배치를 정한다.
// 폭은 넉넉한데 높이가 모자랄 때(분할 화면, 낮은 창)만 버튼을 무대 옆에 세운다.
const SIDE_MIN_WIDTH = 520;
const SIDE_MAX_HEIGHT = 540;

// 홈에서 연다: /care?emotion=happy&image=<카드 주소>&name=<이름>. 이미지가 없으면 그 감정의 기본 모찌다.
export function CareScreen() {
  const params = useLocalSearchParams<{
    emotion?: string;
    image?: string;
    name?: string;
  }>();
  const emotion = isEmotion(params.emotion) ? params.emotion : 'happy';
  const skin = useMemo(
    () =>
      resolveCareSkin(
        params.image
          ? { name: params.name || '모찌', imageUrl: params.image }
          : null,
        emotion,
      ),
    [params.image, params.name, emotion],
  );
  const [area, setArea] = useState({ width: 0, height: 0 });
  const wide =
    area.width >= SIDE_MIN_WIDTH &&
    area.height > 0 &&
    area.height < SIDE_MAX_HEIGHT;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const claim = useCareRewardStore(state => state.claim);
  const onComplete = useCallback(
    (action: CareAction) => void claim(action),
    [claim],
  );
  const [care, dispatch] = useCareController(onComplete);
  // 쓰다듬다 너무 일찍 손을 떼면 무엇이 모자랐는지 알려 준다.
  const [shortPet, setShortPet] = useState(false);

  // 앱을 벗어나거나 동작 줄이기 설정이 바뀌면 진행 중인 장면과 공놀이 횟수를 버린다.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') dispatch({ type: 'cancel' });
    });
    return () => subscription.remove();
  }, [dispatch]);
  const firstReduced = useRef(true);
  useEffect(() => {
    if (firstReduced.current) {
      firstReduced.current = false;
      return;
    }
    dispatch({ type: 'cancel' });
  }, [reduced, dispatch]);

  const outcome = useCareRewardOutcome(care.mode);
  const hasMouth = !!mouthAnchor(skin.expressions);
  const petting = care.phase === 'pet' && !care.assisted;
  const busy = care.phase !== 'idle' && !petting;
  const retry = outcome === 'failed' && care.phase === 'idle';
  const instruction: Record<CareAction, string> = {
    pet: shortPet ? '조금 더 오래 문질러 주세요' : '모찌를 살살 문질러 주세요',
    feed: hasMouth
      ? '쿠키를 모찌 입으로 끌어 주세요'
      : '쿠키를 접시로 끌어 주세요',
    play: `공을 눌러 던져요 · ${care.round}/${CARE_POLICY.play.targetHits}`,
  };
  const status =
    care.phase === 'reward' || retry
      ? outcomeText(outcome)
      : petting
        ? care.progress < 0.6
          ? '좋아요, 계속 문질러 주세요'
          : '조금만 더 쓰다듬어 주세요'
        : busy
          ? `${LABEL[care.mode]} 중이에요`
          : instruction[care.mode];

  const panel = (
    <View style={[styles.panel, wide && styles.panelWide]}>
      <View testID="care-guide" style={styles.guide}>
        <AppText
          accessibilityLiveRegion="polite"
          testID="care-status"
          style={[styles.status, wide && styles.statusWide]}
        >
          {status}
        </AppText>
        {retry && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void claim(care.mode)}
            hitSlop={8}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
          >
            <AppText style={styles.retryText}>다시 받기</AppText>
          </Pressable>
        )}
      </View>
      <View
        accessibilityRole="tablist"
        style={[styles.actions, wide && styles.actionsWide]}
      >
        {ACTIONS.map(action => (
          <ActionButton
            key={action}
            action={action}
            wide={wide}
            selected={care.mode === action}
            onPress={() => {
              setShortPet(false);
              dispatch({ type: 'mode', mode: action });
            }}
          />
        ))}
      </View>
    </View>
  );
  return (
    <Screen
      back
      titleContent={
        <AppText testID="care-mochi-name" numberOfLines={1} style={styles.name}>
          {skin.name.replace(/\s*\([^)]*\)\s*$/, '')}랑 놀기
        </AppText>
      }
      scrollable={false}
      onViewportLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setArea(prev =>
          prev.width === width && prev.height === height
            ? prev
            : { width, height },
        );
      }}
      contentStyle={[styles.content, { paddingBottom: insets.bottom + 12 }]}
    >
      <View testID="care-body" style={[styles.body, wide && styles.bodyWide]}>
        <CareStage
          key={skin.key}
          style={wide ? styles.stageWide : styles.stage}
          skin={skin}
          phase={care.phase}
          mode={care.mode}
          interactionId={care.interactionId}
          round={care.round}
          scripted={care.assisted}
          enabled={care.phase === 'idle' || petting}
          reducedMotion={reduced}
          ballLabel={`공 던지기 ${care.round}/${CARE_POLICY.play.targetHits}`}
          onPetStart={() => {
            setShortPet(false);
            dispatch({ type: 'pet-start' });
          }}
          onPetProgress={value => dispatch({ type: 'pet-progress', value })}
          onPetEnd={completed => {
            setShortPet(!completed);
            dispatch({ type: 'pet-end', completed });
          }}
          onPetAssist={() => dispatch({ type: 'pet-assist' })}
          onFeed={() => dispatch({ type: 'feed' })}
          onThrow={() => dispatch({ type: 'throw' })}
          onImageError={() => undefined}
        />
        {panel}
      </View>
    </Screen>
  );
}

function outcomeText(outcome: CareRewardOutcome | undefined) {
  switch (outcome) {
    case 'sending':
      return '뽑기권을 확인하고 있어요';
    case 'granted':
      return '오늘의 뽑기권을 받았어요';
    case 'claimed':
      return '오늘은 이미 받았어요. 계속 놀아 주세요';
    case 'failed':
      return '뽑기권을 확인하지 못했어요';
    default:
      return '모찌가 좋아해요';
  }
}

function ActionIcon({ action }: { action: CareAction }) {
  switch (action) {
    case 'pet':
      return <PetHand size={26} />;
    case 'feed':
      return <Cookie size={30} />;
    case 'play':
      return <Ball size={28} />;
  }
}

function ActionButton({
  action,
  selected,
  wide,
  onPress,
}: {
  action: CareAction;
  selected: boolean;
  wide: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  const outcome = useCareRewardOutcome(action);
  const done = outcome === 'granted' || outcome === 'claimed';
  return (
    <Pressable
      testID={`care-mode-${action}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${LABEL[action]}, ${done ? '오늘 보상 받음' : `뽑기권 ${CARE_POLICY[action].tickets}장`}`}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.action,
        wide && styles.actionWide,
        selected && styles.actionSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        <ActionIcon action={action} />
      </View>
      <AppText
        style={[
          styles.label,
          wide && styles.labelWide,
          selected && { color: colors.primary },
        ]}
      >
        {LABEL[action]}
      </AppText>
      <View style={[styles.chip, done && styles.chipDone]}>
        <AppText
          variant="caption"
          style={[styles.chipText, done && { color: colors.mossInk }]}
        >
          {done ? '오늘 받음' : `+${CARE_POLICY[action].tickets}장`}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4 },
  body: { flex: 1, minHeight: 0, gap: 8 },
  bodyWide: { flexDirection: 'row', gap: 16 },
  name: {
    flexShrink: 1,
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 24,
    lineHeight: 30,
  },
  // 남는 높이를 무대가 갖되, 큰 화면에서 모찌가 지나치게 커지지 않게 한다.
  stage: { flex: 1, minHeight: 0 },
  stageWide: { flex: 1, minHeight: 0, width: undefined },
  panel: { flexShrink: 0, gap: 6 },
  panelWide: { width: 240, justifyContent: 'center' },
  guide: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  status: {
    flexShrink: 1,
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
  },
  statusWide: { fontSize: 18, lineHeight: 24 },
  retry: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  retryText: { color: colors.white, fontFamily: fonts.medium, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  actionsWide: { flexDirection: 'column' },
  action: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    backgroundColor: colors.paper,
  },
  actionWide: {
    flex: 0,
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
  },
  actionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.peachPaper,
  },
  pressed: { opacity: 0.85 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.pen,
    fontSize: 18,
    lineHeight: 24,
    textAlign: 'center',
  },
  labelWide: { flex: 1, fontSize: 22, lineHeight: 28 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.peachPaper,
  },
  chipDone: { backgroundColor: colors.sageSoft },
  chipText: { color: colors.primary },
});
