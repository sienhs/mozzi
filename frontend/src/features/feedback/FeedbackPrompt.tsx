import { useEffect, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { Popup } from '@/components/ui/Popup';
import { CozyButton as Button } from '@/components/ui/CozyUI';
import { TextButton } from '@/components/ui/Button';
import { AppText } from '@/components/ui/Text';
import { FEEDBACK_URL, openLink } from '@/constants/links';
import { feedbackPrompt } from '@/services/feedbackPrompt';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMetaStore } from '@/stores/useMetaStore';
import { useRewardStore } from '@/stores/useRewardStore';
import { cozyColors as colors } from '@/theme/cozy';

// 홈에 돌아왔을 때 한 번만 띄운다. 일기가 있고 뽑기를 해 본 회원만 대상이다.
// 보상·업데이트 안내가 떠 있으면 그게 닫힐 때까지 기다린다.
export function FeedbackPrompt({ recorded }: { recorded: boolean }) {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  const rewarding = useRewardStore(state => state.queue.length > 0);
  const updating = useMetaStore(
    state => state.update === 'recommended' && !state.updateDismissed,
  );
  const [visible, setVisible] = useState(false);
  const ready = recorded && focused && !rewarding && !updating;
  useEffect(() => {
    if (!ready || memberId === undefined) return;
    let active = true;
    // 화면이 바뀌자마자 덮지 않게 잠깐 두고 띄운다.
    const timer = setTimeout(() => {
      void feedbackPrompt.due(memberId).then(due => {
        if (!active || !due) return;
        setVisible(true);
        void feedbackPrompt.markShown(memberId);
      });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [ready, memberId]);
  const close = () => setVisible(false);
  return (
    <Popup visible={visible} onClose={close} label="피드백 남기기">
      <AppText variant="title" style={{ textAlign: 'center' }}>
        모찌 어떠셨어요?
      </AppText>
      <AppText style={{ textAlign: 'center', color: colors.muted }}>
        짧은 설문으로 의견을 들려주세요.
      </AppText>
      <Button
        label="피드백 남기기"
        onPress={() => {
          close();
          void openLink(FEEDBACK_URL);
        }}
      />
      <TextButton label="다음에 할게요" onPress={close} />
    </Popup>
  );
}
