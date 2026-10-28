import type { DiaryTag, GenerationFailure } from '@/types/diary';

// 그림 생성이 실패했을 때 게이트웨이가 던지는 오류. 서버 failureCode·retryable·remainingRetries에 대응한다.
// retryable이 false면(유해 판정 등) 같은 태그로 다시 그려도 소용없으므로 앱은 다시 작성하기를 보여 준다.
export class DiaryGenerationError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly remainingRetries: number;
  readonly blockedTags: DiaryTag[];
  constructor(failure: GenerationFailure) {
    super(failure.message);
    this.code = failure.code;
    this.retryable = failure.retryable;
    this.remainingRetries = failure.remainingRetries;
    this.blockedTags = failure.blockedTags;
  }
}

export function toGenerationFailure(error: unknown): GenerationFailure {
  if (error instanceof DiaryGenerationError)
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      remainingRetries: error.remainingRetries,
      blockedTags: error.blockedTags,
    };
  return {
    code: 'UNKNOWN',
    message: '그림을 완성하지 못했어요.',
    retryable: true,
    remainingRetries: 1,
    blockedTags: [],
  };
}

export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;
