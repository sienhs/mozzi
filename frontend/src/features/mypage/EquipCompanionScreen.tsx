import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { Smile, Sparkles, FileText, Leaf } from 'lucide-react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { ErrorBanner, Loading, StatePanel } from '@/components/ui/Feedback';
import { TierBadge } from '@/components/gacha/GachaUI';
import { MyPageTitle } from '@/components/mypage/CompanionUI';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotions } from '@/constants/emotions';
import { colors } from '@/theme/tokens';
import { apiErrorMessage } from '@/services/authErrors';
import { mozziApi, mozziKeys } from '@/services/mozziApi';
import { queryClient } from '@/services/queryClient';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOwnedMozzis } from '@/features/gacha/useGachaQueries';

const benefits = [
  {
    icon: Smile,
    title: '선택한 감정의 모찌 변경',
    description: '다른 감정에 장착한 모찌는 그대로 유지돼요.',
  },
  {
    icon: Sparkles,
    title: '새 AI 그림에 반영',
    description: '이 감정으로 새로 그리는 그림에 함께해요.',
  },
  {
    icon: FileText,
    title: '지난 기록과 그림은 유지',
    description: '이미 작성한 일기와 그림은 그대로 유지돼요.',
  },
];
// 모찌 장착 (PUT /members/me/mozzis/{emotion}). 카드마다 감정이 하나라 그 감정에만 장착한다.
export function EquipCompanionScreen() {
  const { id } = useLocalSearchParams<{ id: string; emotion?: string }>();
  const cardId = Number(id);
  const memberId = useAuthStore(state => state.member?.memberId);
  const owned = useOwnedMozzis({});
  const mozzi = owned.data?.find(item => item.cardId === cardId);
  const [error, setError] = useState('');
  const equip = useMutation({
    mutationFn: () => mozziApi.choose(mozzi!.emotion, mozzi!.cardId),
    onSuccess: async () => {
      if (memberId !== undefined)
        await queryClient.invalidateQueries({
          queryKey: mozziKeys.all(memberId),
        });
      router.dismissTo({
        pathname: '/mypage',
        params: { equipped: String(Date.now()), emotion: mozzi!.emotion },
      });
    },
    onError: failure =>
      setError(
        apiErrorMessage(
          failure,
          '모찌를 장착하지 못했어요. 다시 시도해 주세요.',
        ),
      ),
  });
  if (!owned.data)
    return (
      <Screen back title="모찌 장착하기">
        {owned.isError ? (
          <StatePanel
            compact
            title="보유 모찌를 불러오지 못했어요"
            description="연결 상태를 확인하고 다시 시도해 주세요."
            retry={() => void owned.refetch()}
            retryLabel="다시 불러오기"
          />
        ) : (
          <Loading label="보유 모찌를 불러오고 있어요" />
        )}
      </Screen>
    );
  if (!mozzi)
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
  const label = emotions[mozzi.emotion].label;
  return (
    <Screen
      back
      title="모찌 장착하기"
      titleContent={<MyPageTitle>모찌 장착하기</MyPageTitle>}
      footer={
        <>
          {!!error && <ErrorBanner message={error} />}
          <Button
            label={
              mozzi.equipped
                ? '현재 장착 중'
                : equip.isPending
                  ? '장착하고 있어요'
                  : `${label}에 장착하기`
            }
            disabled={mozzi.equipped || equip.isPending}
            loading={equip.isPending}
            onPress={() => {
              setError('');
              equip.mutate();
            }}
          />
        </>
      }
      contentStyle={{ gap: 16 }}
    >
      <View
        style={{
          backgroundColor: colors.white,
          borderRadius: 24,
          padding: 16,
          gap: 10,
          alignItems: 'center',
        }}
      >
        <EmotionImage emotion={mozzi.emotion} companion={mozzi} size={180} />
        <TierBadge tier={mozzi.tier} />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {mozzi.name}
        </AppText>
        <AppText variant="small" style={{ textAlign: 'center' }}>
          {label} 모찌
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
          <AppText variant="label">{label}에 이 모찌를 장착하면</AppText>
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
    </Screen>
  );
}
