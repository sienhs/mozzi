import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DiaryArtwork, DiaryMeta } from '@/components/ui/DiaryCard';
import { PictureState, StatePanel } from '@/components/ui/Feedback';
import { Sheet } from '@/components/ui/Sheet';
import { formatDate, formatTime } from '@/constants/date';
import { colors } from '@/theme/tokens';
import { useAppStore } from '@/stores/useAppStore';

export function DiaryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = useAppStore(state =>
    state.entries.find(item => item.id === id),
  );
  const [share, setShare] = useState(false);
  if (!entry)
    return (
      <Screen title="기록 상세" back>
        <StatePanel
          title="기록을 찾지 못했어요"
          description="캘린더에서 다른 날을 눌러 보세요."
        />
        <Button label="캘린더로" onPress={() => router.replace('/calendar')} />
      </Screen>
    );
  return (
    <Screen
      title={formatDate(entry.date)}
      back
      action={{
        icon: 'share',
        label: '기록 공유',
        onPress: () => setShare(true),
      }}
      contentStyle={{ gap: 20 }}
    >
      {entry.generation === 'ready' ? (
        <DiaryArtwork />
      ) : (
        <PictureState
          emotion={entry.emotion}
          companionId={entry.companionId}
          generating={entry.generation === 'generating'}
          tone="sage"
          caption={
            entry.generation === 'failed'
              ? '그림을 완성하지 못했어요'
              : undefined
          }
        />
      )}
      <DiaryMeta entry={entry} />
      <AppText>{entry.memo || entry.title}</AppText>
      {entry.generation === 'failed' && (
        <Button
          label="다시 그리기"
          onPress={() => {
            void useAppStore.getState().generateImage(entry.id);
            router.push({
              pathname: '/record/generation',
              params: { id: entry.id },
            });
          }}
        />
      )}
      <View style={{ height: 1, backgroundColor: colors.line }} />
      <AppText variant="caption">
        {formatTime(entry.createdAt)}에 남긴 기록
      </AppText>
      <Sheet title="기록 공유" visible={share} onClose={() => setShare(false)}>
        <AppText style={{ textAlign: 'center', color: colors.muted }}>
          그림 공유는 준비 중이에요.
        </AppText>
        <Button
          label="확인"
          onPress={() => setShare(false)}
          variant="secondary"
        />
      </Sheet>
    </Screen>
  );
}
