import { useState } from 'react';
import { Redirect, router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ActivityChip, Checkbox } from '@/components/ui/Selection';
import { EmotionImage, EmotionPicker } from '@/components/emotion/Emotion';
import { emotionOrder } from '@/constants/emotions';
import { todayKey } from '@/constants/date';
import { useAppStore } from '@/stores/useAppStore';
import { useMockControls } from '@/mocks/controls';
import { initialGachaState, useGachaStore } from '@/stores/useGachaStore';
import { createMockEntries } from '@/mocks/diaries';
import type { DiaryEntry, Emotion } from '@/types/diary';

// Development-only catalogue. It is protected in the root Stack and has no production entry point.
export function PreviewScreen() {
  const [emotion, setEmotion] = useState<Emotion | null>('calm');
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState('');
  if (!__DEV__) return <Redirect href="/" />;
  function prepare() {
    useMockControls.getState().reset();
    useAppStore.getState().login('하루');
  }
  function open(href: Href) {
    prepare();
    router.push(href);
  }
  function setToday(generation: DiaryEntry['generation']) {
    prepare();
    const sample = createMockEntries().find(
      entry => entry.date === '2026-10-22',
    )!;
    const today = todayKey();
    const entry = { ...sample, id: `diary-${today}`, date: today, generation };
    useAppStore.setState(state => ({
      entries: [entry, ...state.entries.filter(item => item.date !== today)],
    }));
    return entry;
  }
  function draft(fail?: 'save' | 'generation') {
    prepare();
    useAppStore.setState({
      draft: {
        emotion: 'calm',
        activities: ['휴식', '가족'],
        memo: '퇴근하고 오므라이스를 만들어 먹었어',
      },
      saveStatus: 'idle',
      saveError: '',
    });
    if (fail) useMockControls.getState().failNext(fail);
    router.push('/record/memo');
  }
  function generating(home = false) {
    const entry = setToday('generating');
    void useAppStore.getState().generateImage(entry.id);
    router.push(
      home
        ? '/home'
        : { pathname: '/record/generation', params: { id: entry.id } },
    );
  }
  function generationPreview(status: 'ready' | 'failed') {
    const entry = setToday(status);
    router.push({ pathname: '/record/generation', params: { id: entry.id } });
  }
  return (
    <Screen title="00–04 화면 미리보기" back>
      <Heading
        title="개발용 시나리오"
        description="각 버튼은 Mock 상태를 설정합니다. 앱을 완전히 다시 열면 초기화됩니다."
      />
      <AppText variant="heading">00 · 디자인 시스템</AppText>
      <Button label="계속하기" onPress={() => setChecked(!checked)} />
      <Button
        label="계속하기"
        variant="secondary"
        onPress={() => setChecked(!checked)}
      />
      <Button label="계속하기" disabled onPress={() => undefined} />
      <Button
        label="Google로 시작하기"
        variant="google"
        onPress={() => setChecked(!checked)}
      />
      <Button label="저장하고 있어요" loading onPress={() => undefined} />
      <Input
        label="입력창"
        value={text}
        onChangeText={setText}
        placeholder="내용을 입력해 주세요"
      />
      <Input label="오류 상태" value="" error="내용을 확인해 주세요" />
      <Checkbox checked={checked} onChange={setChecked} label="체크박스" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ActivityChip
          label="운동"
          selected={checked}
          onPress={() => setChecked(!checked)}
        />
      </View>
      <EmotionPicker value={emotion} onChange={setEmotion} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {emotionOrder.map(id => (
          <EmotionImage key={id} emotion={id} size={28} />
        ))}
      </View>
      <AppText variant="heading">01 · 시작과 인증</AppText>
      <Button
        label="A-01 시작"
        variant="secondary"
        onPress={() => {
          useAppStore.getState().logout();
          router.replace('/');
        }}
      />
      <Button
        label="A-02 Google 첫 로그인"
        variant="secondary"
        onPress={() => {
          useAppStore.getState().logout();
          router.push('/onboarding');
        }}
      />
      <AppText variant="heading">02 · 오늘의 기록</AppText>
      <Button
        label="H-01 홈 · 기록 전"
        variant="secondary"
        onPress={() => {
          prepare();
          useAppStore.setState(state => ({
            entries: state.entries.filter(entry => entry.date !== todayKey()),
          }));
          useAppStore.getState().resetDraft();
          router.push('/home');
        }}
      />
      <Button
        label="R-01 기분 선택"
        variant="secondary"
        onPress={() => {
          prepare();
          useAppStore.getState().resetDraft();
          router.push('/record/emotion');
        }}
      />
      <Button
        label="R-02 활동·메모 / R-03 저장 중"
        variant="secondary"
        onPress={() => draft()}
      />
      <Button
        label="G-01 그림 생성 중"
        variant="secondary"
        onPress={() => generating()}
      />
      <Button
        label="G-02 그림 생성 완료"
        variant="secondary"
        onPress={() => generationPreview('ready')}
      />
      <Button
        label="H-03 홈 · 그림 생성 중"
        variant="secondary"
        onPress={() => generating(true)}
      />
      <Button
        label="H-02 홈 · 기록 후"
        variant="secondary"
        onPress={() => {
          setToday('ready');
          router.push('/home');
        }}
      />
      <AppText variant="heading">03 · 돌아보기와 검색</AppText>
      <Button
        label="C-01 캘린더 / C-02 빈 날짜 (18일)"
        variant="secondary"
        onPress={() => open('/calendar')}
      />
      <Button
        label="D-01 기록 상세"
        variant="secondary"
        onPress={() =>
          open({ pathname: '/diary/[id]', params: { id: 'diary-2026-10-22' } })
        }
      />
      <Button
        label="S-01 감정 검색 · 시작"
        variant="secondary"
        onPress={() => open('/search')}
      />
      <Button
        label="S-02 감정 검색 · 답변"
        variant="secondary"
        onPress={() =>
          open({
            pathname: '/search',
            params: { question: '마음이 편했던 날을 보여 줘' },
          })
        }
      />
      <Button
        label="SET-01 설정 / SET-02 로그아웃 확인"
        variant="secondary"
        onPress={() => open('/settings')}
      />
      <AppText variant="heading">04 · 오류와 빈 상태</AppText>
      <Button
        label="E-01 홈 · 그림 생성 실패"
        variant="secondary"
        onPress={() => {
          setToday('failed');
          router.push('/home');
        }}
      />
      <Button
        label="E-02 저장 실패 (저장 버튼으로 실행)"
        variant="secondary"
        onPress={() => draft('save')}
      />
      <Button
        label="E-03 그림 생성 실패"
        variant="secondary"
        onPress={() => generationPreview('failed')}
      />
      <Button
        label="E-03 생성 실패 경로 (저장부터 실행)"
        variant="secondary"
        onPress={() => draft('generation')}
      />
      <Button
        label="E-04 검색 · 빈 결과"
        variant="secondary"
        onPress={() =>
          open({
            pathname: '/search',
            params: { question: '눈 오는 날 기록 보여 줘' },
          })
        }
      />
      <Button
        label="E-05 검색 · 실패"
        variant="secondary"
        onPress={() => {
          prepare();
          useMockControls.getState().failNext('search');
          router.push({
            pathname: '/search',
            params: { question: '마음이 편했던 날을 보여 줘' },
          });
        }}
      />
      <Button
        label="E-06 Google 로그인 실패 (로그인 버튼으로 실행)"
        variant="secondary"
        onPress={() => {
          useAppStore.getState().logout();
          useMockControls.getState().failNext('login');
          router.replace('/');
        }}
      />
      <AppText variant="heading">05 · 모찌 뽑기</AppText>
      {(
        [
          ['P-01 뽑기 홈 · 23장', 23],
          ['P-01B 뽑기 홈 · 3장', 3],
          ['P-01C 뽑기 홈 · 0장', 0],
        ] as const
      ).map(([label, tickets]) => (
        <Button
          key={label}
          label={label}
          variant="secondary"
          onPress={() => {
            useGachaStore.setState({ ...initialGachaState(), tickets });
            open('/gacha');
          }}
        />
      ))}
      <Button
        label="P-06 모찌 도감"
        variant="secondary"
        onPress={() => {
          useGachaStore.setState(initialGachaState());
          open('/gacha/collection');
        }}
      />
      <Button
        label="P-11 요청 실패 (1장 뽑기로 실행)"
        variant="secondary"
        onPress={() => {
          useGachaStore.setState(initialGachaState());
          open('/gacha');
          useMockControls.getState().failNext('gacha');
        }}
      />
    </Screen>
  );
}
