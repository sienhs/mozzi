import { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Check, Leaf } from 'lucide-react-native';
import { cozyColors as colors } from '@/theme/cozy';
import { AppText } from '@/components/ui/Text';
import type { Companion, OwnedMozzi } from '@/types/companion';

// 모찌 카드 그림. 카드마다 감정이 하나라 그 감정의 표정 그대로다.
export function CompanionArtwork({
  companion,
  aspectRatio = 1.25,
}: {
  companion: Companion;
  aspectRatio?: number;
}) {
  return (
    <View style={[styles.artwork, { aspectRatio }]}>
      <Image
        source={{ uri: companion.imageUrl }}
        resizeMode="contain"
        accessibilityLabel={companion.name}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      />
    </View>
  );
}
export function EquippedBadge() {
  return (
    <View style={styles.badge}>
      <AppText variant="caption" style={{ color: colors.white }}>
        장착 중
      </AppText>
    </View>
  );
}
export function CompanionNotice({ success = false }: { success?: boolean }) {
  return (
    <View
      style={styles.notice}
      accessibilityRole={success ? 'alert' : undefined}
    >
      {success ? (
        <Check size={24} color={colors.sage} />
      ) : (
        <Leaf size={24} color={colors.sage} />
      )}
      <AppText variant="small" style={{ flex: 1, color: colors.ink }}>
        {success
          ? '장착 완료!'
          : '새로 작성하는 일기부터 적용돼요.\n감정별로 선택한 모찌가 함께해요!'}
      </AppText>
    </View>
  );
}
export const OwnedCompanionCard = memo(function OwnedCompanionCard({
  mozzi,
  onSelect,
}: {
  mozzi: OwnedMozzi;
  onSelect: (mozzi: OwnedMozzi) => void;
}) {
  const { equipped } = mozzi;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mozzi.name}${equipped ? ', 장착 중' : ''}`}
      onPress={() => onSelect(mozzi)}
      style={[
        styles.ownedCard,
        equipped && {
          borderColor: colors.primary,
          backgroundColor: colors.peachPaper,
        },
      ]}
    >
      <View pointerEvents="none" style={styles.ownedBadge}>
        {equipped && <EquippedBadge />}
      </View>
      <CompanionArtwork companion={mozzi} aspectRatio={1} />
      <AppText
        variant="label"
        numberOfLines={2}
        style={{
          color: colors.ink,
          textAlign: 'center',
          minHeight: 48,
          fontSize: 18,
          lineHeight: 24,
        }}
      >
        {mozzi.name}
      </AppText>
    </Pressable>
  );
});

export function MyPageTitle({
  children,
  back = true,
}: {
  children: string;
  back?: boolean;
}) {
  return (
    <AppText
      accessibilityRole="header"
      variant="heading"
      style={{
        color: colors.ink,
        textAlign: 'center',
        marginRight: back ? 48 : 0,
      }}
    >
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  artwork: { width: '100%', overflow: 'hidden' },
  badge: {
    alignSelf: 'flex-end',
    backgroundColor: colors.sage,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  notice: {
    backgroundColor: colors.sageSoft,
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#D4DDCA',
  },
  ownedCard: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    gap: 6,
    borderRadius: 24,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    boxShadow: '0 3px 10px rgba(130, 86, 97, 0.05)',
    justifyContent: 'flex-start',
  },
  ownedBadge: {
    height: 24,
    width: '100%',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
