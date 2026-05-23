import React, { useCallback, useRef, useState } from "react";
import { PanResponder, View, StyleSheet, type ViewStyle } from "react-native";

interface Props {
  value: number;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor?: string;
  maximumTrackTintColor?: string;
  thumbTintColor?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

const THUMB = 22;
const TRACK_H = 4;

export function JsSlider({
  value,
  minimumValue = 0,
  maximumValue = 1,
  step,
  onValueChange,
  onSlidingComplete,
  minimumTrackTintColor = "#FFC107",
  maximumTrackTintColor = "#444",
  thumbTintColor = "#FFC107",
  style,
  disabled = false,
}: Props) {
  const trackWidth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback(
    (raw: number) => {
      let v = Math.max(minimumValue, Math.min(maximumValue, raw));
      if (step && step > 0) v = Math.round((v - minimumValue) / step) * step + minimumValue;
      return parseFloat(v.toFixed(10));
    },
    [minimumValue, maximumValue, step],
  );

  const pct = (value - minimumValue) / (maximumValue - minimumValue || 1);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (evt) => {
        setDragging(true);
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
          const raw = minimumValue + ratio * (maximumValue - minimumValue);
          onValueChange?.(clamp(raw));
        }
      },
      onPanResponderMove: (evt) => {
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
          const raw = minimumValue + ratio * (maximumValue - minimumValue);
          onValueChange?.(clamp(raw));
        }
      },
      onPanResponderRelease: (evt) => {
        setDragging(false);
        if (trackWidth.current > 0) {
          const x = evt.nativeEvent.locationX;
          const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
          const raw = minimumValue + ratio * (maximumValue - minimumValue);
          onSlidingComplete?.(clamp(raw));
        }
      },
      onPanResponderTerminate: () => setDragging(false),
    }),
  ).current;

  return (
    <View
      style={[styles.hit, style]}
      onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
    >
      <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: minimumTrackTintColor }]} />
      </View>
      <View
        style={[
          styles.thumb,
          {
            left: `${pct * 100}%` as any,
            marginLeft: -(THUMB / 2),
            backgroundColor: thumbTintColor,
            transform: [{ scale: dragging ? 1.25 : 1 }],
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 36,
    justifyContent: "center",
  },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: "hidden",
  },
  fill: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
  },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    top: "50%" as any,
    marginTop: -(THUMB / 2),
  },
});
