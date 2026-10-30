import { Image, StyleSheet, View } from 'react-native';
import { Sparkles, Star } from 'lucide-react-native';
import { Sheet } from '@/components/ui/Sheet';
import { AppText } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Loading, StatePanel } from '@/components/ui/Feedback';
import { TierBadge } from '@/components/gacha/GachaUI';
import { gachaArt } from '@/constants/gacha';
import { emotions } from '@/constants/emotions';
import { useGachaRates } from './useGachaQueries';

const ink = '#754A52';
const percent = (rate: number) => `${Number((rate * 100).toFixed(3))}%`;
// Existing server policy: backend/docs/api/gacha.md.
const notices = [
  '매번 같은 등급 확률로 뽑아요.',
  '천장·등급 확정은 없어요.',
  '전설·신화는 미보유 모찌가 우선 등장해요.',
];

export function GachaOddsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const rates = useGachaRates(visible);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="등급별 획득 확률"
      appearance="gacha"
      titleContent={<OddsTitle />}
      footer={
        <Button
          label="확인"
          onPress={onClose}
          style={styles.confirm}
          labelStyle={styles.confirmLabel}
        />
      }
    >
      <AppText variant="small" style={styles.ink}>
        1회 뽑기 기준
      </AppText>
      {rates.data ? (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.tierColumn}>
              <AppText variant="caption" style={styles.headerText}>
                등급
              </AppText>
            </View>
            <AppText
              variant="caption"
              style={[styles.rateColumn, styles.headerText]}
            >
              확률
            </AppText>
            <AppText
              variant="caption"
              style={[styles.shardColumn, styles.headerText]}
            >
              중복 시 별조각
            </AppText>
          </View>
          {rates.data.map((item, index) => (
            <View
              key={item.tier}
              style={[styles.row, index > 0 && styles.divider]}
            >
              <View style={styles.tierColumn}>
                <TierBadge tier={item.tier} />
              </View>
              <AppText variant="title" style={[styles.rateColumn, styles.rate]}>
                {percent(item.rate)}
              </AppText>
              <AppText
                variant="small"
                style={[styles.shardColumn, styles.shards]}
              >
                +{item.duplicateShards}
              </AppText>
            </View>
          ))}
        </View>
      ) : rates.isError ? (
        <StatePanel
          compact
          title="확률을 불러오지 못했어요"
          description="연결 상태를 확인하고 다시 시도해 주세요."
          retry={() => void rates.refetch()}
          retryLabel="다시 불러오기"
        />
      ) : (
        <Loading label="확률을 불러오고 있어요" />
      )}
      <View style={styles.notices}>
        {notices.map((notice, index) => (
          <View
            key={notice}
            style={[styles.notice, index > 0 && styles.noticeDivider]}
          >
            <Star
              accessible={false}
              size={16}
              color="#D79B55"
              fill="#FBE3B7"
              style={{ marginTop: 4 }}
            />
            <AppText variant="small" style={styles.noticeText}>
              {notice}
            </AppText>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

function OddsTitle() {
  return (
    <View style={styles.titleArea}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.decoration, { left: 0 }]}
      >
        <Image
          accessible={false}
          source={emotions.neutral.source}
          resizeMode="contain"
          style={styles.mozzi}
        />
        <View style={styles.cloud} />
        <Star
          size={20}
          color="#DBA45D"
          fill="#FBE5AF"
          style={styles.leftStar}
        />
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.decoration, { right: 0 }]}
      >
        <Image
          accessible={false}
          source={gachaArt.mochi}
          resizeMode="contain"
          style={[styles.mozzi, { transform: [{ rotate: '8deg' }] }]}
        />
        <View style={styles.cloud} />
        <Sparkles size={20} color="#D78AA8" style={styles.rightStar} />
      </View>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        등급별 획득 확률
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  ink: { color: ink },
  titleArea: { minHeight: 78, justifyContent: 'flex-end' },
  title: {
    color: ink,
    fontSize: 26,
    lineHeight: 36,
    textAlign: 'center',
    paddingHorizontal: 34,
    paddingTop: 36,
  },
  decoration: { position: 'absolute', top: 0, width: 64, height: 50 },
  mozzi: { width: 50, height: 50, alignSelf: 'center' },
  cloud: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 14,
    borderRadius: 20,
    backgroundColor: '#FCE6EC',
    borderWidth: 1,
    borderColor: '#F4D3DF',
  },
  leftStar: { position: 'absolute', right: -4, top: 19 },
  rightStar: { position: 'absolute', left: -5, top: 14 },
  table: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3DFE5',
    backgroundColor: '#FFFCFB',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F9E8ED',
  },
  headerText: { color: '#8D5663', fontSize: 12, lineHeight: 20 },
  tierColumn: { flex: 1, minWidth: 66, alignItems: 'flex-start' },
  rateColumn: { flex: 1, textAlign: 'center' },
  shardColumn: { flex: 1.25, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F3E1E7',
  },
  rate: {
    color: '#603641',
    fontSize: 24,
    lineHeight: 30,
    fontVariant: ['tabular-nums'],
  },
  shards: { color: ink, fontSize: 15, fontVariant: ['tabular-nums'] },
  notices: {
    backgroundColor: '#F9F0EB',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    paddingVertical: 7,
  },
  noticeDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFDFDD',
  },
  noticeText: { flex: 1, color: ink, fontSize: 14, lineHeight: 22 },
  confirm: {
    minHeight: 56,
    borderRadius: 28,
    backgroundColor: '#AC6D60',
    borderColor: '#8F544D',
    boxShadow: '0 3px 0 rgba(117, 74, 82, 0.18)',
  },
  confirmLabel: { color: '#FFF9F7', fontSize: 24, lineHeight: 30 },
});
