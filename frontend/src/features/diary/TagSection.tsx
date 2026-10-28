import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/ui/Text';
import { colors } from '@/theme/tokens';

// 태그 분류 한 묶음: 제목 + 개수 표기 + 칩. 안내 문구는 무언가 바뀌었을 때만 보인다.
export function TagSection({
  title,
  limit,
  action,
  notice,
  children,
}: {
  title: string;
  limit?: string;
  action?: ReactNode;
  notice?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 28,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <AppText variant="label" accessibilityRole="header">
            {title}
          </AppText>
          {limit && <AppText variant="caption">{limit}</AppText>}
        </View>
        {action}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {children}
      </View>
      {!!notice && (
        <AppText
          variant="caption"
          accessibilityLiveRegion="polite"
          style={{ color: colors.primary }}
        >
          {notice}
        </AppText>
      )}
    </View>
  );
}
