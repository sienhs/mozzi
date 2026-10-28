import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Keyboard, Pressable, View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { DiaryCard, DiaryRow } from '@/components/ui/DiaryCard';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { colors } from '@/theme/tokens';
import { mockSearchService } from '@/mocks/services';
import { useAppStore } from '@/stores/useAppStore';

const suggestions = [
  '마음이 편했던 날을 보여 줘',
  '가족과 보낸 날은 언제였어?',
  '이번 달엔 어떤 기분이 많았어?',
];
export function SearchScreen() {
  const { question: initialQuestion } = useLocalSearchParams<{
    question?: string;
  }>();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const pending = useRef(false);
  const search = useMutation({
    mutationFn: (query: string) =>
      mockSearchService.search(query, useAppStore.getState().entries),
    retry: false,
  });
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
  const openEntry = (id: string) =>
    router.push({ pathname: '/diary/[id]', params: { id } });
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
              maxLength={150}
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
            title={'지난 마음을 물어보세요'}
            description="남긴 기록에서 모찌가 찾아 드려요."
          />
          <View style={{ gap: 8 }}>
            <AppText variant="small">이렇게 물어볼 수 있어요</AppText>
            {suggestions.map(text => (
              <Pressable
                key={text}
                accessibilityRole="button"
                onPress={() => void ask(text)}
                style={{
                  backgroundColor: colors.white,
                  borderRadius: 16,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  minHeight: 52,
                }}
              >
                <AppText>{text}</AppText>
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
              description="연결이 잠시 불안정해요. 한 번 더 물어봐 주세요."
              retry={() => void ask(question)}
            />
          ) : search.data && !search.data.entries.length ? (
            <StatePanel
              title="찾는 기록이 아직 없어요"
              description={
                '다른 말로 물어보거나\n기간을 넓혀서 다시 물어보세요.'
              }
            />
          ) : (
            search.data && (
              <>
                <AppText>{search.data.answer}</AppText>
                <DiaryCard
                  entry={search.data.entries[0]}
                  onPress={() => openEntry(search.data.entries[0].id)}
                />
                {search.data.entries.slice(1).map(entry => (
                  <DiaryRow
                    key={entry.id}
                    entry={entry}
                    onPress={() => openEntry(entry.id)}
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
