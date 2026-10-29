import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Smile, Sparkles, FileText, Leaf } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ErrorBanner, StatePanel } from '@/components/ui/Feedback';
import { TierBadge } from '@/components/gacha/GachaUI';
import { MyPageTitle } from '@/components/mypage/CompanionUI';
import { EmotionSlotPicker } from '@/components/mypage/EmotionSlotPicker';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotions, isEmotion } from '@/constants/emotions';
import type { Emotion } from '@/types/diary';
import { companions, isCompanionId } from '@/constants/companions';
import { colors } from '@/theme/tokens';
import { useGachaStore } from '@/stores/useGachaStore';

const benefits = [
  {
    icon: Smile,
    title: '선택한 감정의 모찌 변경',
    description: '다른 감정에 장착한 모찌는 그대로 유지돼요.',
  },
  {
    icon: Sparkles,
    title: '새 AI 그림에 반영',
    description: '앞으로 만드는 그림에 함께할 모찌예요.',
  },
  {
    icon: FileText,
    title: '지난 기록과 그림은 유지',
    description: '이미 작성한 일기와 그림은 그대로 유지돼요.',
  },
];
export function EquipCompanionScreen() {
  const { id, emotion: routeEmotion } = useLocalSearchParams<{
    id: string;
    emotion?: string;
  }>();
  const [emotion, setEmotion] = useState<Emotion>(
    isEmotion(routeEmotion) ? routeEmotion : 'happy',
  );
  const owned = useGachaStore(state => state.owned);
  const equippedId = useGachaStore(state => state.equippedByEmotion[emotion]);
  const equipping = useGachaStore(state => state.equipping);
  const error = useGachaStore(state => state.equipmentError);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    useGachaStore.setState({ equipmentError: '' });
    return () => {
      mounted.current = false;
    };
  }, [id]);
  if (!id || !isCompanionId(id) || (id !== 'default' && !owned.includes(id)))
    return (
      <Screen back title="모찌 장착하기">
        <StatePanel
          title="보유한 모찌를 선택해 주세요"
          description="보유 모찌에서 다시 선택할 수 있어요."
        />
        <Button
          label="보유 모찌로"
          onPress={() => router.replace('/mypage/owned')}
        />
      </Screen>
    );
  const companion = companions[id];
  const alreadyEquipped = id === equippedId;
  async function equip() {
    if (alreadyEquipped || equipping) return;
    const succeeded = await useGachaStore
      .getState()
      .equip(emotion, companion.id);
    if (succeeded && mounted.current)
      router.dismissTo({
        pathname: '/mypage',
        params: { equipped: String(Date.now()) },
      });
  }
  return (
    <Screen
      back
      title="모찌 장착하기"
      titleContent={<MyPageTitle>모찌 장착하기</MyPageTitle>}
      footer={
        <Button
          label={
            alreadyEquipped
              ? '현재 장착 중'
              : equipping
                ? '장착하고 있어요'
                : `${emotions[emotion].label}에 장착하기`
          }
          disabled={alreadyEquipped || equipping}
          loading={equipping}
          onPress={() => void equip()}
        />
      }
      contentStyle={{ gap: 16 }}
    >
      <AppText variant="label">장착할 감정을 선택해 주세요</AppText>
      <EmotionSlotPicker
        value={emotion}
        onChange={setEmotion}
        disabled={equipping}
      />
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          padding: 16,
          gap: 10,
          alignItems: 'center',
        }}
      >
        <EmotionImage emotion={emotion} companionId={companion.id} size={180} />
        <TierBadge tier={companion.tier} />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {companion.name}
        </AppText>
        <AppText variant="small" style={{ textAlign: 'center' }}>
          {companion.description}
        </AppText>
      </View>
      <View
        style={{
          backgroundColor: colors.sageSoft,
          padding: 12,
          borderRadius: 18,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Leaf size={22} color={colors.sage} />
          <AppText variant="label">
            {emotions[emotion].label}에 이 모찌를 장착하면
          </AppText>
        </View>
        {benefits.map(item => (
          <View
            key={item.title}
            style={{
              flexDirection: 'row',
              gap: 10,
              padding: 12,
              backgroundColor: colors.white,
              borderRadius: 12,
            }}
          >
            <item.icon size={24} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="label">{item.title}</AppText>
              <AppText variant="caption">{item.description}</AppText>
            </View>
          </View>
        ))}
      </View>
      {companion.id !== 'default' && (
        <AppText variant="caption">
          감정별 표정은 준비 중이에요. 지금은 선택한 모찌의 기본 이미지로
          보여드려요.
        </AppText>
      )}
      <AppText variant="caption">
        AI 그림 반영은 준비 중이에요. 현재는 장착 선택과 새 기록의 모찌가
        연결돼요.
      </AppText>
      {!!error && <ErrorBanner message={error} />}
    </Screen>
  );
}
