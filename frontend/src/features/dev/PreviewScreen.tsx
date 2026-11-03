import { useState } from 'react';
import { Redirect, router, type Href } from 'expo-router';
import { View } from 'react-native';
import { Screen, Heading } from '@/components/ui/Screen';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox, TagChip } from '@/components/ui/Selection';
import { EmotionImage, EmotionPicker } from '@/components/emotion/Emotion';
import { emotionOrder } from '@/constants/emotions';
import { todayKey } from '@/constants/date';
import { setAuthPreview } from '@/mocks/authPreview';
import { useAppStore } from '@/stores/useAppStore';
import { useMockControls } from '@/mocks/controls';
import type { Emotion } from '@/types/diary';

// Development-only catalogue. It is protected in the root Stack and has no production entry point.
export function PreviewScreen() {
  const [emotion, setEmotion] = useState<Emotion | null>('calm');
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState('');
  if (!__DEV__) return <Redirect href="/" />;
  function prepare() {
    useMockControls.getState().reset();
    setAuthPreview();
  }
  function open(href: Href) {
    prepare();
    router.push(href);
  }
  function draft() {
    prepare();
    useAppStore.setState(state => ({
      entries: state.entries.filter(entry => entry.date !== todayKey()),
    }));
    useAppStore.getState().resetDraft();
    useAppStore.setState({
      draft: {
        mainActivityId: null,
        recordDate: todayKey(),
        emotion: 'calm',
        tags: {
          // 무엇을·어디서·누구와는 서버의 내 태그라 미리 고를 수 없다.
          activities: [],
          place: null,
          companions: [],
          weather: 'weather.rainy',
        },
        memo: '',
      },
    });
    router.push('/record/tags');
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <TagChip
          label="운동"
          selected={checked}
          main
          onPress={() => setChecked(!checked)}
        />
        <TagChip label="그림 그리기" selected={false} onPress={() => {}} />
        <TagChip
          label="공원"
          single
          selected={false}
          disabled
          onPress={() => {}}
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
          setAuthPreview('signedOut');
          router.replace('/');
        }}
      />
      <Button
        label="A-02 Google 첫 로그인"
        variant="secondary"
        onPress={() => {
          setAuthPreview('signupRequired');
          router.push('/onboarding');
        }}
      />
      <AppText variant="heading">02 · 오늘의 기록</AppText>
      <AppText variant="small">
        기록 전 홈은 화면만 미리 봅니다. 서버 일기와 생성 상태는 바뀌지 않으며,
        홈 로고를 길게 누르면 실제 홈으로 돌아갑니다.
      </AppText>
      <Button
        label="H-01 홈 · 기록 전"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/home', params: { preview: 'empty' } })
        }
      />
      <Button
        label="H-02 홈 · 완성 카드 미리보기"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/home', params: { preview: 'completed' } })
        }
      />
      <Button
        label="R-01 기분 선택"
        variant="secondary"
        onPress={() => {
          prepare();
          useAppStore.setState(state => ({
            entries: state.entries.filter(entry => entry.date !== todayKey()),
          }));
          useAppStore.getState().resetDraft();
          router.push('/record/emotion');
        }}
      />
      <Button
        label="R-02 태그 선택 / 그림 요청 중"
        variant="secondary"
        onPress={() => draft()}
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
        label="Google 로그인 · 실제 서버 연결"
        variant="secondary"
        onPress={() => {
          setAuthPreview('signedOut');
          router.replace('/');
        }}
      />
      <AppText variant="heading">05 · 모찌 뽑기</AppText>
      {/* 뽑기권·도감은 서버 값이라 여기서 바꾸지 않는다. */}
      <Button
        label="P-01 뽑기 홈"
        variant="secondary"
        onPress={() => open('/gacha')}
      />
      <Button
        label="P-06 모찌 도감"
        variant="secondary"
        onPress={() => open('/gacha/collection')}
      />
    </Screen>
  );
}
