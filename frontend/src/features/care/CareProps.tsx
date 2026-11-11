import Svg, { Circle, Ellipse, G, Mask, Path, Rect } from 'react-native-svg';

/** Hand-drawn vector care props (not taken from any other app). */

const CHIPS: readonly (readonly [number, number])[] = [
  [16, 19],
  [32, 15],
  [36, 31],
  [19, 35],
  [26, 26],
  [12, 28],
];
// Bites are taken from the top edge, the side that faces the mouth.
const BITES: readonly (readonly [number, number, number])[] = [
  [17, 6, 10],
  [34, 7, 11],
];

/** `bites`: 0 whole, 1 or 2 bites taken. The third bite finishes the snack (handled by the scene). */
export function Cookie({
  size = 52,
  bites = 0,
}: {
  size?: number;
  bites?: 0 | 1 | 2;
}) {
  const id = `cookie-bites-${bites}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      {bites > 0 && (
        <Mask id={id}>
          <Rect width="52" height="52" fill="white" />
          {BITES.slice(0, bites).map(([x, y, r], i) => (
            <Circle key={i} cx={x} cy={y} r={r} fill="black" />
          ))}
        </Mask>
      )}
      <G mask={bites > 0 ? `url(#${id})` : undefined}>
        <Circle cx="26" cy="27.5" r="23" fill="#BD7D43" />
        <Circle
          cx="25.5"
          cy="25"
          r="22"
          fill="#E9B976"
          stroke="#C48C50"
          strokeWidth="1.5"
        />
        <Path
          d="M9 21Q12 9 24 8"
          fill="none"
          stroke="#F8D9A3"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {CHIPS.map(([x, y], i) => (
          <Rect
            key={i}
            x={x}
            y={y}
            width="5"
            height="5"
            rx="1.5"
            fill="#80523D"
            transform={`rotate(${i * 25} ${x} ${y})`}
          />
        ))}
      </G>
    </Svg>
  );
}

export function Ball({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 50 50">
      <Circle
        cx="25"
        cy="25"
        r="23"
        fill="#9BC9CC"
        stroke="#548D97"
        strokeWidth="1.5"
      />
      <Path
        d="M9 9Q33 10 40 40M4 28Q25 14 42 10"
        fill="none"
        stroke="#F7FAEF"
        strokeWidth="3"
      />
      <Ellipse
        cx="16"
        cy="11"
        rx="8"
        ry="3"
        fill="#FFF8DF"
        opacity="0.65"
        transform="rotate(-30 16 11)"
      />
    </Svg>
  );
}

export function Plate({
  width = 110,
  active = false,
}: {
  width?: number;
  active?: boolean;
}) {
  return (
    <Svg width={width} height={(width * 40) / 110} viewBox="0 0 110 40">
      <Ellipse cx="55" cy="25" rx="51" ry="13" fill="#D6CEC1" opacity="0.4" />
      <Path
        d="M5 18Q10 37 55 37Q100 37 105 18"
        fill={active ? '#C6D6BA' : '#E0DDD3'}
      />
      <Ellipse
        cx="55"
        cy="18"
        rx="50"
        ry="15"
        fill={active ? '#E7EDDB' : '#F2EEE5'}
        stroke={active ? '#9CAB83' : '#C7BEAF'}
        strokeWidth="1.5"
      />
      <Ellipse
        cx="55"
        cy="18"
        rx="36"
        ry="9"
        fill="none"
        stroke={active ? '#BFCCA9' : '#DBD3C5'}
      />
    </Svg>
  );
}

export function Heart({
  size = 26,
  color = '#D48279',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Path
        d="M14 25C9 20 2 15 2 9C2 1 12 0 14 7C17 0 26 1 26 9C26 15 19 21 14 25Z"
        fill={color}
      />
    </Svg>
  );
}

export function PetHand({ size = 54 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 60) / 54} viewBox="0 0 54 60">
      <Path
        d="M48 24L28 15Q24 13 22 16L10 16Q4 16 5 21L24 25L8 24Q3 25 6 29L24 33L12 32Q7 34 12 38L28 43Q35 46 42 43L51 37"
        fill="#F4D6B7"
        stroke="#BB9271"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M24 25L34 29" fill="none" stroke="#D5AD8C" strokeWidth="1.5" />
    </Svg>
  );
}

/** Short radiating strokes for the moment of contact. */
export function ContactBurst({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 34 34">
      {[0, 1, 2, 3, 4].map(i => {
        const a = ((-80 + i * 40) * Math.PI) / 180;
        return (
          <Path
            key={i}
            d={`M${17 + Math.cos(a) * 8} ${17 + Math.sin(a) * 8}L${17 + Math.cos(a) * 15} ${17 + Math.sin(a) * 15}`}
            stroke="#C98A4F"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}
