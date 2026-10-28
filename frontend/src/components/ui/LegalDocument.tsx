import { View } from 'react-native';
import { legalDocuments, type LegalType } from '@/constants/legal';
import { AppText } from './Text';

export function LegalDocument({ type }: { type: LegalType }) {
  return (
    <View style={{ gap: 16 }}>
      {legalDocuments[type].body
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((paragraph, index) => (
          <AppText
            key={index}
            variant={paragraph.startsWith('#') ? 'label' : 'small'}
            selectable
          >
            {paragraph.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '')}
          </AppText>
        ))}
    </View>
  );
}
