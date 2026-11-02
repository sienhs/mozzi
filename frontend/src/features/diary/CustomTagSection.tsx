import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Button, TextButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TagChip } from '@/components/ui/Selection';
import { ConfirmModal, Sheet } from '@/components/ui/Sheet';
import { AppText } from '@/components/ui/Text';
import { customTagLimits, tagCategories } from '@/constants/tags';
import { colors } from '@/theme/tokens';
import type { CustomTag, CustomTagCategory, TagSelection } from '@/types/diary';
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import {
  canSelectTag,
  isTagSelected,
  labelLength,
  normalizeTagLabel,
} from './tagRules';

const categoryNames = {
  activity: '무엇을',
  place: '어디서',
  companion: '누구와',
} as const;
// 별도 내 태그 목록 없이 각 카테고리 안에서 추가·선택·삭제한다. 가입 때 받은 기본 태그도 여기 있다.
export function CustomTagSection({
  category,
  selection,
}: {
  category: CustomTagCategory;
  selection: TagSelection;
}) {
  const library = useTagStore(state => state.tags);
  const adding = useTagStore(state => state.adding);
  const removing = useTagStore(state => state.removing);
  const error = useTagStore(state => state.error);
  const loadStatus = useTagStore(state => state.loadStatus);
  const [editing, setEditing] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CustomTag | null>(null);
  const name = categoryNames[category];
  const tags = library.filter(tag => tag.category === category);
  const typed = normalizeTagLabel(text);
  function close() {
    if (adding) return;
    setInputOpen(false);
    setText('');
    useTagStore.getState().clearError();
  }
  async function add() {
    if (!typed || adding) return;
    const result = await useTagStore.getState().add(text, category);
    if (result.kind === 'none') return;
    const tag = useTagStore.getState().tags.find(tag => tag.id === result.id);
    if (!tag) return;
    const current = useAppStore.getState().draft.tags;
    const canSelect = canSelectTag(current, tag);
    if (!isTagSelected(current, tag) && canSelect)
      useAppStore.getState().toggleTag(tag);
    setNotice(
      canSelect
        ? `‘${tag.label}’ 태그를 골랐어요.`
        : `‘${tag.label}’ 태그를 추가했어요. ${tagCategories[category].max}개까지 선택할 수 있어요.`,
    );
    setText('');
    setInputOpen(false);
  }
  async function confirmDelete() {
    const tag = pendingDelete;
    setPendingDelete(null);
    if (!tag) return;
    if (await useTagStore.getState().remove(tag.id))
      useAppStore.getState().forgetCustomTag(tag.id);
    else setNotice(useTagStore.getState().error);
  }
  return (
    <View style={{ width: '100%', gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {tags.map(tag => (
          <TagChip
            key={tag.id}
            label={tag.label}
            single={tagCategories[category].single}
            selected={!editing && isTagSelected(selection, tag)}
            removable={editing}
            disabled={
              editing ? removing === tag.id : !canSelectTag(selection, tag)
            }
            onPress={() =>
              editing
                ? setPendingDelete(tag)
                : useAppStore.getState().toggleTag(tag)
            }
          />
        ))}
        {loadStatus === 'error' ? (
          <TextButton
            label="다시 불러오기"
            onPress={() => void useTagStore.getState().load()}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name} 태그 추가`}
            disabled={adding || loadStatus === 'loading'}
            onPress={() => {
              setEditing(false);
              setInputOpen(true);
              setNotice('');
              useTagStore.getState().clearError();
            }}
            style={{
              minHeight: 44,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={14} color={colors.ink} />
            <AppText variant="small" style={{ color: colors.ink }}>
              추가
            </AppText>
          </Pressable>
        )}
        {tags.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name} 태그 ${editing ? '편집 완료' : '편집'}`}
            onPress={() => {
              setEditing(!editing);
              setNotice('');
            }}
            style={{
              minHeight: 44,
              justifyContent: 'center',
              paddingHorizontal: 8,
            }}
          >
            <AppText variant="caption">{editing ? '완료' : '편집'}</AppText>
          </Pressable>
        )}
      </View>
      {!!notice && (
        <AppText variant="caption" accessibilityLiveRegion="polite">
          {notice}
        </AppText>
      )}
      <Sheet visible={inputOpen} onClose={close} title={`${name} 태그 추가`}>
        <Input
          accessibilityLabel={`${name} 태그 입력`}
          label="태그 이름"
          value={text}
          onChangeText={value => {
            setText(value);
            if (error) useTagStore.getState().clearError();
          }}
          placeholder={
            category === 'activity'
              ? '예: 악기 연습'
              : category === 'place'
                ? '예: 연습실'
                : '예: 동아리 친구'
          }
          returnKeyType="done"
          editable={!adding}
          onSubmitEditing={() => void add()}
          error={error}
          helper={`${labelLength(typed)} / ${customTagLimits.maxLength}`}
        />
        <Button
          label="태그 만들기"
          disabled={!typed || labelLength(typed) > customTagLimits.maxLength}
          loading={adding}
          onPress={() => void add()}
        />
        <TextButton label="취소" onPress={close} />
      </Sheet>
      <ConfirmModal
        visible={!!pendingDelete}
        title={`‘${pendingDelete?.label ?? ''}’ 태그를 지울까요?`}
        description="이 태그를 붙였던 지난 기록에서도 더 이상 보이지 않아요. 이미 그린 그림은 그대로예요."
        confirmLabel="지우기"
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </View>
  );
}
