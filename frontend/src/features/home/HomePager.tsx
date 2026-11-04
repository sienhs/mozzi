import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

// 홈의 가로 넘기기. 0번이 오늘이고, 지난 기록은 왼쪽에 놓여 왼쪽에서 오른쪽으로 끌면 계속 넘어간다.
// 첫 장에서 반대로는 가지 않고 살짝 버티다 돌아온다. ScrollView 대신 직접 그려
// 화면 전체가 스크롤 없이 고정되고, 지금 장과 양옆 한 장씩만 그린다.
// 넘길 장이 있는 쪽 가장자리에 작은 화살표를 두어 밀어서 넘긴다는 걸 알린다(눌러도 넘어간다).
const SWIPE_RATIO = 0.18;
// 손을 뗄 때 속도(논리 단위/ms)가 이보다 빠르면 짧게 밀어도 넘긴다.
const SWIPE_VELOCITY = 0.35;
// 가로로 이만큼 움직이고 세로보다 확실히 클 때만 넘기기로 본다(그 전에는 안쪽 버튼이 터치를 갖는다).
const DRAG_START = 12;
const native = Platform.OS !== 'web';

export interface PagerControls {
  index: number;
  // 버튼으로 다른 장으로 넘긴다.
  goTo: (index: number) => void;
}
export function HomePager({
  count,
  renderPage,
  onNearEnd,
  onIndexChange,
  hintColor = '#B95B58',
}: {
  count: number;
  hintColor?: string;
  renderPage: (index: number, controls: PagerControls) => ReactNode;
  // 끝에서 두 장 안쪽에 닿으면 부른다(다음 페이지 받기).
  onNearEnd?: () => void;
  onIndexChange?: (index: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  // 버튼·뒤로 가기로 요청한 장. 렌더 중에는 상태만 바꾸고 이동은 effect가 한다.
  const [request, setRequest] = useState<{ page: number } | null>(null);
  const [offset] = useState(() => new Animated.Value(0));
  // 터치 처리기와 effect가 렌더를 기다리지 않고 읽는 값.
  const live = useRef({
    index: 0,
    width: 0,
    count,
    onNearEnd,
    onIndexChange,
    touch: null as null | {
      x: number;
      y: number;
      lastX: number;
      lastT: number;
      vx: number;
    },
  });
  useEffect(() => {
    live.current.count = count;
    live.current.onNearEnd = onNearEnd;
    live.current.onIndexChange = onIndexChange;
  });

  const goTo = useCallback(
    (target: number, velocity = 0) => {
      const state = live.current;
      const next = Math.max(0, Math.min(state.count - 1, target));
      const moved = next !== state.index;
      state.index = next;
      setIndex(next);
      Animated.spring(offset, {
        toValue: next * state.width,
        velocity,
        speed: 20,
        bounciness: 0,
        useNativeDriver: native,
      }).start();
      if (moved) {
        state.onIndexChange?.(next);
        if (native) void Haptics.selectionAsync().catch(() => undefined);
      }
      if (next >= state.count - 3) state.onNearEnd?.();
    },
    [offset],
  );

  useEffect(() => {
    if (request) goTo(request.page);
  }, [request, goTo]);
  // 지난 기록이 줄어들면(계정 변경 등) 남은 마지막 장으로 돌아온다.
  useEffect(() => {
    if (live.current.index > count - 1) goTo(count - 1);
  }, [count, goTo]);

  // 지난 기록을 보고 있으면 뒤로 가기가 오늘로 돌아온다.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (live.current.index === 0) return false;
          goTo(0);
          return true;
        },
      );
      return () => subscription.remove();
    }, [goTo]),
  );

  const point = (event: GestureResponderEvent) => ({
    x: event.nativeEvent.pageX,
    y: event.nativeEvent.pageY,
    t: event.nativeEvent.timestamp,
  });
  const startTouch = (event: GestureResponderEvent) => {
    const p = point(event);
    live.current.touch = { x: p.x, y: p.y, lastX: p.x, lastT: p.t, vx: 0 };
  };
  // 첫 손가락 위치는 늘 기억해 두고, 가로로 확실히 끌 때만 터치를 가져온다.
  const claim = (event: GestureResponderEvent) => {
    const touch = live.current.touch;
    if (!touch) {
      startTouch(event);
      return false;
    }
    const p = point(event);
    const dx = p.x - touch.x;
    const dy = p.y - touch.y;
    return Math.abs(dx) > DRAG_START && Math.abs(dx) > Math.abs(dy) * 1.3;
  };
  const follow = (event: GestureResponderEvent) => {
    const state = live.current;
    const touch = state.touch;
    if (!touch) return;
    const p = point(event);
    if (p.t > touch.lastT) touch.vx = (p.x - touch.lastX) / (p.t - touch.lastT);
    touch.lastX = p.x;
    touch.lastT = p.t;
    const dx = p.x - touch.x;
    const edge =
      (state.index === 0 && dx < 0) ||
      (state.index === state.count - 1 && dx > 0);
    // 더 갈 곳이 없으면 4분의 1만 따라와 끝이라는 걸 알린다.
    offset.setValue(state.index * state.width + (edge ? dx * 0.25 : dx));
  };
  const release = (event: GestureResponderEvent) => {
    const state = live.current;
    const touch = state.touch;
    state.touch = null;
    if (!touch) return goTo(state.index);
    const dx = point(event).x - touch.x;
    // 오른쪽으로 끌면 지난 기록(다음 장), 왼쪽으로 끌면 최근 쪽(앞 장).
    const step =
      dx > state.width * SWIPE_RATIO || touch.vx > SWIPE_VELOCITY
        ? 1
        : dx < -state.width * SWIPE_RATIO || touch.vx < -SWIPE_VELOCITY
          ? -1
          : 0;
    goTo(state.index + step, touch.vx * 1000);
  };

  const controls: PagerControls = {
    index,
    goTo: page => setRequest({ page }),
  };
  return (
    <View
      style={styles.viewport}
      onLayout={event => {
        const w = event.nativeEvent.layout.width;
        if (w === live.current.width) return;
        live.current.width = w;
        setWidth(w);
        offset.setValue(live.current.index * w);
      }}
      onStartShouldSetResponderCapture={event => {
        startTouch(event);
        return false;
      }}
      onMoveShouldSetResponderCapture={claim}
      onResponderGrant={() => offset.stopAnimation()}
      onResponderMove={follow}
      onResponderRelease={release}
      onResponderTerminate={() => {
        live.current.touch = null;
        goTo(live.current.index);
      }}
      onResponderTerminationRequest={() => false}
    >
      {/* 폭을 재기 전(첫 그림·테스트 환경)에는 지금 장만 그대로 그린다. */}
      {width === 0 ? (
        <View style={{ flex: 1 }}>{renderPage(index, controls)}</View>
      ) : (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: offset }] },
          ]}
        >
          {Array.from({ length: count }, (_, page) =>
            Math.abs(page - index) > 1 ? null : (
              <View
                key={page}
                // 화면 밖 장은 화면 읽기 프로그램이 읽지 않게 숨긴다.
                accessibilityElementsHidden={page !== index}
                importantForAccessibility={
                  page === index ? 'auto' : 'no-hide-descendants'
                }
                pointerEvents={page === index ? 'auto' : 'none'}
                style={[styles.page, { left: -page * width, width }]}
              >
                {renderPage(page, controls)}
              </View>
            ),
          )}
        </Animated.View>
      )}
      {width > 0 && index < count - 1 && (
        <EdgeHint
          side="left"
          color={hintColor}
          label="지난 기록으로 넘기기"
          onPress={() => goTo(index + 1)}
        />
      )}
      {width > 0 && index > 0 && (
        <EdgeHint
          side="right"
          color={hintColor}
          label="최근 기록으로 넘기기"
          onPress={() => goTo(index - 1)}
        />
      )}
    </View>
  );
}

function EdgeHint({
  side,
  color,
  label,
  onPress,
}: {
  side: 'left' | 'right';
  color: string;
  label: string;
  onPress: () => void;
}) {
  const Glyph = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <View pointerEvents="box-none" style={[styles.hint, { [side]: 0 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        hitSlop={{ top: 16, bottom: 16, left: 6, right: 6 }}
        style={styles.hintButton}
      >
        <Glyph size={18} strokeWidth={2.4} color={color} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, minHeight: 0, overflow: 'hidden' },
  page: { position: 'absolute', top: 0, bottom: 0 },
  // 장 좌우 여백(20) 안에 들어가는 작은 화살표. 세로 가운데.
  hint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintButton: { opacity: 0.6, paddingVertical: 10 },
});
