import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { EmotionImage } from '@/components/emotion/Emotion';
import { cozyColors } from '@/theme/cozy';

export const christmas = {
  ...cozyColors,
  bg: '#FAF7F2',
  card: '#FFF9F7',
  edge: '#EFC5CA',
  ink: '#4D3831',
  accent: '#B95B58',
  coral: '#E97873',
  pink: '#FCE6E9',
};

// All seasonal decorations are local vectors; existing character art stays intact.
function Holly() {
  return (
    <G>
      <Path
        d="M0 0 Q-24 -5 -15 -23 L-9 -19 -7 -29 0 -22 5 -26 Q15 -7 0 0Z"
        fill="#6F995E"
        stroke="#527849"
        strokeWidth="1.5"
      />
      <Path
        d="M0 0 Q5 -24 24 -21 L22 -14 30 -10 23 -5 27 1 Q12 11 0 0Z"
        fill="#87A76C"
        stroke="#527849"
        strokeWidth="1.5"
      />
      <Path
        d="M-1 -2 L-7 -19 M-6 -15 L-13 -17 M-4 -10 L2 -17 M3 -1 L20 -14 M10 -6 L11 -15 M14 -9 L22 -7"
        fill="none"
        stroke="#BCD29A"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <Path
        d="M-14 -21 Q-20 -10 -8 -5 M16 -18 L21 -18"
        fill="none"
        stroke="#D2DFB4"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Circle cx="-3" cy="1" r="5" fill="#CD625D" />
      <Circle cx="6" cy="3" r="5" fill="#E78074" />
      <Circle cx="1" cy="-6" r="5" fill="#DB6A61" />
      <Circle cx="-4.5" cy="-1" r="1.5" fill="#FFD6C1" />
      <Circle cx="4.5" cy="1" r="1.5" fill="#FFE3C5" />
      <Circle cx="-0.5" cy="-8" r="1.5" fill="#FFD6C1" />
    </G>
  );
}

export function WinterBackdrop() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: christmas.bg }]}
    >
      <Svg
        width="100%"
        height={310}
        viewBox="0 0 390 310"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="winterSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor="#FCE6E9" />
            <Stop offset="0.55" stopColor="#FFF0EE" />
            <Stop offset="1" stopColor={christmas.bg} />
          </LinearGradient>
        </Defs>
        <Rect width="390" height="310" fill="url(#winterSky)" />
        <Path
          d="M0 116 Q55 86 112 108 T225 100 T390 115 V200 H0Z"
          fill="#FFF9F7"
          opacity="0.75"
        />
        <Circle cx="160" cy="45" r="2" fill="white" />
        <Circle cx="230" cy="67" r="2.5" fill="white" />
        <Circle cx="345" cy="28" r="2" fill="white" />
      </Svg>
    </View>
  );
}

