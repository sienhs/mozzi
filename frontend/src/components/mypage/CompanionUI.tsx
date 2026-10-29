import { memo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Check, Leaf } from 'lucide-react-native';
import { companions } from '@/constants/companions';
import { colors } from '@/theme/tokens';
import { AppText } from '@/components/ui/Text';
import type { CompanionId } from '@/types/companion';

export function CompanionArtwork({
  id,
  aspectRatio = 1.25,
}: {
  id: CompanionId;
  aspectRatio?: number;
}) {
  return (
    <View style={[styles.artwork, { aspectRatio }]}>
      <Image
        source={companions[id].source}
        resizeMode="contain"
        accessibilityLabel={companions[id].name}
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
  id,
  equipped,
  onSelect,
}: {
  id: CompanionId;
  equipped: boolean;
  onSelect: (id: CompanionId) => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${companions[id].name}${equipped ? ', 장착 중' : ''}`}
      onPress={() => onSelect(id)}
      style={[
        styles.ownedCard,
        equipped && {
          borderColor: colors.primary,
          backgroundColor: colors.peachPaper,
        },
      ]}
    >
      {equipped && (
        <View pointerEvents="none" style={styles.ownedBadge}>
          <EquippedBadge />
        </View>
      )}
      <CompanionArtwork id={id} aspectRatio={1} />
      <AppText
        variant="small"
        style={{ color: colors.ink, textAlign: 'center' }}
      >
        {companions[id].name}
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
      style={{ textAlign: 'center', marginRight: back ? 48 : 0 }}
    >
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  artwork: { width: '100%' },
  badge: {
    alignSelf: 'flex-end',
    backgroundColor: colors.sage,
    borderRadius: 16,
    paddingHorizontal: 10,
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
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.paperEdge,
    justifyContent: 'flex-end',
  },
  ownedBadge: { position: 'absolute', top: 8, right: 8, zIndex: 1 },
});
