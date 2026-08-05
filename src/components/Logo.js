import React from 'react';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

export default function Logo({ size = 40 }) {
  const { colors } = useTheme();

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Background Circle */}
      <Circle cx="50" cy="50" r="45" fill={colors.border} opacity="0.3" />
      
      {/* Scales of Justice Path Design */}
      <G stroke={colors.accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Central Stand */}
        <Path d="M50 25 L50 75" />
        <Path d="M38 75 L62 75" />
        
        {/* Balance Crossbeam */}
        <Path d="M22 35 L78 35" />
        
        {/* Left Scale Strings & Dish */}
        <Path d="M22 35 L14 55 L30 55 Z" fill={colors.accent} fillOpacity="0.1" />
        <Path d="M14 55 C 14 62, 30 62, 30 55" />
        
        {/* Right Scale Strings & Dish */}
        <Path d="M78 35 L70 55 L86 55 Z" fill={colors.accent} fillOpacity="0.1" />
        <Path d="M70 55 C 70 62, 86 62, 86 55" />
      </G>
      
      {/* Accent Pivot Joint */}
      <Circle cx="50" cy="35" r="4" fill={colors.priorityGold} />
    </Svg>
  );
}
