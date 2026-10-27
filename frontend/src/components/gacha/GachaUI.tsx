import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import type { MochiId, PullItem, Tier } from '@/types/gacha';
import { mochis, tiers } from '@/constants/gacha';
import { colors } from '@/theme/tokens';
import { AppText } from '@/components/ui/Text';

// Figma "Gacha V2 / Tier badge": 66 × 26, radius 12.
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <View
      style={{
        width: 66,
        height: 26,
        borderRadius: 12,
        backgroundColor: tiers[tier].badge,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="caption" style={{ color: tiers[tier].color }}>
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
  | { kind: 'owned'; id: MochiId; isNew?: boolean; shards?: number }
  | { kind: 'sealed' }
  | { kind: 'locked'; id: MochiId };
// Figma "Gacha V2 / Collection card": 108 × 142 in a 3-column grid.
export function MochiCard({
  state,
  onPress,
}: {
  state: CardState;
  onPress?: () => void;
}) {
  const tier = state.kind === 'sealed' ? null : mochis[state.id].tier;
  const owned = state.kind === 'owned';
  const borderColor = owned
    ? tiers[tier!].color
    : state.kind === 'sealed'
      ? colors.muted
      : colors.line;
  const label =
    state.kind === 'sealed'
      ? '열어보기'
      : state.kind === 'locked'
        ? '아직 못 만난 모찌'
        : `${mochis[state.id].name} ${tiers[tier!].label}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 142,
        backgroundColor: colors.white,
        borderRadius: 12,
        borderWidth: tier === 'myth' && owned ? 1.5 : 1,
        borderColor,
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
            fontSize: 10,
            lineHeight: 14,
            fontFamily: 'NotoSansKR_500Medium',
            color: colors.gachaRose,
          }}
        >
          NEW
        </AppText>
      )}
      {owned ? (
        <Image
          accessible={false}
          source={mochis[state.id].source}
          resizeMode="contain"
          style={{ width: 80, height: 80, borderRadius: 12 }}
        />
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
            : mochis[state.id].name}
      </AppText>
      <AppText
        variant="caption"
        style={{ color: owned ? tiers[tier!].color : colors.muted }}
      >
        {state.kind === 'sealed'
          ? '탭해서 확인'
          : state.kind === 'locked'
            ? tiers[tier!].label
            : state.shards
              ? `${tiers[tier!].label} · ✦ +${state.shards}`
              : tiers[tier!].label}
      </AppText>
    </Pressable>
  );
}
export const pullCardState = (item: PullItem): CardState => ({
  kind: 'owned',
  id: item.id,
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
