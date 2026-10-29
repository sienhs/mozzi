import type { CustomTagCategory, TagCategory } from '@/types/diary';
import {
  iconCategories,
  parseMyIcon,
  parseMyIconList,
  type IconCategory,
  type MyIcon,
} from '@/types/server';
import { api } from './api';

// 내 태그 = 서버 내 아이콘 (GET·POST·DELETE /my-icons). 카테고리마다 9개, 이름 10자까지.
// 서버에는 기본 태그가 없어서 기본 태그도 같은 이름의 내 아이콘으로 만들어 쓴다 (useTagStore.ensureIcon).
export const iconCategoryOf: Record<CustomTagCategory, IconCategory> = {
  activity: 'WHAT',
  place: 'WHERE',
  companion: 'WHO',
};
export const tagCategoryOf: Record<IconCategory, CustomTagCategory> = {
  WHAT: 'activity',
  WHERE: 'place',
  WHO: 'companion',
};
export const isIconCategory = (
  category: TagCategory,
): category is CustomTagCategory => category !== 'weather';
export const MY_ICON_LIMIT = 9;

export interface TagGateway {
  list(): Promise<MyIcon[]>;
  create(label: string, category: CustomTagCategory): Promise<MyIcon>;
  remove(myIconId: number): Promise<void>;
}

export const tagGateway: TagGateway = {
  async list() {
    const lists = await Promise.all(
      iconCategories.map(async category => {
        const { data } = await api.get('/my-icons', { params: { category } });
        const icons = parseMyIconList(data);
        if (icons.some(icon => icon.category !== category))
          throw new Error('내 태그를 확인하지 못했어요.');
        return icons;
      }),
    );
    return lists.flat();
  },
  async create(label, category) {
    const { data } = await api.post('/my-icons', {
      name: label,
      category: iconCategoryOf[category],
    });
    return parseMyIcon(data);
  },
  async remove(myIconId) {
    await api.delete(`/my-icons/${myIconId}`);
  },
};
