import { router } from 'expo-router';
import { Image, Pressable, View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DiaryCard, DiaryRow } from '@/components/ui/DiaryCard';
import { GenerationProgress, PictureState } from '@/components/ui/Feedback';
import { formatDate, todayKey } from '@/constants/date';
import { useAppStore } from '@/stores/useAppStore';

export function DiaryHomeScreen() {
  const entries = useAppStore(state => state.entries);
  const today = todayKey();
  const entry = entries.find(item => item.date === today);
  const recent = [...entries]
    .filter(item => item.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const status = entry?.generation;
  const openEntry = (id: string) =>
    router.push({ pathname: '/diary/[id]', params: { id } });
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
      action={{
        icon: 'settings',
        label: '설정',
        onPress: () => router.push('/settings'),
      }}
      onTitleLongPress={__DEV__ ? () => router.push('/dev') : undefined}
      footer={
        !entry ? (
          <Button
            label="오늘 기록하기"
            labelStyle={{ fontSize: 20, lineHeight: 30 }}
            onPress={() => router.push('/record/emotion')}
          />
        ) : status === 'failed' ? (
          <Button
            label="다시 그리기"
            onPress={() => {
              void useAppStore.getState().generateImage(entry.id);
              router.push({
                pathname: '/record/generation',
                params: { id: entry.id },
              });
            }}
          />
        ) : undefined
      }
    >
      <View style={{ gap: 8 }}>
        <AppText variant="small">{formatDate(today)}</AppText>
        <Heading
          titleStyle={!entry ? { fontSize: 28, lineHeight: 40 } : undefined}
          title={
            !entry
              ? '오늘은 어떤 하루였나요?'
              : status === 'generating'
                ? '오늘의 모찌를 그리고 있어요'
                : status === 'failed'
                  ? '이번 그림은 완성하지 못했어요'
                  : '오늘도 한 장 남겼어요'
          }
          description={
            status === 'failed'
              ? '기록은 저장돼 있어요. 그림만 다시 그려요.'
              : undefined
          }
        />
      </View>
      {!entry && (
        <PictureState
          caption="기분 하나만 골라도 그림이 돼요"
          captionStyle={{ fontSize: 18, lineHeight: 28, textAlign: 'center' }}
        />
      )}
      {entry && status === 'ready' && (
        <DiaryCard entry={entry} onPress={() => openEntry(entry.id)} />
      )}
      {entry && status === 'generating' && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="그림 생성 화면 보기"
            onPress={() =>
              router.push({
                pathname: '/record/generation',
                params: { id: entry.id },
              })
            }
          >
            <PictureState emotion={entry.emotion} generating tone="sage" />
          </Pressable>
          <GenerationProgress home />
        </>
      )}
      {entry && status === 'failed' && <PictureState emotion={entry.emotion} />}
      {!entry && recent && (
        <View style={{ gap: 12 }}>
          <AppText variant="heading">지난 기록</AppText>
          <DiaryRow entry={recent} onPress={() => openEntry(recent.id)} />
        </View>
      )}
    </Screen>
  );
}
