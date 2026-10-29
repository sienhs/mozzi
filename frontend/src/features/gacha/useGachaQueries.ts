import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { gachaApi, gachaKeys } from '@/services/gachaApi';
import { mozziApi, mozziKeys, type OwnedQuery } from '@/services/mozziApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGachaStore } from '@/stores/useGachaStore';
import { emptyPicks } from '@/types/companion';

// 뽑기 홈 잔액 (GET /gacha/status). 보상·뽑기로 바뀌므로 화면에 올 때마다 다시 읽는다.
export function useGachaStatus() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  const query = useQuery({
    queryKey: gachaKeys.status(memberId ?? 0),
    queryFn: gachaApi.status,
    enabled: memberId !== undefined,
    subscribed: focused,
    staleTime: 0,
  });
  const { data } = query;
  useEffect(() => {
    if (data) useGachaStore.getState().setWallet(data);
  }, [data]);
  return query;
}
export function useGachaRates(enabled: boolean) {
  const memberId = useAuthStore(state => state.member?.memberId);
  return useQuery({
    queryKey: gachaKeys.rates(memberId ?? 0),
    queryFn: gachaApi.rates,
    enabled: enabled && memberId !== undefined,
    staleTime: 10 * 60_000,
  });
}
// 도감 전체 (GET /gacha/collection). 모찌 상세·교환 목록도 이 응답으로 그린다.
export function useCollection() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const focused = useIsFocused();
  return useQuery({
    queryKey: gachaKeys.collection(memberId ?? 0),
    queryFn: gachaApi.collection,
    enabled: memberId !== undefined,
    subscribed: focused,
    staleTime: 0,
  });
}
// 감정별로 고른 모찌. 고르지 않았거나 아직 받지 못한 감정은 기본 모찌(null)다.
export function useMozziPicks() {
  const memberId = useAuthStore(state => state.member?.memberId);
  const query = useQuery({
    queryKey: mozziKeys.picks(memberId ?? 0),
    queryFn: mozziApi.picks,
    enabled: memberId !== undefined,
    staleTime: 0,
  });
  return { ...query, picks: query.data ?? emptyPicks() };
}
export function useOwnedMozzis(query: OwnedQuery) {
  const memberId = useAuthStore(state => state.member?.memberId);
  return useQuery({
    queryKey: mozziKeys.owned(memberId ?? 0, query),
    queryFn: () => mozziApi.owned(query),
    enabled: memberId !== undefined,
    staleTime: 0,
  });
}
