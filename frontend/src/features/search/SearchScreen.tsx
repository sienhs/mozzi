import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  Pressable,
  View,
} from 'react-native';
import { Heading } from '@/components/ui/Screen';
import { CozyScreen as Screen } from '@/components/ui/CozyUI';
import { AppText } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { DiaryCard, DiaryRow } from '@/components/ui/DiaryCard';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { EmotionImage } from '@/components/emotion/Emotion';
import { emotionOrder, emotions } from '@/constants/emotions';
import { todayKey } from '@/constants/date';
import { gachaArt } from '@/constants/gacha';
import { cozyColors as colors } from '@/theme/cozy';
import { apiErrorMessage } from '@/services/authErrors';
import {
  SEARCH_QUESTION_MAX,
  searchApi,
  searchKeys,
} from '@/services/searchApi';
import { searchHistory } from '@/services/searchHistory';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  toAppEmotion,
  toDiaryEntry,
  toSummaryEntry,
} from '@/features/diary/serverDiary';
import type { DiaryEntry, Emotion } from '@/types/diary';
import type { SearchFilter, ServerEmotion } from '@/types/server';

// 감정 검색 (POST /emotion-search). 서버가 질문을 해석해 기록을 찾고 답을 만든다.
// 결과는 FOUND(답 + 큰 카드 + 기록 행), EMPTY(기록 없음), STATS_ONLY(감정별 날 수) 중 하나다.
// 화면은 두 단계다: 처음(감정별·최근·추천 질문) → 질문과 답. 뒤로 가기(머리줄·기기 버튼)는 처음으로 돌아온다.

// 감정 하나로 바로 물어보는 질문. 서버가 감정 조건으로 알아듣기 쉬운 말로 둔다.
const emotionQuestion = (emotion: Emotion) =>
  `${emotions[emotion].label} 모찌를 고른 날을 보여 줘`;
// 기간을 바꿔 돌아보는 질문(통계로 답이 온다).
const periodQuestions = [
  '이번 주엔 어떤 기분이 많았어?',
  '지난달엔 어떤 기분이 많았어?',
];
// 이 글자 수부터 입력창 아래에 남은 글자를 보여 준다.
const COUNTER_FROM = 150;