export function WinterVillage() {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.village}
    >
      <Svg width="100%" height="100%" viewBox="0 0 360 80">
        <Defs>
          <LinearGradient id="cottageWall" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0" stopColor="#F9D1AF" />
            <Stop offset="1" stopColor="#DDA193" />
          </LinearGradient>
          <LinearGradient id="windowGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor="#FFF8D1" />
            <Stop offset="1" stopColor="#F7C97F" />
          </LinearGradient>
        </Defs>
        <Path d="M0 71 Q65 49 145 67 T360 65 V80 H0Z" fill="#FFFCFA" />
        {[
          { x: 12, y: 30, s: 0.7 },
          { x: 151, y: 6, s: 1 },
          { x: 324, y: 33, s: 0.65 },
        ].map(({ x, y, s }) => (
          <G key={x} transform={`translate(${x} ${y}) scale(${s})`}>
            <Rect x="17" y="40" width="6" height="21" rx="2" fill="#9C7C68" />
            <Path
              d="M20 0 L5 25 H12 L0 43 H9 L-3 58 H43 L31 43 H40 L28 25 H35Z"
              fill="#78988A"
            />
            <Path
              d="M20 0 L5 25 Q13 29 20 23 Q28 29 35 25Z M12 30 L0 43 Q12 49 20 42 Q29 49 40 43 L28 30 Q20 36 12 30Z"
              fill="#FFFDFC"
            />
            <Path
              d="M8 45 Q15 50 20 45 Q28 51 34 46 M14 26 L18 28"
              fill="none"
              stroke="#DDE8E8"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <Circle cx="12" cy="38" r="1.5" fill="#EAB9A5" />
            <Circle cx="27" cy="50" r="1.7" fill="#E8D296" />
            <Circle cx="22" cy="17" r="1.3" fill="#F5DFAD" />
          </G>
        ))}
        <G transform="translate(207 16)">
          <Rect
            x="3"
            y="20"
            width="63"
            height="40"
            rx="4"
            fill="url(#cottageWall)"
          />
          <Path
            d="M4 47 H18 M12 53 H25 M48 49 H64 M50 55 H58"
            stroke="#C69083"
            strokeWidth="1"
            opacity="0.5"
          />
          <Path
            d="M-5 25 L34 -5 74 25"
            fill="#D99D99"
            stroke="#FFFDFC"
            strokeWidth="8"
            strokeLinejoin="round"
          />
          <Rect x="29" y="34" width="14" height="26" rx="3" fill="#B58471" />
          <Rect x="10" y="30" width="12" height="13" rx="2" fill="#FFE2A4" />
          <Rect x="49" y="30" width="10" height="13" rx="2" fill="#FFE2A4" />
          <Rect
            x="9"
            y="29"
            width="14"
            height="15"
            rx="3"
            fill="#FFEAB4"
            opacity="0.45"
          />
          <Rect
            x="10"
            y="30"
            width="12"
            height="13"
            rx="2"
            fill="url(#windowGlow)"
          />
          <Rect
            x="49"
            y="30"
            width="10"
            height="13"
            rx="2"
            fill="url(#windowGlow)"
          />
          <Path
            d="M16 30 V43 M10 36 H22 M54 30 V43 M49 36 H59"
            stroke="#FFF9EA"
            strokeWidth="2"
          />
          <Path
            d="M55 7 V-3 H63 V14"
            fill="#CDA09B"
            stroke="#FFFDFC"
            strokeWidth="3"
          />
          <Path
            d="M58 -8 Q51 -14 58 -18 Q65 -22 59 -27"
            fill="none"
            stroke="#FFFDFB"
            strokeWidth="3"
            opacity="0.7"
            strokeLinecap="round"
          />
          <Path
            d="M-2 27 Q10 23 20 25 M46 24 Q58 22 69 28 M5 58 H25 M43 59 H66"
            fill="none"
            stroke="#FFFAF5"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle
            cx="36"
            cy="40"
            r="4.5"
            fill="none"
            stroke="#759B79"
            strokeWidth="2.3"
          />
          <Path
            d="M33 43 L36 41 39 44"
            stroke="#D66F71"
            strokeWidth="1.8"
            fill="none"
          />
          <Circle cx="40" cy="51" r="1.1" fill="#F9DA96" />
          <Path
            d="M16 17 Q33 7 52 18"
            fill="none"
            stroke="#D49B82"
            strokeWidth="0.7"
          />
          {[14, 23, 33, 43, 53].map((x, i) => (
            <Circle
              key={x}
              cx={x}
              cy={i % 2 ? 15 : 18}
              r="1.3"
              fill={i % 2 ? '#F3C779' : '#E98F8B'}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

export function DateHolly() {
  return (
    <Svg width={25} height={30} viewBox="-30 -35 65 65">
      <Holly />
    </Svg>
  );
}

export function ChristmasCard({
  children,
  backgroundImage,
  contentSized = false,
}: {
  children: ReactNode;
  backgroundImage?: ImageSourcePropType;
  contentSized?: boolean;
}) {
  return (
    <View style={[styles.card, contentSized && styles.contentCard]}>
      {backgroundImage && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.background}
        >
          <Image
            source={backgroundImage}
            resizeMode="cover"
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          />
        </View>
      )}
      {children}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.snow, !!backgroundImage && styles.hidden]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 148 44">
          <Defs>
            <LinearGradient id="snowIcing" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.6" stopColor="#FFFDFE" />
              <Stop offset="1" stopColor="#E8E4F6" />
            </LinearGradient>
          </Defs>
          <Path
            d="M4 35 Q0 6 30 7 Q49 1 68 7 Q93 4 110 10 Q136 9 145 18 Q144 26 117 24 L64 24 Q39 22 28 32 Q10 51 4 35Z"
            fill="#D8CBE3"
            opacity="0.25"
          />
          <Path
            d="M3 35 Q0 4 29 5 Q48 -1 68 5 Q91 2 109 8 Q133 6 144 16 Q143 23 116 21 L63 21 Q39 20 27 29 Q8 49 3 35Z"
            fill="url(#snowIcing)"
            stroke="#E5D7EA"
            strokeWidth="1"
          />
          <Path
            d="M10 24 Q15 8 33 9 Q52 4 68 9 M78 9 Q94 7 107 12 M117 13 L129 15"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <Circle cx="28" cy="16" r="1.6" fill="#DFE4F4" />
          <Circle cx="57" cy="12" r="1.2" fill="#E9DCF0" />
          <Path
            d="M17 26 V32 M14 29 H20 M89 14 V19 M86.5 16.5 H91.5"
            stroke="#FFFFFF"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </Svg>
      </View>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.ribbon, !!backgroundImage && styles.hidden]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 90 85">
          <Defs>
            <LinearGradient id="ribbonSilk" x1="0%" y1="0%" x2="35%" y2="100%">
              <Stop offset="0" stopColor="#FFB0A0" />
              <Stop offset="0.35" stopColor="#F78079" />
              <Stop offset="0.7" stopColor="#E75F65" />
              <Stop offset="1" stopColor="#BD4657" />
            </LinearGradient>
            <LinearGradient id="ribbonTail" x1="0%" y1="0%" x2="100%" y2="70%">
              <Stop offset="0" stopColor="#CA4C59" />
              <Stop offset="0.45" stopColor="#F9867C" />
              <Stop offset="1" stopColor="#D55563" />
            </LinearGradient>
            <LinearGradient id="ribbonKnot" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor="#CC4F5D" />
              <Stop offset="0.35" stopColor="#FFAA91" />
              <Stop offset="0.65" stopColor="#F38C7F" />
              <Stop offset="1" stopColor="#C94959" />
            </LinearGradient>
          </Defs>
          <Ellipse
            cx="47"
            cy="47"
            rx="31"
            ry="13"
            fill="#AF5264"
            opacity="0.12"
            transform="rotate(12 47 47)"
          />
          <G transform="translate(50 26)">
            <Holly />
          </G>
          <Path
            d="M36 37 Q35 55 24 74 L39 68 49 80 Q57 57 53 39Z M50 38 Q65 52 71 71 L76 57 88 54 Q70 43 60 32Z"
            fill="url(#ribbonTail)"
            stroke="#BD5260"
            strokeWidth="1.3"
          />
          <Path
            d="M42 43 Q42 60 36 67 M57 43 Q69 51 73 60"
            fill="none"
            stroke="#FFC0A5"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.8"
          />
          <Path
            d="M50 45 Q53 59 48 73 L41 65Z M62 45 L80 54 74 56Z"
            fill="#B84959"
            opacity="0.35"
          />
          <Path
            d="M44 32 C31 21 13 7 7 17 C2 26 8 45 17 46 C26 47 36 43 44 39Z M49 33 C58 22 76 13 81 23 C86 34 78 46 70 47 C62 48 55 42 49 40Z"
            fill="url(#ribbonSilk)"
            stroke="#C45361"
            strokeWidth="1.3"
          />
          <Path
            d="M10 19 C15 13 31 28 38 32 M78 25 C74 20 61 29 56 33"
            fill="none"
            stroke="#FFD0B8"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <Path
            d="M13 37 Q25 33 40 36 Q26 39 19 43Z M54 37 Q67 34 78 34 Q68 43 54 39Z"
            fill="#B74258"
            opacity="0.35"
          />
          <Path
            d="M16 27 L37 34 M61 36 L73 29 M19 40 Q30 37 38 38"
            fill="none"
            stroke="#FFD8C0"
            strokeWidth="0.7"
            opacity="0.55"
          />
          <Path
            d="M41 29 Q47 26 53 30 L54 42 Q48 47 40 42Z"
            fill="url(#ribbonKnot)"
            stroke="#BC5060"
            strokeWidth="1.2"
          />
          <Path
            d="M44 31 Q46 35 44 41"
            fill="none"
            stroke="#FFE0C3"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.85"
          />
          <Path
            d="M47 45 Q42 51 47 56"
            fill="none"
            stroke="#C69A57"
            strokeWidth="1"
          />
          <Circle
            cx="48"
            cy="58"
            r="4.5"
            fill="#F3CA7C"
            stroke="#C7954F"
            strokeWidth="0.8"
          />
          <Path
            d="M44 59 Q48 57 52 59 M48 60 V62"
            fill="none"
            stroke="#BB8744"
            strokeWidth="0.7"
          />
          <Circle cx="46.5" cy="56.5" r="1.1" fill="#FFF3C6" />
        </Svg>
      </View>
    </View>
  );
}

