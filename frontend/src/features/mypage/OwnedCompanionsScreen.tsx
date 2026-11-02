import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, Leaf, Search, Star, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CozyScreen as Screen,
  CozyButton as Button,
} from '@/components/ui/CozyUI';
import { AppText } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { OwnedCompanionCard } from '@/components/mypage/CompanionUI';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { emotions, isEmotion } from '@/constants/emotions';
import { EmotionSlotPicker } from '@/components/mypage/EmotionSlotPicker';
import type { Emotion } from '@/types/diary';
import { tierOrder, tiers } from '@/constants/gacha';
import { cozyColors as colors } from '@/theme/cozy';
import { useOwnedMozzis } from '@/features/gacha/useGachaQueries';
import type { CompanionSort, OwnedMozzi } from '@/types/companion';
import type { Tier } from '@/types/gacha';

const sortLabels: Record<CompanionSort, string> = {
  recent: '최근 획득순',
  oldest: '오래된 획득순',
  name: '이름순',
};
// 보유 모찌 (GET /members/me/mozzis). 카드마다 감정이 하나라, 고른 감정의 카드만 그 감정에 장착할 수 있다.
// 거르기·정렬은 서버가 한다.
export function OwnedCompanionsScreen() {
  const params = useLocalSearchParams<{ emotion?: string }>();
  const [emotion, setEmotion] = useState<Emotion>(
    isEmotion(params.emotion) ? params.emotion : 'happy',
  );
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<Tier | null>(null);
  const [sort, setSort] = useState<CompanionSort>('recent');
  const [sheet, setSheet] = useState<'tier' | 'sort' | null>(null);
  const [pendingTier, setPendingTier] = useState<Tier | null>(null);
  const [pendingSort, setPendingSort] = useState<CompanionSort>('recent');
  const filters = useMemo(
    () => ({ emotion, tier, name: query.trim(), sort }),
    [emotion, tier, query, sort],
  );
  const owned = useOwnedMozzis(filters);
  const list = owned.data ?? [];
  const select = useCallback(
    (mozzi: OwnedMozzi) =>
      router.push({
        pathname: '/mypage/mochi/[id]',
        params: { id: String(mozzi.cardId), emotion: mozzi.emotion },
      }),
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: OwnedMozzi }) => (
      <View style={styles.cell}>
        <OwnedCompanionCard mozzi={item} onSelect={select} />
      </View>
    ),
    [select],
  );
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
        data={list}
        numColumns={3}
        keyExtractor={item => String(item.cardId)}
        renderItem={renderItem}
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
                <AppText style={{ color: colors.primary }}>
                  {owned.data ? `${list.length}종` : '-'}
                </AppText>
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
          </View>
        }
        ListEmptyComponent={
          owned.isError ? (
            <StatePanel
              compact
              title="보유 모찌를 불러오지 못했어요"
              description="연결 상태를 확인하고 다시 시도해 주세요."
              retry={() => void owned.refetch()}
              retryLabel="다시 불러오기"
            />
          ) : owned.isPending ? (
            <Loading label="보유 모찌를 불러오고 있어요" />
          ) : !query.trim() && !tier ? (
            <AppText style={{ textAlign: 'center', paddingVertical: 48 }}>
              {emotions[emotion].label} 모찌를 아직 만나지 못했어요.
            </AppText>
          ) : (
            <View style={{ gap: 16, paddingVertical: 48 }}>
              <AppText style={{ textAlign: 'center' }}>
                조건에 맞는 모찌가 없어요.
              </AppText>
              <Button
                label="검색·필터 초기화"
                variant="secondary"
                onPress={() => {
                  setQuery('');
                  setTier(null);
                }}
              />
            </View>
          )
        }
      />
      <Sheet
        visible={!!sheet}
        title={sheet === 'tier' ? '등급 선택' : '정렬 선택'}
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
        {sheet === 'tier' ? (
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.choice,
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
    borderRadius: 22,
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
  choice: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
