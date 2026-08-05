import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

export default function Logo({ size = 40 }) {
  const { colors } = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Slate Pillar & Scales Design */}
      <G fill={colors.accent} stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round">
        {/* Top Abacus Block */}
        <Rect x="40" y="24" width="20" height="4" rx="1" />

        {/* Pillar Capital Header */}
        <Rect x="39" y="36" width="22" height="4" rx="1" />

        {/* 3 Column Flutes */}
        <Rect x="41" y="40" width="4" height="28" rx="1" />
        <Rect x="48" y="40" width="4" height="32" rx="1" />
        <Rect x="55" y="40" width="4" height="28" rx="1" />

        {/* Crossbar Beam */}
        <Rect x="26" y="31" width="48" height="4" rx="2" />

        {/* Scroll Rings */}
        <Circle cx="29" cy="33" r="4" fill="none" strokeWidth="2" stroke={colors.accent} />
        <Circle cx="71" cy="33" r="4" fill="none" strokeWidth="2" stroke={colors.accent} />

        {/* Left Scale Strings & Dish */}
        <Path d="M29 35 L19 52 M29 35 L33 52" strokeWidth="2" fill="none" />
        <Path d="M17 52 C 17 60, 35 60, 35 52 Z" />

        {/* Right Scale Strings & Dish */}
        <Path d="M71 35 L65 52 M71 35 L79 52" strokeWidth="2" fill="none" />
        <Path d="M63 52 C 63 60, 81 60, 81 52 Z" />
      </G>
    </Svg>
  );
}
