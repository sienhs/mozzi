import { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { DiaryArtwork } from '@/components/ui/DiaryCard';

const paper = '#FFF9F2';

function scallopedEdge(width: number, height: number) {
  const inset = 9;
  const horizontal = Math.max(2, Math.round((width - inset * 2) / 19));
  const vertical = Math.max(2, Math.round((height - inset * 2) / 19));
  const dx = (width - inset * 2) / horizontal;
  const dy = (height - inset * 2) / vertical;
  let path = `M${inset} ${inset}`;
  for (let i = 0; i < horizontal; i++)
    path += ` Q${inset + dx * (i + 0.5)} -2 ${inset + dx * (i + 1)} ${inset}`;
  for (let i = 0; i < vertical; i++)
    path += ` Q${width + 2} ${inset + dy * (i + 0.5)} ${width - inset} ${inset + dy * (i + 1)}`;
  for (let i = horizontal - 1; i >= 0; i--)
    path += ` Q${inset + dx * (i + 0.5)} ${height + 2} ${inset + dx * i} ${height - inset}`;
  for (let i = vertical - 1; i >= 0; i--)
    path += ` Q-2 ${inset + dy * (i + 0.5)} ${inset} ${inset + dy * i}`;
  return `${path}Z`;
}

export function ChristmasTape() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 32">
      <Path
        d="M3 2 L97 2 94 6 98 10 94 14 98 18 94 23 97 28 H2 L5 24 1 20 5 15 1 10 5 6Z"
        fill="#D47973"
        opacity="0.92"
      />
      {[15, 39, 63, 87].map(x => (
        <G key={x}>
          <Rect
            x={x}
            y="2"
            width="9"
            height="26"
            fill="#789079"
            opacity="0.7"
          />
          <Path d={`M${x + 4} 2 V28`} stroke="#F8DEAD" strokeWidth="0.7" />
        </G>
      ))}
      <Path
        d="M3 9 H96 M3 22 H96"
        stroke="#66826E"
        strokeWidth="5"
        opacity="0.65"
      />
      <Path
        d="M3 7 H96 M3 17 H96 M3 25 H96"
        stroke="#FFE8CA"
        strokeWidth="0.8"
        opacity="0.85"
      />
      <Path
        d="M8 3 V28 M31 3 V28 M55 3 V28 M79 3 V28"
        stroke="#FFE9CC"
        strokeWidth="0.7"
        opacity="0.8"
      />
    </Svg>
  );
}

export function ChristmasPostmark() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 60">
      <G fill="none" stroke="#CD858B" strokeWidth="1.4" opacity="0.7">
        <Circle cx="29" cy="29" r="24" />
        <Circle cx="29" cy="29" r="19" strokeDasharray="5 3" />
        <Path
          d="M52 21 C67 11 76 30 90 22 S108 21 117 20 M53 31 C68 21 77 40 91 32 S109 31 118 30 M53 41 C68 31 77 50 91 42 S109 41 118 40"
          strokeLinecap="round"
        />
      </G>
      <Path
        d="M29 14 L20 29 H24 L17 38 H27 V44 H31 V38 H41 L34 29 H38Z"
        fill="#CD858B"
        opacity="0.65"
      />
      <Path
        d="M29 5 L31 10 36 10 32 13 33 18 29 15 25 18 26 13 22 10 27 10Z"
        fill="#CD858B"
        opacity="0.7"
      />
    </Svg>
  );
}

function SnowmanSticker() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 58 80">
      <Path
        d="M13 31 Q7 21 17 12 Q16 5 25 6 Q31 -2 39 6 Q47 5 48 13 Q58 25 49 36 Q62 50 54 68 Q47 80 27 77 Q4 76 4 59 Q3 44 13 31Z"
        fill={paper}
        stroke="#ECD3C7"
        strokeWidth="1"
      />
      <Circle cx="30" cy="55" r="21" fill="#FFF7EE" stroke="#DDC3B3" />
      <Circle cx="30" cy="29" r="16" fill="#FFFBF4" stroke="#DDC3B3" />
      <Path d="M15 20 Q15 1 32 7 Q43 7 45 21Z" fill="#C76C6B" />
      <Path
        d="M16 17 L44 20 M21 9 L22 17 M29 8 L30 18 M37 10 L38 19"
        stroke="#DF9390"
        strokeWidth="1.5"
      />
      <Circle cx="32" cy="6" r="5" fill="#D8867D" />
      <Path
        d="M13 21 Q29 16 46 23"
        stroke="#FFF6EA"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Circle cx="24" cy="28" r="1.4" fill="#775044" />
      <Circle cx="36" cy="28" r="1.4" fill="#775044" />
      <Path d="M28 30 L34 32 28 34Z" fill="#EBA36D" />
      <Circle cx="20" cy="33" r="3" fill="#F1B7AA" opacity="0.7" />
      <Circle cx="40" cy="33" r="3" fill="#F1B7AA" opacity="0.7" />
      <Path
        d="M13 40 Q30 47 47 40"
        fill="none"
        stroke="#C66C68"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Path
        d="M38 44 L42 60"
        stroke="#C66C68"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Circle cx="29" cy="53" r="1.7" fill="#B58C75" />
      <Circle cx="29" cy="62" r="1.7" fill="#B58C75" />
    </Svg>
  );
}

