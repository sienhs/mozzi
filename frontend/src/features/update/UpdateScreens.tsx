import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Button, TextButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { Heading, Screen } from '@/components/ui/Screen';
import { Sheet } from '@/components/ui/Sheet';
import { AppText } from '@/components/ui/Text';
import { appUpdateUrl, installedAppVersion } from '@/utils/appVersion';
import { useMetaStore } from '@/stores/useMetaStore';

function useOpenUpdate() {
  const [error, setError] = useState('');
  const url = appUpdateUrl();
  const open = async () => {
    if (!url) return;
    setError('');
    try {
      await Linking.openURL(url);
    } catch {
      setError('업데이트 페이지를 열지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  };
  return { url, open, error };
}
const NO_LINK =
  '업데이트 받을 곳이 아직 준비되지 않았어요. 앱을 받은 곳에서 최신 버전을 설치해 주세요.';

// 메타를 받기 전에는 버전·약관을 판단할 수 없어 앱으로 들어가지 않는다.
export function MetaErrorScreen() {
  const error = useMetaStore(state => state.error);
  const loading = useMetaStore(state => state.status === 'loading');
  return (
    <Screen
      header={false}
      footer={
        <Button
          label={loading ? '확인하고 있어요' : '다시 시도'}
          loading={loading}
          onPress={() => void useMetaStore.getState().load()}
        />
      }
    >
      <Heading
        title="앱 정보를 불러오지 못했어요"
        description="연결 상태를 확인하고 다시 시도해 주세요."
      />
      {!!error && <ErrorBanner message={error} />}
    </Screen>
  );
}

// 최소 지원 버전보다 낮다: 다른 화면으로 넘어가지 않는다.
export function ForceUpdateScreen() {
  const latest = useMetaStore(state => state.meta?.latestVersion);
  const { url, open, error } = useOpenUpdate();
  return (
    <Screen
      header={false}
      footer={
        url ? (
          <Button label="업데이트하기" onPress={() => void open()} />
        ) : undefined
      }
    >
      <Heading
        title="업데이트가 필요해요"
        description="지금 버전에서는 오늘의 모찌를 쓸 수 없어요. 최신 버전으로 업데이트해 주세요."
      />
      <AppText variant="small">
        설치된 버전 {installedAppVersion() ?? '-'} · 최신 버전 {latest ?? '-'}
      </AppText>
      {!url && <AppText variant="small">{NO_LINK}</AppText>}
      {!!error && <ErrorBanner message={error} />}
    </Screen>
  );
}

// 최신 버전보다 낮지만 계속 쓸 수 있다. 닫으면 이번 실행 동안 다시 띄우지 않는다.
export function RecommendedUpdateSheet() {
  const visible = useMetaStore(
    state => state.update === 'recommended' && !state.updateDismissed,
  );
  const latest = useMetaStore(state => state.meta?.latestVersion);
  const dismiss = useMetaStore(state => state.dismissUpdate);
  const { url, open, error } = useOpenUpdate();
  return (
    <Sheet visible={visible} onClose={dismiss} title="새 버전이 나왔어요">
      <AppText style={{ textAlign: 'center' }}>
        {`최신 버전 ${latest ?? ''}으로 업데이트하면 더 편하게 쓸 수 있어요.`}
      </AppText>
      {!url && <AppText variant="small">{NO_LINK}</AppText>}
      {!!error && <ErrorBanner message={error} />}
      {url && <Button label="업데이트하기" onPress={() => void open()} />}
      <TextButton label="나중에 할게요" onPress={dismiss} />
    </Sheet>
  );
}
