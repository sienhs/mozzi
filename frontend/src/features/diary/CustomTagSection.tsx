import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Button, TextButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TagChip } from '@/components/ui/Selection';
import { ConfirmModal } from '@/components/ui/Sheet';
import { AppText } from '@/components/ui/Text';
import { customTagLimits } from '@/constants/tags';
import { colors } from '@/theme/tokens';
import type { CustomTag, TagSelection } from '@/types/diary';
import { useAppStore } from '@/stores/useAppStore';
import { useTagStore } from '@/stores/useTagStore';
import {
  canSelectTag,
  isTagSelected,
  labelLength,
  normalizeTagLabel,
} from './tagRules';
import { TagSection } from './TagSection';

// 내 태그: 계정별로 저장돼 다음 기록에서도 다시 고를 수 있다.
// 선택 해제는 이번 기록에서만 빼고, 삭제(편집 → ✕)는 목록에서 지운다. 지난 기록의 라벨은 그대로 남는다.
export function CustomTagSection({
  selection,
  disabled,
}: {
  selection: TagSelection;
  disabled?: boolean;
}) {
  const tags = useTagStore(state => state.tags);
  const adding = useTagStore(state => state.adding);
  const removing = useTagStore(state => state.removing);
  const error = useTagStore(state => state.error);
  const loadStatus = useTagStore(state => state.loadStatus);
  const [editing, setEditing] = useState(false);
  const [inputOpen, setInputOpen] = useState(false);
  const [text, setText] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingDelete, setPendingDelete] = useState<CustomTag | null>(null);
  const full = selection.custom.length >= customTagLimits.maxSelected;
  const typed = normalizeTagLabel(text);
  async function add() {
    if (!typed || adding) return;
    const result = await useTagStore.getState().add(text);
    if (result.kind === 'none') return;
    if (result.kind === 'preset') {
      const current = useAppStore.getState().draft.tags;
      const already = isTagSelected(current, result.tag);
      if (!already && canSelectTag(current, result.tag))
        useAppStore.getState().toggleTag(result.tag);
      setNotice(
        already || canSelectTag(current, result.tag)
          ? `‘${result.tag.label}’ 기본 태그를 골랐어요.`
          : `‘${result.tag.label}’ 기본 태그가 있어요. 위에서 골라 주세요.`,
      );
    } else {
      useAppStore.getState().selectCustomTag(result.id);
      setNotice('');
    }
    setText('');
    setInputOpen(false);
  }
  async function confirmDelete() {
    const tag = pendingDelete;
    setPendingDelete(null);
    if (!tag) return;
    if (await useTagStore.getState().remove(tag.id))
      useAppStore.getState().forgetCustomTag(tag.id);
  }
  return (
    <TagSection
      title={customTagLimits.title}
      limit={customTagLimits.limit}
      notice={
        inputOpen
          ? notice
          : loadStatus === 'error'
            ? '내 태그를 불러오지 못했어요.'
            : error || notice
      }
      action={
        loadStatus === 'error' ? (
          <TextButton
            label="다시 불러오기"
            onPress={() => void useTagStore.getState().load()}
          />
        ) : tags.length > 0 && !disabled ? (
          <TextButton
            label={editing ? '완료' : '편집'}
            onPress={() => {
              setEditing(!editing);
              setInputOpen(false);
              setNotice('');
            }}
          />
        ) : undefined
      }
    >
      {tags.map(tag => {
        const selected = selection.custom.includes(tag.id);
        return (
          <TagChip
            key={tag.id}
            label={tag.label}
            selected={!editing && selected}
            removable={editing}
            disabled={
              disabled || (editing ? removing === tag.id : !selected && full)
            }
            onPress={() =>
              editing
                ? setPendingDelete(tag)
                : useAppStore.getState().toggleCustomTag(tag.id)
            }
          />
        );
      })}
      {!editing && !inputOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="내 태그 추가"
          accessibilityState={{ disabled: !!disabled || full }}
          disabled={disabled || full}
          onPress={() => {
            setInputOpen(true);
            setNotice('');
            useTagStore.getState().clearError();
          }}
          style={{
            minHeight: 44,
            paddingHorizontal: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: disabled || full ? 0.4 : 1,
          }}
        >
          <Plus size={14} color={colors.ink} />
          <AppText variant="small" style={{ color: colors.ink }}>
            추가
          </AppText>
        </Pressable>
      )}
      {inputOpen && (
        <View
          style={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <View style={{ flex: 1 }}>
            <Input
              accessibilityLabel="내 태그 입력"
              value={text}
              onChangeText={value => {
                setText(value);
                if (error) useTagStore.getState().clearError();
              }}
              placeholder="예: 오므라이스"
              returnKeyType="done"
              autoFocus
              editable={!adding}
              onSubmitEditing={() => void add()}
              error={error}
              helper={`${labelLength(typed)} / ${customTagLimits.maxLength}`}
            />
          </View>
          <Button
            label="추가"
            disabled={!typed}
            loading={adding}
            onPress={() => void add()}
            style={{ minWidth: 72, minHeight: 56 }}
          />
        </View>
      )}
      {inputOpen && (
        <TextButton
          label="취소"
          onPress={() => {
            setInputOpen(false);
            setText('');
            useTagStore.getState().clearError();
          }}
        />
      )}
      <ConfirmModal
        visible={!!pendingDelete}
        title={`‘${pendingDelete?.label ?? ''}’ 태그를 지울까요?`}
        description="지난 기록에 남은 태그는 그대로 있어요."
        confirmLabel="지우기"
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </TagSection>
  );
}
