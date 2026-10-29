import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import type { LegalType } from '@/constants/legal';
import { fetchLegal, legalKeys } from '@/services/legalApi';
import { Loading, StatePanel } from './Feedback';
import { AppText } from './Text';

// 서버는 1시간 캐시를 허용한다(Cache-Control). 같은 시간 동안 다시 받지 않는다.
export function useLegalDocument(type: LegalType) {
  return useQuery({
    queryKey: legalKeys.document(type),
    queryFn: () => fetchLegal(type),
    staleTime: 60 * 60_000,
  });
}
export function LegalDocument({ type }: { type: LegalType }) {
  const document = useLegalDocument(type);
  if (document.isPending) return <Loading label="약관을 불러오고 있어요" />;
  if (!document.data)
    return (
      <StatePanel
        compact
        title="약관을 불러오지 못했어요"
        description="연결 상태를 확인하고 다시 시도해 주세요."
        retry={() => void document.refetch()}
        retryLabel="다시 불러오기"
      />
    );
  return (
    <View style={{ gap: 16 }}>
      {document.data.body
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <AppText
            key={index}
            variant={paragraph.startsWith('#') ? 'label' : 'small'}
            selectable
          >
            {paragraph.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '')}
          </AppText>
        ))}
    </View>
  );
}
