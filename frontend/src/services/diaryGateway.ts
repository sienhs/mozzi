import type { DiaryEntry, DiaryTag, GenerationRequest } from '@/types/diary';
import { mockDiaryService } from '@/mocks/services';
import type { CompanionId } from '@/types/companion';

// 일기 흐름이 서버와 주고받는 유일한 경계. 화면과 스토어는 이 인터페이스만 부른다.
// 지금은 Mock이다. API를 연결할 때는 이 파일에서 구현만 바꾸고 단계 모델·화면은 그대로 둔다.
// CONTRACT: B1(요청 필드) · B4(작성 중/완료) · B5(그림 상태·재시도) · B6(다시 작성) · B7(멱등 재전송)
export interface DiaryGateway {
  // 그림 요청: 작성 중 기록과 첫 그림 시도를 만든다. 같은 requestKey로 다시 보내면 같은 결과여야 한다.
  start(
    request: GenerationRequest,
    tags: DiaryTag[],
    requestKey: string,
    imageTags?: DiaryTag[],
  ): Promise<DiaryEntry>;
  // 재시도 불가 실패였던 기록을 고친 기분·태그로 다시 그린다.
  rewrite(
    id: string,
    request: GenerationRequest,
    tags: DiaryTag[],
    requestKey: string,
    imageTags?: DiaryTag[],
  ): Promise<DiaryEntry>;
  // 그림이 끝날 때까지 기다린다. 실패하면 DiaryGenerationError를 던진다.
  generate(
    context: string | { diaryId: string; companionId: CompanionId },
  ): Promise<void>;
  // 실패한 그림을 같은 태그로 다시 그리게 한다.
  retry(id: string, requestKey: string): Promise<void>;
  // 최종 저장. 한 줄은 비어 있어도 된다.
  complete(
    id: string,
    memo: string,
    requestKey: string,
  ): Promise<{ memo: string }>;
}

export const diaryGateway: DiaryGateway = mockDiaryService;
