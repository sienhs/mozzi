import { router } from 'expo-router';
import { AppText } from '@/components/ui/Text';
import { Button, TextButton } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import type { RewardType } from '@/services/rewardApi';
import { useRewardStore } from '@/stores/useRewardStore';

const reasons: Record<RewardType, string> = {
  SIGNUP: '가입을 환영하는 선물이에요.',
  DAILY_LOGIN: '오늘 찾아와 준 선물이에요.',
  DAILY_RECORD: '오늘의 기록을 남긴 선물이에요.',
};
// 서버가 지급한 뽑기권을 알린다. 지급은 이미 끝났고, 닫아도 잃지 않는다.
export function RewardSheet() {
  const reward = useRewardStore(state => state.queue[0]);
  const dismiss = useRewardStore(state => state.dismiss);
  return (
    <Sheet
      visible={!!reward}
      onClose={dismiss}
      title={reward ? `뽑기권 ${reward.tickets}장을 받았어요` : ''}
    >
      {reward && (
        <>
          <AppText style={{ textAlign: 'center' }}>
            {reasons[reward.type]}
          </AppText>
          <AppText variant="small" style={{ textAlign: 'center' }}>
            지금 뽑기권 {reward.ticketCount}장
          </AppText>
          <Button
            label="모찌 뽑으러 가기"
            onPress={() => {
              dismiss();
              router.push('/gacha');
            }}
          />
          <TextButton label="닫기" onPress={dismiss} />
        </>
      )}
    </Sheet>
  );
}
