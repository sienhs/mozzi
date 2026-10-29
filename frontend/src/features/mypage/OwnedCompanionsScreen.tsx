import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, Leaf, Search, Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { OwnedCompanionCard } from '@/components/mypage/CompanionUI';
import { mochiCategories } from '@/constants/companions';
import { emotions, isEmotion } from '@/constants/emotions';
import { EmotionSlotPicker } from '@/components/mypage/EmotionSlotPicker';
import type { Emotion } from '@/types/diary';
import { tierOrder, tiers } from '@/constants/gacha';
import { colors } from '@/theme/tokens';
import { useGachaStore } from '@/stores/useGachaStore';
import type {
  CompanionId,
  CompanionSort,
  MochiCategory,
} from '@/types/companion';
import type { Tier } from '@/types/gacha';
import { filterOwnedCompanions, ownedCompanionIds } from './ownedCompanions';

const sortLabels: Record<CompanionSort, string> = {
  recent: '최근 획득순',
  oldest: '오래된 획득순',
  name: '이름순',
};
export function OwnedCompanionsScreen() {
  const owned = useGachaStore(state => state.owned);
  const acquiredAt = useGachaStore(state => state.acquiredAt);
  const params = useLocalSearchParams<{ emotion?: string }>();
  const [emotion, setEmotion] = useState<Emotion>(
    isEmotion(params.emotion) ? params.emotion : 'happy',
  );
  const equippedId = useGachaStore(state => state.equippedByEmotion[emotion]);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<MochiCategory | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [sort, setSort] = useState<CompanionSort>('recent');
  const [sheet, setSheet] = useState<'category' | 'tier' | 'sort' | null>(null);
  const [pendingCategory, setPendingCategory] = useState<MochiCategory | null>(
    null,
  );
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [pendingSort, setPendingSort] = useState<CompanionSort>('recent');
  const ids = useMemo(
    () =>
      filterOwnedCompanions({ owned, acquiredAt, query, category, tier, sort }),
    [owned, acquiredAt, query, category, tier, sort],
  );
  const total = ownedCompanionIds(owned).length;
  const select = useCallback(
    (id: CompanionId) =>
      router.push({ pathname: '/mypage/mochi/[id]', params: { id, emotion } }),
    [emotion],
  );
  const renderItem = useCallback(
    ({ item }: { item: CompanionId }) => (
      <View style={styles.cell}>
        <OwnedCompanionCard
          id={item}
          equipped={item === equippedId}
          onSelect={select}
        />
      </View>
    ),
    [equippedId, select],
  );
  const categoryLabel =
    mochiCategories.find(item => item.id === category)?.label ?? '전체';
  return (
    <Screen
      back
      title="보유 모찌"
      titleContent={
        <AppText
          accessibilityRole="header"
          variant="title"
          style={{ textAlign: 'center', marginRight: 48 }}
        >
          보유 모찌
        </AppText>
      }
      scrollable={false}
    >
      <FlatList
        data={ids}
        numColumns={3}
        keyExtractor={id => id}
        renderItem={renderItem}
        extraData={equippedId}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 20),
          gap: 10,
        }}
        columnWrapperStyle={{ gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingTop: 8, paddingBottom: 4 }}>
            <AppText variant="label">
              {emotions[emotion].label}에 함께할 모찌
            </AppText>
            <EmotionSlotPicker value={emotion} onChange={setEmotion} />
            <View style={{ position: 'relative' }}>
              <Input
                accessibilityLabel="모찌 이름 검색"
                placeholder="모찌 이름 검색"
                value={query}
                onChangeText={setQuery}
                style={{ paddingLeft: 44 }}
              />
              <View pointerEvents="none" style={styles.searchIcon}>
                <Search size={20} color={colors.muted} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <FilterButton
                label={category ? categoryLabel : '카테고리 · 전체'}
                active={!!category}
                onPress={() => {
                  setPendingCategory(category);
                  setSheet('category');
                }}
              />
              <FilterButton
                label={tier ? tiers[tier].label : '등급 · 전체'}
                iconColor={tier ? tiers[tier].color : colors.gachaGoldInk}
                active={!!tier}
                onPress={() => {
                  setPendingTier(tier);
                  setSheet('tier');
                }}
                star
              />
            </View>
            <View style={styles.listHeading}>
              <AppText variant="small" style={{ color: colors.ink, flex: 1 }}>
                보유 모찌{' '}
                <AppText style={{ color: colors.primary }}>{total}종</AppText>
              </AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`정렬: ${sortLabels[sort]}`}
                onPress={() => {
                  setPendingSort(sort);
                  setSheet('sort');
                }}
                style={styles.sortButton}
              >
                <AppText variant="caption" style={{ color: colors.ink }}>
                  {sortLabels[sort]}
                </AppText>
                <ChevronDown size={16} color={colors.ink} />
              </Pressable>
            </View>
            {owned.some(id => !acquiredAt[id]) && (
              <AppText variant="caption">
                획득일이 없는 모찌는 마지막에 이름순으로 표시돼요.
              </AppText>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={{ gap: 16, paddingVertical: 48 }}>
            <AppText style={{ textAlign: 'center' }}>
              조건에 맞는 모찌가 없어요.
            </AppText>
            <Button
              label="검색·필터 초기화"
              variant="secondary"
              onPress={() => {
                setQuery('');
                setCategory(null);
                setTier(null);
              }}
            />
          </View>
        }
      />
      <Sheet
        visible={!!sheet}
        title={
          sheet === 'category'
            ? '카테고리 선택'
            : sheet === 'tier'
              ? '등급 선택'
              : '정렬 선택'
        }
        onClose={() => setSheet(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="필터 닫기"
          onPress={() => setSheet(null)}
          style={{
            alignSelf: 'flex-end',
            minWidth: 44,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X color={colors.ink} size={24} />
        </Pressable>
        {sheet === 'category' ? (
          <View style={styles.categoryGrid}>
            {[{ id: null, label: '전체' }, ...mochiCategories].map(item => (
              <Choice
                key={item.id ?? 'all'}
                label={item.label}
                selected={pendingCategory === item.id}
                onPress={() => setPendingCategory(item.id)}
                grid
              />
            ))}
          </View>
        ) : sheet === 'tier' ? (
          <View style={{ gap: 8 }}>
            <Choice
              label="전체"
              selected={pendingTier === null}
              onPress={() => setPendingTier(null)}
            />
            {tierOrder.map(id => (
              <Choice
                key={id}
                label={tiers[id].label}
                selected={pendingTier === id}
                color={tiers[id].color}
                onPress={() => setPendingTier(id)}
              />
            ))}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {(Object.keys(sortLabels) as CompanionSort[]).map(id => (
              <Choice
                key={id}
                label={sortLabels[id]}
                selected={pendingSort === id}
                onPress={() => setPendingSort(id)}
              />
            ))}
          </View>
        )}
        <Button
          label="적용하기"
          onPress={() => {
            if (sheet === 'category') setCategory(pendingCategory);
            if (sheet === 'tier') setTier(pendingTier);
            if (sheet === 'sort') setSort(pendingSort);
            setSheet(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}
function FilterButton({
  label,
  active,
  onPress,
  star,
  iconColor = colors.sage,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  star?: boolean;
  iconColor?: string;
}) {
  const Symbol = star ? Star : Leaf;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.filter,
        active && {
          borderColor: colors.primary,
          backgroundColor: colors.peachPaper,
        },
      ]}
    >
      <Symbol
        size={18}
        color={iconColor}
        fill={star ? iconColor : colors.sageSoft}
      />
      <AppText variant="caption" style={{ flex: 1, color: colors.ink }}>
        {label}
      </AppText>
      <ChevronDown size={14} color={colors.muted} />
    </Pressable>
  );
}
function Choice({
  label,
  selected,
  onPress,
  color,
  grid,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  grid?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
        grid && { width: '31%' },
        selected && {
          backgroundColor: colors.sageSoft,
          borderColor: colors.sage,
        },
      ]}
    >
      <AppText
        variant="small"
        style={{ color: color ?? colors.ink, textAlign: 'center' }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  cell: { width: '31.6%', flexGrow: 0 },
  searchIcon: { position: 'absolute', top: 18, left: 14 },
  filter: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 10,
    minHeight: 48,
  },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 48,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
