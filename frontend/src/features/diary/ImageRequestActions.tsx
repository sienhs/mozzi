import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { TagChip } from '@/components/ui/Selection';
import { AppText } from '@/components/ui/Text';
import { canResend, canRetry, useAppStore } from '@/stores/useAppStore';
import type { DiaryEntry } from '@/types/diary';
import type { MyIcon } from '@/types/server';
import { sendImageFor } from './recordActions';

// E-01·E-03의 다시 보내기(요청 유실)·다시 그리기(실패). 처음 요청한 장면·모찌를 그대로 보낸다.
// 앱이 꺼져 장면을 잃었으면 일기의 무엇을 아이콘 중 대표 활동을 다시 고르게 한다(하나여도 직접 고른다).
export function useImageRequest(entry: DiaryEntry | null, whatIcons: MyIcon[]) {
  const [picked, setPicked] = useState<number | null>(null);
  const image = useAppStore(state => state.image);
  const mine =
    entry?.serverId && image.diaryId === entry.serverId ? image : null;
  const checked = useAppStore(state =>
    entry?.serverId ? entry.serverId in state.requests : false,
  );
  const allowed = !!entry && (canResend(entry) || canRetry(entry));
  // 그림 요청 때 보관한 장면이 있으면 그대로 쓴다. imageTags는 그 스냅샷에서만 온다.
  const needsPick = allowed && checked && !entry.imageTags;
  const sending = mine?.status === 'sending';
  return {
    allowed,
    needsPick,
    picked: whatIcons.some(icon => icon.myIconId === picked) ? picked : null,
    setPicked,
    sending,
    status: mine?.status ?? 'idle',
    error: mine?.error ?? '',
    label: entry?.generation === 'notRequested' ? '다시 보내기' : '다시 그리기',
    ready: checked && !(needsPick && picked === null),
    send: () => {
      if (!entry || sending || !checked) return;
      if (needsPick && picked === null) return;
      sendImageFor(entry, needsPick ? picked! : undefined);
    },
  };
}
type ImageRequest = ReturnType<typeof useImageRequest>;

export function ScenePicker({
  request,
  whatIcons,
}: {
  request: ImageRequest;
  whatIcons: MyIcon[];
}) {
  if (!request.needsPick) return null;
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="label">그림으로 남길 활동을 다시 골라 주세요</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {whatIcons.map(icon => (
          <TagChip
            key={icon.myIconId}
            label={icon.name}
            single
            selected={request.picked === icon.myIconId}
            disabled={request.sending}
            onPress={() => request.setPicked(icon.myIconId)}
          />
        ))}
      </View>
    </View>
  );
}
export function ImageRequestStatus({ request }: { request: ImageRequest }) {
  if (request.status === 'unknown')
    return (
      <AppText variant="caption" accessibilityLiveRegion="polite">
        {request.error}
      </AppText>
    );
  if (request.status === 'error')
    return <ErrorBanner message={request.error} />;
  return null;
}
export function ImageRequestButton({ request }: { request: ImageRequest }) {
  if (!request.allowed) return null;
  return (
    <Button
      label={request.sending ? '그림을 부탁하고 있어요' : request.label}
      loading={request.sending}
      disabled={!request.ready}
      onPress={request.send}
    />
  );
}
