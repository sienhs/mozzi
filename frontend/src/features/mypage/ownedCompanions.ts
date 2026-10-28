import { companions } from '@/constants/companions';
import type {
  CompanionId,
  CompanionSort,
  MochiCategory,
} from '@/types/companion';
import type { MochiId, Tier } from '@/types/gacha';

export function ownedCompanionIds(owned: MochiId[]): CompanionId[] {
  return ['default', ...new Set(owned)];
}
export function filterOwnedCompanions({
  owned,
  acquiredAt,
  query = '',
  category = null,
  tier = null,
  sort = 'recent',
}: {
  owned: MochiId[];
  acquiredAt: Partial<Record<MochiId, string>>;
  query?: string;
  category?: MochiCategory | null;
  tier?: Tier | null;
  sort?: CompanionSort;
}) {
  return ownedCompanionIds(owned)
    .filter(id => {
      const item = companions[id];
      return (
        item.name.includes(query.trim()) &&
        (!category || item.category === category) &&
        (!tier || item.tier === tier)
      );
    })
    .sort((a, b) => {
      const byName = () =>
        companions[a].name.localeCompare(companions[b].name, 'ko');
      if (sort === 'name') return byName();
      const dateA = a === 'default' ? undefined : acquiredAt[a];
      const dateB = b === 'default' ? undefined : acquiredAt[b];
      if (!dateA || !dateB) return dateA ? -1 : dateB ? 1 : byName();
      return (
        (sort === 'recent'
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB)) || byName()
      );
    });
}
