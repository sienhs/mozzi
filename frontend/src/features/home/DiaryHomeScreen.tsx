import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DiaryArtwork, DiaryCard, DiaryRow } from '@/components/ui/DiaryCard';
import { GenerationProgress, PictureState } from '@/components/ui/Feedback';
import { formatDate, todayKey } from '@/constants/date';
import {
  canRetry,
  canRewrite,
  entryPhase,
  useAppStore,
} from '@/stores/useAppStore';
import { retryEntry, rewriteEntry } from '@/features/diary/recordActions';
import { colors } from '@/theme/tokens';

export function DiaryHomeScreen() {
  const entries = useAppStore(state => state.entries);
  const today = todayKey();
  const entry = entries.find(item => item.date === today);
  const recent = entries
    .filter(item => item.date < today && item.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const phase = entry ? entryPhase(entry, false) : null;
  const openEntry = (id: string) =>
    router.push({ pathname: '/diary/[id]', params: { id } });
  const openGeneration = (id: string) =>
    router.push({ pathname: '/record/generation', params: { id } });
  const copy = !entry
    ? { title: '오늘은 어떤 하루였나요?' }
    : phase === 'generating'
      ? { title: '오늘의 모찌를 그리고 있어요' }
      : phase === 'failed'
        ? canRewrite(entry)
          ? {
              title: '이 내용으로는 그림을 그릴 수 없어요',
              description: '기분과 태그를 고쳐서 다시 써 주세요.',
            }
          : canRetry(entry)
            ? {
                title: '이번 그림은 완성하지 못했어요',
                description: '고른 태그로 다시 그려요.',
              }
            : { title: '오늘은 그림을 더 그릴 수 없어요' }
        : phase === 'reviewing'
          ? { title: '그림이 완성됐어요' }
          : { title: '오늘도 한 장 남겼어요' };
  return (
    <Screen
      tabbed
      title="오늘의 모찌"
      titleContent={
        <Image
          source={require('../../../assets/Mozzi_Logo2.png')}
          accessibilityLabel="오늘의 모찌"
          resizeMode="contain"
          style={{
            width: 160,
            height: 100,
            transform: [{ translateX: -6 }, { translateY: -14 }],
          }}
        />
      }
      onTitleLongPress={__DEV__ ? () => router.push('/dev') : undefined}
      footer={
        !entry ? (
          <Button
            label="오늘 기록하기"
            onPress={() => router.push('/record/emotion')}
          />
        ) : phase === 'failed' && canRewrite(entry) ? (
          <Button
            label="다시 작성하기"
            onPress={() => rewriteEntry(entry, 'list')}
          />
        ) : phase === 'failed' && canRetry(entry) ? (
          <Button
            label="다시 그리기"
            onPress={() => {
              retryEntry(entry);
              openGeneration(entry.id);
            }}
          />
        ) : phase === 'reviewing' ? (
          <Button
            label="한 줄 남기고 저장하기"
            onPress={() => openGeneration(entry.id)}
          />
        ) : undefined
      }
    >
      <View style={{ gap: 8 }}>
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.sageSoft,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 4,
          }}
        >
          <AppText variant="small" style={{ color: colors.mossInk }}>
            {formatDate(today)}
          </AppText>
        </View>
        <Heading
          titleStyle={{ fontSize: 32, lineHeight: 42 }}
          title={copy.title}
          description={copy.description}
        />
      </View>
      {!entry && (
        <View
          style={{
            backgroundColor: colors.paper,
            borderRadius: 26,
            borderWidth: 1,
            borderColor: colors.paperEdge,
            padding: 8,
            boxShadow: '0 6px 20px rgba(91, 65, 39, 0.07)',
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              margin: 12,
              borderBottomWidth: 2,
              borderBottomColor: colors.soft,
            }}
          >
            <AppText variant="caption" style={{ color: colors.primary }}>
              오늘의 한 페이지
            </AppText>
          </View>
          <PictureState
            caption="태그 몇 개면 그림이 돼요"
            captionStyle={{ fontSize: 18, lineHeight: 28, textAlign: 'center' }}
          />
        </View>
      )}
      {entry && phase === 'completed' && (
        <DiaryCard entry={entry} onPress={() => openEntry(entry.id)} />
      )}
      {entry && phase === 'reviewing' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="완성된 그림 보기"
          onPress={() => openGeneration(entry.id)}
        >
          <DiaryArtwork />
        </Pressable>
      )}
      {entry && phase === 'generating' && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="그림 생성 화면 보기"
            onPress={() => openGeneration(entry.id)}
          >
            <PictureState
              emotion={entry.emotion}
              companionId={entry.companionId}
              generating
              tone="sage"
            />
          </Pressable>
          <GenerationProgress home />
        </>
      )}
      {entry && phase === 'failed' && (
        <PictureState emotion={entry.emotion} companionId={entry.companionId} />
      )}
      {!entry && recent && (
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppText variant="heading">지난 기록</AppText>
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.paperEdge }}
            />
          </View>
          <DiaryRow entry={recent} onPress={() => openEntry(recent.id)} />
        </View>
      )}
    </Screen>
  );
}
