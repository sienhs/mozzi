import { Image, Pressable, StyleSheet, View } from 'react-native';
import { BookOpen, LockKeyhole } from 'lucide-react-native';
import { AppText } from '@/components/ui/Text';
import { cozyColors as colors } from '@/theme/cozy';
import { tiers, gachaArt } from '@/constants/gacha';
import { TierBadge } from '@/components/gacha/GachaUI';
import type { MochiCard } from '@/types/gacha';

export function AlbumCover({ owned, total }: { owned: number; total: number }) {
  return (
    <View style={styles.cover}>
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <BookOpen size={18} color="#7A668F" />
          <AppText variant="label" style={{ color: colors.ink }}>
            모은 모찌 {owned} / {total}
          </AppText>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="모찌 수집 진행률"
          accessibilityValue={{ min: 0, max: total, now: owned }}
          style={styles.track}
        >
          <View
            style={[
              styles.progress,
              { width: `${total ? Math.min(100, (owned / total) * 100) : 0}%` },
            ]}
          />
        </View>
      </View>
      <View style={styles.coverSticker}>
        <Image
          accessible={false}
          source={gachaArt.mochi}
          resizeMode="contain"
          style={{ width: 56, height: 56 }}
        />
      </View>
    </View>
  );
}

export function AlbumChip({
  label,
  onPress,
  active,
  width,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  width: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[
        styles.chip,
        { minWidth: Math.min(width, 82) },
        active && styles.activeChip,
      ]}
    >
      <AppText
        variant="caption"
        style={{ color: active ? '#665176' : colors.muted }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

// This is presentation only. CollectionScreen still owns data, filtering and navigation.
// Missing cards keep the same hidden name/image policy as the original collection.
export function AlbumCard({
  state,
  onPress,
}: {
  state:
    | { kind: 'owned'; card: MochiCard; isNew?: boolean }
    | { kind: 'locked'; card: MochiCard };
  onPress?: () => void;
}) {
  const owned = state.kind === 'owned';
  const tier = tiers[state.card.tier];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        owned ? `${state.card.name} ${tier.label}` : '아직 못 만난 모찌'
      }
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, !owned && styles.lockedCard]}
    >
      <View style={styles.newSlot}>
        {state.kind === 'owned' && state.isNew && (
          <AppText variant="caption" style={styles.newBadge}>
            NEW
          </AppText>
        )}
      </View>
      <View
        style={[
          styles.artwork,
          // 테두리에도 등급 색을 연하게 둘러 배지를 읽지 않아도 등급이 갈린다.
          owned
            ? { backgroundColor: tier.badge, borderColor: `${tier.color}59` }
            : { backgroundColor: colors.line },
        ]}
      >
        {owned ? (
          <Image
            accessible={false}
            source={{ uri: state.card.imageUrl }}
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <LockKeyhole
            accessible={false}
            size={26}
            color={colors.border}
            strokeWidth={1.4}
          />
        )}
      </View>
      <AppText
        variant="label"
        numberOfLines={2}
        textBreakStrategy="balanced"
        lineBreakStrategyIOS="hangul-word"
        style={styles.name}
      >
        {owned ? state.card.name : '???'}
      </AppText>
      <TierBadge tier={state.card.tier} compact />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cover: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 26,
    backgroundColor: '#FCFAFF',
    borderWidth: 1,
    borderColor: '#E4DCEE',
  },
  coverSticker: {
    padding: 5,
    borderRadius: 24,
    backgroundColor: colors.paper,
    transform: [{ rotate: '6deg' }],
    boxShadow: '0 2px 6px rgba(117, 74, 82, 0.08)',
  },
  track: {
    height: 6,
    borderRadius: 4,
    backgroundColor: '#EEE8F3',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#9A89AD',
  },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.paperEdge,
  },
  activeChip: { backgroundColor: '#F0EBF8', borderColor: '#D9CEE6' },
  card: {
    flex: 1,
    minWidth: 0,
    padding: 7,
    paddingBottom: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.paperEdge,
    backgroundColor: colors.paper,
    alignItems: 'center',
    gap: 7,
    boxShadow: '0 3px 10px rgba(117, 74, 82, 0.05)',
  },
  lockedCard: {
    backgroundColor: '#F8F4F1',
    borderStyle: 'dashed',
    boxShadow: 'none',
  },
  newSlot: { height: 18, width: '100%', alignItems: 'flex-start' },
  newBadge: {
    fontSize: 10,
    lineHeight: 16,
    color: '#785C2D',
    backgroundColor: colors.butter,
    paddingHorizontal: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
  artwork: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    lineHeight: 21,
    minHeight: 42,
    textAlign: 'center',
  },
});