function HollySticker() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 60 50">
      <Path
        d="M27 28 L10 25 5 14 13 11 12 2 24 5 30 1 36 15 47 10 55 17 57 27 48 31 51 41 34 45 28 37 16 45 5 39 10 29Z"
        fill={paper}
        stroke="#E8D3C2"
        strokeWidth="1"
      />
      <Path
        d="M28 30 L10 20 15 15 17 7 24 11 29 7 34 24 M29 31 L40 17 45 20 50 17 52 25 46 29 47 36 33 39 M27 31 L15 30 11 36 18 39 23 35 26 39 33 32"
        fill="#7A985E"
        stroke="#657E51"
        strokeWidth="1.2"
      />
      <Path
        d="M19 12 L28 28 M47 24 L33 30 M16 35 L25 32"
        stroke="#C3D29F"
        strokeWidth="1"
      />
      <Circle cx="28" cy="31" r="5" fill="#D37673" />
      <Circle cx="36" cy="30" r="4.5" fill="#BD625F" />
      <Circle cx="31" cy="24" r="4" fill="#E28E7E" />
      <Circle cx="27" cy="29" r="1.2" fill="#FFE0BE" />
    </Svg>
  );
}

export function StampFrame({ uri }: { uri?: string | null }) {
  const [image, setImage] = useState({ uri, ratio: 1 });
  const [size, setSize] = useState({ width: 300, height: 300 });
  const [space, setSpace] = useState({ width: 0, height: 0 });
  useEffect(() => {
    let active = true;
    if (uri)
      Image.getSize(
        uri,
        (width, height) => {
          if (active && width > 0 && height > 0)
            setImage({ uri, ratio: width / height });
        },
        () => undefined,
      );
    return () => {
      active = false;
    };
  }, [uri]);
  const ratio = image.uri === uri ? image.ratio : 1;
  // Fit the entire image and its paper edge inside the remaining card space.
  const availableWidth = Math.max(0, space.width - 16);
  const availableHeight = Math.max(0, space.height - 42);
  const frameWidth = Math.min(
    availableWidth,
    Math.max(0, availableHeight - 28) * ratio + 28,
  );
  const frameHeight = Math.max(0, frameWidth - 28) / ratio + 28;
  const edge = scallopedEdge(size.width, size.height);
  return (
    <View
      style={styles.scene}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setSpace(previous =>
          previous.width === width && previous.height === height
            ? previous
            : { width, height },
        );
      }}
    >
      <View
        style={[
          styles.stamp,
          {
            width: frameWidth,
            height: frameHeight,
            opacity: space.width ? 1 : 0,
          },
        ]}
        onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (width > 0 && height > 0) setSize({ width, height });
        }}
      >
        <View
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${size.width} ${size.height}`}
          >
            <Path
              d={edge}
              fill="#B78A85"
              opacity="0.13"
              transform="translate(0 2)"
            />
            <Path d={edge} fill={paper} stroke="#EED8CD" strokeWidth="0.8" />
          </Svg>
        </View>
        <DiaryArtwork uri={uri} ratio={ratio} fit="contain" rounded={false} />
        <View
          pointerEvents="none"
          style={styles.tape}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ChristmasTape />
        </View>
        <View
          pointerEvents="none"
          style={styles.holly}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <HollySticker />
        </View>
        <View
          pointerEvents="none"
          style={styles.snowman}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <SnowmanSticker />
        </View>
        <View
          pointerEvents="none"
          style={styles.postmark}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ChristmasPostmark />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    minHeight: 0,
    paddingTop: 12,
    paddingBottom: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stamp: { padding: 14, transform: [{ rotate: '-1.5deg' }] },
  tape: {
    position: 'absolute',
    width: 82,
    height: 27,
    top: -8,
    alignSelf: 'center',
    transform: [{ rotate: '-9deg' }],
  },
  holly: {
    position: 'absolute',
    width: 43,
    height: 37,
    bottom: -9,
    left: -5,
    transform: [{ rotate: '-8deg' }],
  },
  snowman: {
    position: 'absolute',
    width: 43,
    height: 60,
    bottom: -3,
    right: -11,
    transform: [{ rotate: '8deg' }],
  },
  postmark: {
    position: 'absolute',
    width: 93,
    height: 47,
    bottom: -26,
    right: 10,
    transform: [{ rotate: '-5deg' }],
  },
});
