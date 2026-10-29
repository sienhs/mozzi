import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { DiaryCard, DiaryRow } from '@/components/ui/DiaryCard';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotions } from '@/constants/emotions';
import { todayKey } from '@/constants/date';
import { colors } from '@/theme/tokens';
import { apiErrorMessage } from '@/services/authErrors';
import {
  SEARCH_QUESTION_MAX,
  searchApi,
  searchKeys,
} from '@/services/searchApi';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  toAppEmotion,
  toDiaryEntry,
  toSummaryEntry,
} from '@/features/diary/serverDiary';
import type { DiaryEntry } from '@/types/diary';

// 감정 검색 (POST /emotion-search). 서버가 질문을 해석해 기록을 찾고 답을 만든다.
// 결과는 FOUND(답 + 큰 카드 + 기록 행), EMPTY(기록 없음), STATS_ONLY(감정별 날 수) 중 하나다.
export function SearchScreen() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const { question: initialQuestion } = useLocalSearchParams<{
    question?: string;
  }>();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const pending = useRef(false);
  const suggestions = useQuery({
    queryKey: searchKeys.suggestions(memberId ?? 0),
    queryFn: searchApi.suggestions,
    enabled: memberId !== undefined,
    staleTime: 5 * 60_000,
  });
  const search = useMutation({ mutationFn: searchApi.ask, retry: false });
  const { mutateAsync } = search;
  const ask = useCallback(
    async (value: string) => {
      const query = value.trim();
      if (!query || pending.current) return;
      Keyboard.dismiss();
      pending.current = true;
      setQuestion(query);
      setInput('');
      try {
        await mutateAsync(query);
      } catch {
        /* The error card provides a retry. */
      } finally {
        pending.current = false;
      }
    },
    [mutateAsync],
  );
  useEffect(() => {
    if (__DEV__ && initialQuestion) void ask(initialQuestion);
  }, [ask, initialQuestion]);
  const openEntry = (entry: DiaryEntry) =>
    router.push({
      pathname: '/diary/[id]',
      params: { id: entry.id, date: entry.date },
    });
  const result = search.data;
  const today = todayKey();
  const featured = result?.featured
    ? toDiaryEntry(result.featured, { today })
    : null;
  const rows = (result?.diaries ?? [])
    .filter(item => item.diaryId !== featured?.serverId)
    .map(item => toSummaryEntry(item, today));
  return (
    <Screen
      tabbed
      title="감정 검색"
      contentStyle={{ gap: question ? 16 : 24 }}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Input
              accessibilityLabel="궁금한 날을 물어보세요"
              placeholder="궁금한 날을 물어보세요"
              value={input}
              onChangeText={setInput}
              maxLength={SEARCH_QUESTION_MAX}
              returnKeyType="search"
              onSubmitEditing={() => void ask(input)}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="질문 보내기"
            accessibilityState={{
              disabled: !input.trim() || search.isPending,
              busy: search.isPending,
            }}
            disabled={!input.trim() || search.isPending}
            onPress={() => void ask(input)}
            style={{
              width: 56,
              height: 56,
              backgroundColor:
                input.trim() && !search.isPending
                  ? colors.primary
                  : colors.line,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {search.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Icon name="send" color={colors.white} />
            )}
          </Pressable>
        </View>
      }
    >
      {!question ? (
        <>
          <Heading
            eyebrow="모찌와 찾는 기억"
            title={'지난 마음을 물어보세요'}
            description="남긴 기록에서 모찌가 찾아 드려요."
          />
          <View style={{ gap: 8 }}>
            <AppText variant="small">이렇게 물어볼 수 있어요</AppText>
            {suggestions.isPending && memberId !== undefined && (
              <Loading label="추천 질문을 불러오고 있어요" />
            )}
            {suggestions.isError && (
              <StatePanel
                compact
                title="추천 질문을 불러오지 못했어요"
                description="궁금한 날을 직접 물어볼 수도 있어요."
                retry={() => void suggestions.refetch()}
                retryLabel="다시 불러오기"
              />
            )}
            {(suggestions.data ?? []).map(text => (
              <Pressable
                key={text}
                accessibilityRole="button"
                onPress={() => void ask(text)}
                style={{
                  backgroundColor: colors.paper,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.paperEdge,
                  borderLeftWidth: 4,
                  borderLeftColor: colors.sage,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  minHeight: 52,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <AppText style={{ flex: 1 }}>{text}</AppText>
                <Icon name="chevronRight" size={18} color={colors.sage} />
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <View
            style={{
              alignSelf: 'flex-start',
              maxWidth: '100%',
              backgroundColor: colors.soft,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              borderBottomRightRadius: 6,
            }}
          >
            <AppText>{question}</AppText>
          </View>
          {search.isPending ? (
            <Loading label="남긴 기록을 찾고 있어요" />
          ) : search.isError ? (
            <StatePanel
              compact
              title="지금은 답을 찾지 못했어요"
              description={apiErrorMessage(
                search.error,
                '연결이 잠시 불안정해요. 한 번 더 물어봐 주세요.',
              )}
              retry={() => void ask(question)}
            />
          ) : result?.resultType === 'EMPTY' ? (
            <StatePanel
              title="찾는 기록이 아직 없어요"
              description={
                '다른 말로 물어보거나\n기간을 넓혀서 다시 물어보세요.'
              }
            />
          ) : result?.resultType === 'STATS_ONLY' ? (
            <>
              <AppText>{result.answer}</AppText>
              {result.emotionCounts.map(({ emotion, count }) => (
                <View
                  key={emotion}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <EmotionImage emotion={toAppEmotion(emotion)} size={28} />
                  <AppText style={{ flex: 1 }}>
                    {emotions[toAppEmotion(emotion)].label}
                  </AppText>
                  <AppText variant="label">{count}일</AppText>
                </View>
              ))}
            </>
          ) : (
            result &&
            featured && (
              <>
                <AppText>{result.answer}</AppText>
                <DiaryCard
                  entry={featured}
                  onPress={() => openEntry(featured)}
                />
                {rows.map(entry => (
                  <DiaryRow
                    key={entry.id}
                    entry={entry}
                    onPress={() => openEntry(entry)}
                  />
                ))}
              </>
            )
          )}
        </>
      )}
    </Screen>
  );
}
