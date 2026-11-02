import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import type { MochiCard as Card, PullItem, Tier } from '@/types/gacha';
import { tiers } from '@/constants/gacha';
import { colors, fonts } from '@/theme/tokens';
import { AppText } from '@/components/ui/Text';

// Figma "Gacha V2 / Tier badge": 66 × 26, radius 12.
// compact는 카드 그리드처럼 좁은 칸에 이름과 함께 놓는 작은 배지다.
export function TierBadge({
  tier,
  compact,
}: {
  tier: Tier;
  compact?: boolean;
}) {
  return (
    <View
      style={{
        width: compact ? undefined : 66,
        height: compact ? 22 : 26,
        paddingHorizontal: compact ? 10 : 0,
        borderRadius: compact ? 11 : 12,
        backgroundColor: tiers[tier].badge,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText
        variant="caption"
        style={[
          { color: tiers[tier].color },
          compact && { fontSize: 12, lineHeight: 18 },
        ]}
      >
        {tiers[tier].label}
      </AppText>
    </View>
  );
}
// Figma "Gacha V2 / Balance": cream chip, 34 tall.
export function BalanceChip({
  label,
  onPress,
  compact,
}: {
  label: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  const content = (
    <AppText
      variant={compact ? 'small' : 'caption'}
      style={{ color: colors.ink }}
    >
      {label}
    </AppText>
  );
  const style = {
    width: compact ? 86 : 104,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.gachaCream,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={7}
      style={style}
    >
      {content}
    </Pressable>
  ) : (
    <View accessibilityLabel={label} style={style}>
      {content}
    </View>
  );
}
// White pill used for "확률 보기", filters and "건너뛰기".
export function GachaChip({
  label,
  onPress,
  active,
  dark,
  width,
}: {
  label: string;
  onPress?: () => void;
  active?: boolean;
  dark?: boolean;
  width: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={8}
      style={{
        width,
        paddingVertical: 5,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: dark
          ? colors.gachaNavySoft
          : active
            ? colors.primary
            : colors.white,
      }}
    >
      <AppText
        variant="caption"
        style={{ color: dark || active ? colors.white : colors.muted }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
type CardState =
  | { kind: 'owned'; card: Card; isNew?: boolean; shards?: number }
  | { kind: 'sealed' }
  // 아직 없는 카드. 도감에서는 이름·그림을 가린다.
  | { kind: 'locked'; card: Card };
// Figma "Gacha V2 / Collection card": 108 × 142 in a 3-column grid.
// 결과 화면 배경 위에 그림과 이름만 놓이도록 카드 테두리·배경은 두지 않는다.
export function MochiCard({
  state,
  onPress,
}: {
  state: CardState;
  onPress?: () => void;
}) {
  const tier = state.kind === 'sealed' ? null : state.card.tier;
  const owned = state.kind === 'owned';
  const label =
    state.kind === 'sealed'
      ? '열어보기'
      : state.kind === 'locked'
        ? '아직 못 만난 모찌'
        : `${state.card.name} ${tiers[tier!].label}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 142,
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: 'center',
        gap: 4,
      }}
    >
      {owned && state.isNew && (
        <AppText
          style={{
            position: 'absolute',
            left: 5,
            top: 4,
            fontSize: 14,
            lineHeight: 20,
            fontFamily: fonts.medium,
            color: colors.gachaRose,
          }}
        >
          NEW
        </AppText>
      )}
      {owned ? (
        // 등급 색을 연하게 깐 원 위에 그림을 올려, 펼쳐 놓았을 때 색만으로도 등급이 갈린다.
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: tiers[tier!].badge,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            accessible={false}
            source={{ uri: state.card.imageUrl }}
            resizeMode="contain"
            style={{ width: 72, height: 72 }}
          />
        </View>
      ) : (
        <View style={{ width: 80, height: 80, alignItems: 'center' }}>
          <AppText variant="heading" style={{ color: colors.gachaGoldInk }}>
            {state.kind === 'sealed' ? '✦' : '?'}
          </AppText>
        </View>
      )}
      <AppText variant="caption" style={{ color: colors.ink }}>
        {state.kind === 'sealed'
          ? '열어보기'
          : state.kind === 'locked'
            ? '???'
            : state.card.name}
      </AppText>
      {owned ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TierBadge tier={tier!} compact />
          {!!state.shards && (
            <AppText variant="caption" style={{ fontSize: 12 }}>
              ✦ +{state.shards}
            </AppText>
          )}
        </View>
      ) : (
        <AppText variant="caption" style={{ color: colors.muted }}>
          {state.kind === 'sealed' ? '탭해서 확인' : tiers[tier!].label}
        </AppText>
      )}
    </Pressable>
  );
}
export const pullCardState = (item: PullItem): CardState => ({
  kind: 'owned',
  card: item.card,
  isNew: item.isNew,
  shards: item.shards,
});
// Three equal columns (Figma: 108 wide, column gap 13, row gap 12); short rows keep their slots.
export function CardGrid({ children }: { children: ReactNode[] }) {
  const rows = Array.from({ length: Math.ceil(children.length / 3) }, (_, i) =>
    children.slice(i * 3, i * 3 + 3),
  );
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: 'row', gap: 13 }}>
          {row}
          {Array.from({ length: 3 - row.length }, (_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}
