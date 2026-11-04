import { useEffect, useRef } from 'react';
import { useIsFocused } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { diaryApi, diaryKeys } from '@/services/diaryApi';
import { queryClient } from '@/services/queryClient';
import { useAppStore } from '@/stores/useAppStore';
import { useAuthStore } from '@/stores/useAuthStore';
import type { DiaryEntry } from '@/types/diary';
import type { HomeResponse } from '@/types/server';
import { todayKey } from '@/constants/date';
import { toDiaryEntry, toSummaryEntry } from './serverDiary';

// 그림 상태는 SSE가 없어 조회로 확인한다. 생성 중일 때만, 화면이 보이고 앱이 활성일 때만 묻는다.
// 서버에는 생성 타임아웃이 없어 오래 걸리면 간격을 늘린다.
export function pollDelay(pendingMs: number) {
  if (pendingMs < 60_000) return 4_000;
  if (pendingMs < 5 * 60_000) return 10_000;
  return 30_000;
}
// 서울 기준 다음 날 0시까지 남은 시간.
export function msUntilNextSeoulDay(now = new Date()) {
  const seoul = new Date(now.getTime() + 9 * 3_600_000);
  const next = Date.UTC(
    seoul.getUTCFullYear(),
    seoul.getUTCMonth(),
    seoul.getUTCDate() + 1,
  );
  return next - seoul.getTime();
}

export interface HomeView {
  data: HomeResponse | undefined;
  today: DiaryEntry | null;
  recent: DiaryEntry | null;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => void;
}
// GET /home. 홈·생성 화면이 함께 쓴다. 화면을 떠나면 구독을 끊어 갱신·폴링을 멈춘다.
export function useHome(): HomeView {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  const pendingSince = useRef<number | null>(null);
  const query = useQuery({
    queryKey: diaryKeys.home(memberId ?? 0),
    queryFn: diaryApi.home,
    enabled: memberId !== undefined,
    subscribed: focused,
    // 홈 복귀(재구독)·앱 활성화 때마다 서버 상태를 다시 확인한다.
    staleTime: 0,
    refetchInterval: current => {
      if (current.state.data?.todayStatus !== 'IMAGE_PENDING') {
        pendingSince.current = null;
        return false;
      }
      pendingSince.current ??= Date.now();
      return pollDelay(Date.now() - pendingSince.current);
    },
  });
  const data = query.data;
  // 날짜가 바뀌면 오늘의 상태가 달라진다. 서버 날짜 기준으로 자정에 다시 읽는다.
  const serverToday = data?.today;
  useEffect(() => {
    if (!focused || memberId === undefined || !serverToday) return;
    const timer = setTimeout(
      () =>
        void queryClient.invalidateQueries({
          queryKey: diaryKeys.home(memberId),
        }),
      msUntilNextSeoulDay() + 1_000,
    );
    return () => clearTimeout(timer);
  }, [focused, memberId, serverToday]);
  const todayId = data?.todayDiary?.diaryId;
  useEffect(() => {
    if (memberId !== undefined && todayId)
      void useAppStore.getState().loadRequest(memberId, todayId);
  }, [memberId, todayId]);
  const snapshot = useAppStore(state =>
    todayId ? state.requests[todayId] : undefined,
  );
  const today =
    data?.todayDiary &&
    toDiaryEntry(data.todayDiary, {
      today: data.today,
      canRequestImage: data.canRequestImage,
      snapshot,
    });
  const recent =
    data?.recentDiary && toDiaryEntry(data.recentDiary, { today: data.today });
  return {
    data,
    today: today ?? null,
    recent: recent ?? null,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}

// 한 달 캘린더 (GET /diaries/monthly). 일기를 쓴 날과 감정만 온다. 일기를 쓰면 diaryKeys.all로 함께 갱신된다.
export function useMonthly(yearMonth: string) {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  return useQuery({
    queryKey: diaryKeys.monthly(memberId ?? 0, yearMonth),
    queryFn: () => diaryApi.monthly(yearMonth),
    enabled: memberId !== undefined,
    subscribed: focused,
    staleTime: 0,
  });
}

// 하루 일기. 오늘 기록은 홈과 같은 데이터(GET /home)를 써서 두 화면이 어긋나지 않게 한다.
export function useDiary(date: string | undefined) {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  const home = queryClient.getQueryData<HomeResponse>(
    diaryKeys.home(memberId ?? 0),
  );
  const query = useQuery({
    queryKey: diaryKeys.daily(memberId ?? 0, date ?? ''),
    queryFn: () => diaryApi.daily(date!),
    enabled: memberId !== undefined && !!date,
    subscribed: focused,
    staleTime: 0,
    placeholderData: () => {
      if (!home || !date) return undefined;
      if (home.todayDiary?.recordDate === date) return home.todayDiary;
      if (home.recentDiary?.recordDate === date) return home.recentDiary;
      return undefined;
    },
    refetchInterval: current =>
      current.state.data?.image?.status === 'PENDING' ? 10_000 : false,
  });
  const snapshot = useAppStore(state =>
    query.data ? state.requests[query.data.diaryId] : undefined,
  );
  const isToday = !!home && home.today === date;
  const entry = query.data
    ? toDiaryEntry(query.data, {
        // 홈을 아직 받지 않았으면 기기 날짜(서울)로 오늘을 판단한다.
        today: home?.today ?? todayKey(),
        canRequestImage: isToday ? home!.canRequestImage : undefined,
        snapshot,
      })
    : null;
  return {
    entry,
    // 서버 응답 그대로 (아이콘 ID가 필요한 화면용).
    detail: query.data ?? null,
    notFound: query.isSuccess && query.data === null,
    isPending: query.isPending,
    isError: query.isError,
    refetch: () => void query.refetch(),
  };
}

// 홈에서 옆으로 넘겨 보는 지난 기록 (GET /diaries, 최신순 커서). 오늘 기록은 홈 첫 장이 맡으므로 뺀다.
// 끝까지 넘기면 다음 페이지를 이어 받는다. 일기를 쓰면 diaryKeys.all로 함께 갱신된다.
export function usePastDiaries(today: string | undefined) {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  const query = useInfiniteQuery({
    queryKey: diaryKeys.list(memberId ?? 0),
    queryFn: ({ pageParam }) => diaryApi.page(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    enabled: memberId !== undefined && !!today,
    subscribed: focused,
    staleTime: 60_000,
  });
  const entries: DiaryEntry[] = (query.data?.pages ?? [])
    .flatMap(page => page.items)
    .filter(item => item.recordDate !== today)
    .map(item => toSummaryEntry(item, today ?? todayKey()));
  return {
    entries,
    hasMore: !!query.hasNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage)
        void query.fetchNextPage();
    },
    isFetchingMore: query.isFetchingNextPage,
  };
}
