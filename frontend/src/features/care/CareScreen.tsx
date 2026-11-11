import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { useReducedMotion } from '@/components/ui/Motion';
import { isEmotion } from '@/constants/emotions';
import { colors, fonts } from '@/theme/tokens';
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
  const reduced = useReducedMotion();
  const claim = useCareRewardStore(state => state.claim);
  const onComplete = useCallback(
    (action: CareAction) => void claim(action),
    [claim],
  );
  const [care, dispatch] = useCareController(onComplete);

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
  const busy =
    care.phase !== 'idle' && !(care.phase === 'pet' && !care.assisted);
  const instruction: Record<CareAction, string> = {
    pet: '모찌를 문질러 쓰다듬어 주세요',
    feed: hasMouth
      ? '간식을 모찌 입으로 가져가 주세요'
      : '간식을 접시에 놓아 주세요',
    play: `공을 던져 주세요 · ${care.round}/${CARE_POLICY.play.targetHits}`,
  };
  const status =
    care.phase === 'reward'
      ? outcomeText(outcome)
      : care.phase === 'idle' && outcome === 'failed'
        ? outcomeText(outcome)
        : busy
          ? `${LABEL[care.mode]} 중이에요`
          : instruction[care.mode];
  return (
    <Screen
      back
      title="모찌랑 놀기"
      scrollable={false}
      contentStyle={styles.content}
      footer={
        <View accessibilityRole="tablist" style={styles.modes}>
          {ACTIONS.map(action => (
            <ModeButton
              key={action}
              action={action}
              selected={care.mode === action}
              onPress={() => dispatch({ type: 'mode', mode: action })}
            />
          ))}
        </View>
      }
    >
      <View style={styles.heading}>
        <AppText
          variant="label"
          numberOfLines={1}
          style={styles.name}
          testID="care-mochi-name"
        >
          {skin.name}
        </AppText>
        <AppText variant="caption" style={styles.hint}>
          활동마다 하루 한 번 뽑기권을 받아요
        </AppText>
      </View>
      <CareStage
        key={skin.key}
        skin={skin}
        phase={care.phase}
        mode={care.mode}
        interactionId={care.interactionId}
        round={care.round}
        scripted={care.assisted}
        enabled={
          care.phase === 'idle' || (care.phase === 'pet' && !care.assisted)
        }
        reducedMotion={reduced}
        ballLabel={`공 던지기 ${care.round}/${CARE_POLICY.play.targetHits}`}
        onPetStart={() => dispatch({ type: 'pet-start' })}
        onPetProgress={value => dispatch({ type: 'pet-progress', value })}
        onPetEnd={completed => dispatch({ type: 'pet-end', completed })}
        onPetAssist={() => dispatch({ type: 'pet-assist' })}
        onFeed={() => dispatch({ type: 'feed' })}
        onThrow={() => dispatch({ type: 'throw' })}
        onImageError={() => undefined}
      />
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(care.progress * 100),
        }}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${care.progress * 100}%` }]} />
      </View>
      <View style={styles.statusRow}>
        <AppText
          accessibilityLiveRegion="polite"
          testID="care-status"
          style={styles.status}
        >
          {status}
        </AppText>
        {outcome === 'failed' && care.phase === 'idle' && (
          <Pressable
            accessibilityRole="button"
            onPress={() => void claim(care.mode)}
            hitSlop={8}
            style={styles.retry}
          >
            <AppText variant="small" style={{ color: colors.primary }}>
              다시 받기
            </AppText>
          </Pressable>
        )}
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

function ModeButton({
  action,
  selected,
  onPress,
}: {
  action: CareAction;
  selected: boolean;
  onPress: () => void;
}) {
  const outcome = useCareRewardOutcome(action);
  const done = outcome === 'granted' || outcome === 'claimed';
  return (
    <Pressable
      testID={`care-mode-${action}`}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={`${LABEL[action]}, ${done ? '오늘 보상 받음' : `뽑기권 ${CARE_POLICY[action].tickets}장`}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mode,
        selected && styles.modeSelected,
        pressed && { opacity: 0.8 },
      ]}
    >
      <AppText variant="label" style={selected && { color: colors.primary }}>
        {LABEL[action]}
      </AppText>
      <AppText variant="caption" style={styles.modeReward}>
        {done ? '오늘 받음' : `+${CARE_POLICY[action].tickets}장`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: { flexShrink: 1, fontFamily: fonts.pen, fontSize: 24 },
  hint: { color: colors.muted },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.primary },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 30,
  },
  status: { color: colors.primary, textAlign: 'center' },
  retry: { paddingVertical: 4, paddingHorizontal: 8 },
  modes: { flexDirection: 'row', gap: 8 },
  mode: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  modeSelected: { borderColor: colors.primary, backgroundColor: colors.soft },
  modeReward: { color: colors.muted },
});