export function SantaMozzi({ drawing = false }: { drawing?: boolean }) {
  return (
    <View style={styles.character}>
      <View style={styles.characterArt}>
        <EmotionImage emotion="happy" size={156} />
      </View>
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Svg width="100%" height="100%" viewBox="0 0 220 215">
          <Defs>
            <LinearGradient id="santaVelvet" x1="0%" y1="0%" x2="60%" y2="100%">
              <Stop offset="0" stopColor="#F6A08B" />
              <Stop offset="0.5" stopColor="#E47B73" />
              <Stop offset="1" stopColor="#C25560" />
            </LinearGradient>
            <LinearGradient
              id="notebookPaper"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0" stopColor="#FFFAE9" />
              <Stop offset="1" stopColor="#F6DEB1" />
            </LinearGradient>
          </Defs>
          <Ellipse
            cx="110"
            cy="196"
            rx="72"
            ry="8"
            fill="#EEDBD4"
            opacity="0.45"
          />
          <G transform="translate(0 12)">
            <Path
              d="M62 66 Q87 -3 132 17 Q158 25 171 57 Q148 43 139 52Z"
              fill="url(#santaVelvet)"
              stroke="#B95B58"
              strokeWidth="2"
            />
            <Path
              d="M80 41 Q97 15 120 23 M132 30 Q146 35 151 43"
              fill="none"
              stroke="#FFBEA3"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.7"
            />
            <Path
              d="M66 59 Q114 33 158 55 Q166 60 161 73 Q112 51 69 77 Q58 74 62 66Z"
              fill="#FFF9F1"
              stroke="#DFC3B7"
              strokeWidth="2"
            />
            <Circle
              cx="170"
              cy="59"
              r="12"
              fill="#FFFBF5"
              stroke="#DFC3B7"
              strokeWidth="2"
            />
            <Path
              d="M68 65 Q109 46 153 60"
              stroke="#FFFFFF"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            {[73, 87, 101, 116, 131, 147].map((x, i) => (
              <Circle
                key={x}
                cx={x}
                cy={i === 0 ? 68 : i === 5 ? 63 : 58}
                r="2"
                fill="#FFFFFF"
                opacity="0.75"
              />
            ))}
            <Circle cx="167" cy="55" r="6" fill="#FFFFFF" />
            <Circle cx="175" cy="62" r="3" fill="#F0E0D9" opacity="0.6" />
          </G>
          {drawing ? (
            <G>
              <Path
                d="M112 147 L167 151 159 198 105 192Z"
                fill="url(#notebookPaper)"
                stroke="#B98F70"
                strokeWidth="2"
              />
              <Path
                d="M125 150 V141 M139 151 V142 M153 152 V143"
                stroke="#B98F70"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <Path
                d="M138 159 L124 180 H131 L122 188 H149 L141 180 H148Z"
                fill="#8AA377"
              />
              <Path
                d="M137 155 L139 159 143 160 140 163 140 167 136 165 132 167 133 163 130 160 135 159Z"
                fill="#E3B964"
              />
              <Circle cx="133" cy="177" r="1.7" fill="#DF9180" />
              <Circle cx="141" cy="183" r="1.7" fill="#D8B76B" />
              <Path
                d="M136 188 V192 M116 193 L151 197"
                stroke="#BA9672"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <Path
                d="M163 155 L156 193"
                stroke="#FFFDF2"
                strokeWidth="1.5"
                opacity="0.8"
              />
              <Path
                d="M79 137 L101 175 105 184 96 179 74 140Z"
                fill="#E9B961"
                stroke="#AA7D56"
                strokeWidth="2"
              />
            </G>
          ) : (
            <G>
              <Path
                d="M40 164 Q78 156 110 170 Q142 155 181 164 L185 198 Q145 188 110 201 Q76 188 35 197Z"
                fill="url(#notebookPaper)"
                stroke="#BC9275"
                strokeWidth="2"
              />
              <Path
                d="M110 171 V200 M49 176 Q77 171 100 180 M49 185 Q77 180 100 189 M122 180 Q145 171 170 176 M122 189 Q145 180 170 185"
                fill="none"
                stroke="#D6B59B"
                strokeWidth="1.5"
              />
              <Path
                d="M169 169 L190 142 198 148 177 176 168 180Z"
                fill="#E68A75"
                stroke="#B96D59"
                strokeWidth="2"
              />
              <Path
                d="M109 176 Q111 184 109 195 M43 193 Q74 187 103 196 M117 196 Q148 185 179 193"
                fill="none"
                stroke="#E1BDA1"
                strokeWidth="1"
              />
              <Path
                d="M58 169 C52 164 47 170 58 175 C69 170 64 164 58 169Z"
                fill="#E6A4A0"
              />
            </G>
          )}
          <Path
            d="M34 94 L28 83 M24 108 L12 104 M187 96 L195 86"
            stroke="#EBC66C"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: 22,
    overflow: 'hidden',
  },
  hidden: { display: 'none' },
  contentCard: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 0,
    gap: 16,
    paddingTop: 42,
    paddingBottom: 16,
  },
  village: {
    position: 'absolute',
    left: -16,
    right: -16,
    bottom: -3,
    height: 30,
  },
  card: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 0,
    backgroundColor: christmas.card,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: christmas.edge,
    padding: 18,
    paddingTop: 38,
    gap: 12,
    boxShadow: '0 4px 12px rgba(185, 91, 88, 0.08)',
  },
  snow: {
    position: 'absolute',
    top: -13,
    left: -7,
    width: '38%',
    maxWidth: 148,
    height: 44,
  },
  ribbon: { position: 'absolute', top: -30, right: -6, width: 68, height: 64 },
  character: {
    width: 190,
    height: 186,
    alignSelf: 'center',
  },
  characterArt: {
    position: 'absolute',
    top: 30,
    alignSelf: 'center',
    transform: [{ scale: 0.86 }],
  },
});
