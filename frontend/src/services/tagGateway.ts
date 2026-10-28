import type { CustomTag } from '@/types/diary';
import { mockTagService } from '@/mocks/services';

// 내 태그 저장 경계. CONTRACT: B3 — GET / POST / DELETE /members/me/tags.
// 서버는 정규화한 라벨이 같으면 새로 만들지 않고 기존 태그를 돌려준다.
export interface TagGateway {
  list(): Promise<CustomTag[]>;
  create(label: string): Promise<CustomTag>;
  remove(id: string): Promise<void>;
  // Mock 전용. 실제 서버는 회원별로 보관하므로 구현하지 않는다.
  reset?(): void;
}

export const tagGateway: TagGateway = mockTagService;