export function SearchScreen() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const { question: initialQuestion } = useLocalSearchParams<{
    question?: string;
  }>();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const pending = useRef(false);
  const suggestions = useQuery({
    queryKey: searchKeys.suggestions(memberId ?? 0),
    queryFn: searchApi.suggestions,
    enabled: memberId !== undefined,
    staleTime: 5 * 60_000,
  });
  const search = useMutation({ mutationFn: searchApi.ask, retry: false });
  const { mutateAsync, reset } = search;

  useEffect(() => {
    if (memberId === undefined) return;
    let active = true;
    void searchHistory.read(memberId).then(list => {
      if (active) setRecent(list);
    });
    return () => {
      active = false;
    };
  }, [memberId]);

  const ask = useCallback(
    async (value: string) => {
      const query = value.trim();
      if (!query || pending.current) return;
      Keyboard.dismiss();
      pending.current = true;
      setQuestion(query);
      setInput('');
      if (memberId !== undefined)
        void searchHistory.add(memberId, query).then(setRecent);
      try {
        await mutateAsync(query);
      } catch {
        /* The error card provides a retry. */
      } finally {
        pending.current = false;
      }
    },
    [mutateAsync, memberId],
  );
  // 처음 화면으로 돌아간다. 지난 답은 지워 다음 질문에 섞이지 않게 한다.
  const restart = useCallback(() => {
    setQuestion('');
    reset();
  }, [reset]);
  useEffect(() => {
    if (__DEV__ && initialQuestion) void ask(initialQuestion);
  }, [ask, initialQuestion]);
  useFocusEffect(
    useCallback(() => {
      if (!question) return;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          restart();
          return true;
        },
      );
      return () => subscription.remove();
    }, [question, restart]),
  );
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
  // 답을 본 뒤 이어서 물어볼 만한 다른 질문(지금 질문은 뺀다).
  const followUps = [...(suggestions.data ?? []), ...periodQuestions]
    .filter(text => text !== question)
    .slice(0, 3);
  const removeRecent = (text: string) => {
    if (memberId !== undefined)
      void searchHistory.remove(memberId, text).then(setRecent);
  };
  const clearRecent = () => {
    if (memberId !== undefined)
      void searchHistory.clear(memberId).then(setRecent);
  };
  const trimmed = input.trim();
  return (
    <Screen
      tabbed
      title="감정 검색"
      back={!!question}
      onBack={restart}
      contentStyle={{ gap: question ? 16 : 24 }}
      footer={
        <View style={{ gap: 6 }}>
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
                disabled: !trimmed || search.isPending,
                busy: search.isPending,
              }}
              disabled={!trimmed || search.isPending}
              onPress={() => void ask(input)}
              style={{
                width: 56,
                height: 56,
                backgroundColor:
                  trimmed && !search.isPending ? colors.primary : colors.line,
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
          {input.length >= COUNTER_FROM && (
            <AppText
              variant="caption"
              style={{
                alignSelf: 'flex-end',
                color:
                  input.length >= SEARCH_QUESTION_MAX
                    ? colors.primary
                    : colors.muted,
              }}
            >
              {input.length}/{SEARCH_QUESTION_MAX}
            </AppText>
          )}
        </View>
      }
    >
      {!question ? (
        <>
          <Heading
            title="지난 마음을 물어보세요"
            description="날짜, 감정, 함께한 사람으로 물어보면 기록을 찾아 줘요."
          />
          <Section title="감정으로 찾기">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {emotionOrder.map(emotion => (
                <Pressable
                  key={emotion}
                  accessibilityRole="button"
                  accessibilityLabel={emotionQuestion(emotion)}
                  onPress={() => void ask(emotionQuestion(emotion))}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: 10,
                      borderRadius: 18,
                      backgroundColor: emotions[emotion].color,
                    },
                    pressed && { transform: [{ scale: 0.95 }] },
                  ]}
                >
                  <EmotionImage emotion={emotion} size={36} />
                  <AppText variant="caption" style={{ color: colors.ink }}>
                    {emotions[emotion].label}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </Section>
          {!!recent.length && (
            <Section
              title="최근 물어본 질문"
              action={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="최근 질문 모두 지우기"
                  onPress={clearRecent}
                  hitSlop={8}
                >
                  <AppText variant="caption" style={{ color: colors.muted }}>
                    모두 지우기
                  </AppText>
                </Pressable>
              }
            >
              <View>
                {recent.map(text => (
                  <View
                    key={text}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`최근 질문 ${text}`}
                      onPress={() => void ask(text)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        minHeight: 44,
                        paddingHorizontal: 4,
                      }}
                    >
                      <Icon name="refresh" size={16} color={colors.muted} />
                      <AppText numberOfLines={1} style={{ flex: 1 }}>
                        {text}
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${text} 지우기`}
                      onPress={() => removeRecent(text)}
                      hitSlop={8}
                      style={{
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon name="close" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </Section>
          )}
          <Section title="이렇게 물어볼 수 있어요">
            <View style={{ gap: 8 }}>
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
              {[...(suggestions.data ?? []), ...periodQuestions].map(text => (
                <SuggestionCard
                  key={text}
                  text={text}
                  onPress={() => void ask(text)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : (
        <>
          {/* 내 질문은 오른쪽 말풍선. 누르면 입력창에 다시 넣어 고쳐 물어볼 수 있다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`내 질문 ${question}`}
            accessibilityHint="눌러서 질문을 고쳐 다시 물어볼 수 있어요."
            onPress={() => setInput(question)}
            style={{
              alignSelf: 'flex-end',
              maxWidth: '86%',
              backgroundColor: colors.primary,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              borderBottomRightRadius: 6,
            }}
          >
            <AppText style={{ color: colors.white }}>{question}</AppText>
          </Pressable>
          {search.isPending ? (
            <AnswerBubble>
              <Loading label="남긴 기록을 찾고 있어요" />
            </AnswerBubble>
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
            <>
              <FilterChips filter={result.filter} />
              <StatePanel
                title="찾는 기록이 아직 없어요"
                description={
                  '다른 말로 물어보거나\n기간을 넓혀서 다시 물어보세요.'
                }
              />
            </>
          ) : result?.resultType === 'STATS_ONLY' ? (
            <>
              <AnswerBubble>
                <AppText>{result.answer}</AppText>
              </AnswerBubble>
              <FilterChips filter={result.filter} />
              <EmotionBars counts={result.emotionCounts} />
            </>
          ) : (
            result &&
            featured && (
              <>
                <AnswerBubble>
                  <AppText>{result.answer}</AppText>
                </AnswerBubble>
                <FilterChips
                  filter={result.filter}
                  count={result.matchedCount}
                />
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
          {!search.isPending && (
            <View style={{ gap: 8, marginTop: 8 }}>
              {!!followUps.length && (
                <AppText variant="caption" style={{ color: colors.muted }}>
                  이어서 물어보기
                </AppText>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {followUps.map(text => (
                  <Pressable
                    key={text}
                    accessibilityRole="button"
                    accessibilityLabel={text}
                    onPress={() => void ask(text)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: colors.paper,
                      borderWidth: 1,
                      borderColor: colors.paperEdge,
                    }}
                  >
                    <AppText variant="small" style={{ color: colors.ink }}>
                      {text}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="추천 질문으로 돌아가기"
                onPress={restart}
                style={{
                  alignSelf: 'center',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  minHeight: 44,
                  paddingHorizontal: 12,
                }}
              >
                <AppText variant="small" style={{ color: colors.primary }}>
                  추천 질문으로 돌아가기
                </AppText>
              </Pressable>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AppText variant="label" style={{ color: colors.ink }}>
          {title}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

function SuggestionCard({
  text,
  onPress,
}: {
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.roseWash : colors.paper,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.paperEdge,
        paddingHorizontal: 16,
        paddingVertical: 14,
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      })}
    >
      <AppText style={{ flex: 1 }}>{text}</AppText>
    </Pressable>
  );
}

// 모찌의 답. 왼쪽 말풍선이다.
function AnswerBubble({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.peachPaper,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={gachaArt.mochi}
          accessible={false}
          resizeMode="contain"
          style={{ width: 30, height: 30 }}
        />
      </View>
      <View
        style={{
          flexShrink: 1,
          maxWidth: '86%',
          backgroundColor: colors.paper,
          borderWidth: 1,
          borderColor: colors.paperEdge,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 20,
          borderBottomLeftRadius: 6,
        }}
      >
        {children}
      </View>
    </View>
  );
}

// 서버가 질문을 어떻게 알아들었는지(기간·감정·키워드). 다르게 알아들었으면 고쳐 물을 수 있게 보여 준다.
const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`;
function FilterChips({
  filter,
  count,
}: {
  filter: SearchFilter | null;
  count?: number | null;
}) {
  const chips: string[] = [];
  if (filter?.from || filter?.to)
    chips.push(
      filter.from && filter.from === filter.to
        ? shortDate(filter.from)
        : `${filter.from ? shortDate(filter.from) : '처음'} ~ ${filter.to ? shortDate(filter.to) : '오늘'}`,
    );
  for (const emotion of filter?.emotions ?? [])
    chips.push(emotions[toAppEmotion(emotion)].label);
  if (filter?.keyword) chips.push(`‘${filter.keyword}’`);
  if (count) chips.push(`기록 ${count}개`);
  if (!chips.length) return null;
  return (
    <View
      accessible
      accessibilityLabel={`찾은 조건 ${chips.join(', ')}`}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 44,
      }}
    >
      <AppText variant="caption" style={{ color: colors.muted }}>
        이렇게 찾았어요
      </AppText>
      {chips.map(chip => (
        <View
          key={chip}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 12,
            backgroundColor: colors.lavender,
          }}
        >
          <AppText variant="caption" style={{ color: colors.ink }}>
            {chip}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// 감정별 날 수를 많은 순으로 막대로 그린다.
function EmotionBars({
  counts,
}: {
  counts: { emotion: ServerEmotion; count: number }[];
}) {
  const sorted = [...counts].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map(item => item.count));
  return (
    <View
      style={{
        gap: 12,
        padding: 16,
        borderRadius: 22,
        backgroundColor: colors.paper,
        borderWidth: 1,
        borderColor: colors.paperEdge,
      }}
    >
      {sorted.map(({ emotion, count }) => {
        const appEmotion = toAppEmotion(emotion);
        return (
          <View
            key={emotion}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <EmotionImage emotion={appEmotion} size={28} />
            <AppText style={{ width: 44 }}>
              {emotions[appEmotion].label}
            </AppText>
            <View
              style={{
                flex: 1,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.line,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${(count / max) * 100}%`,
                  height: '100%',
                  borderRadius: 6,
                  backgroundColor: emotions[appEmotion].color,
                }}
              />
            </View>
            <AppText variant="label" style={{ width: 44, textAlign: 'right' }}>
              {count}일
            </AppText>
          </View>
        );
      })}
    </View>
  );
}
