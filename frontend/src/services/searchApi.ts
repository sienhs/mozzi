import { parseSearch, parseSuggestions } from '@/types/server';
import { api } from './api';

// 감정 검색 API (backend docs/api/emotion-search.md). 질문 하나에 답 하나이고, 이전 질문은 서버가 쓰지 않는다.
export const SEARCH_QUESTION_MAX = 200;
export const searchKeys = {
  suggestions: (memberId: number) =>
    ['search', memberId, 'suggestions'] as const,
};
export const searchApi = {
  async suggestions() {
    const { data } = await api.get('/emotion-search/suggestions');
    return parseSuggestions(data);
  },
  // 서버가 질문을 해석해 기록을 찾고 답을 만든다(최대 10초). 429·503은 화면이 다시 물어보게 한다.
  async ask(question: string) {
    const { data } = await api.post(
      '/emotion-search',
      { question },
      { timeout: 15_000 },
    );
    return parseSearch(data);
  },
};
