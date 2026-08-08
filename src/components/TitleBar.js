import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function TitleBar() {
  if (Platform.OS !== 'web') return null;

  const { colors, isDark } = useTheme();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const win = window.__TAURI__?.window?.getCurrentWindow();
      if (win) {
        const max = await win.isMaximized();
        setIsMaximized(max);
      }
    };
    checkMaximized();
    
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = () => {
    window.__TAURI__?.window?.getCurrentWindow()?.minimize();
  };

  const handleMaximize = async () => {
    const win = window.__TAURI__?.window?.getCurrentWindow();
    if (win) {
      await win.toggleMaximize();
      const max = await win.isMaximized();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    window.__TAURI__?.window?.getCurrentWindow()?.close();
  };

  return (
    <View 
      style={{
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
        paddingLeft: 14,
        cursor: 'default',
        userSelect: 'none',
        // Enable Tauri window dragging
        // @ts-ignore
        WebkitAppRegion: 'drag',
      }}
      // @ts-ignore
      data-tauri-drag-region
    >
      {/* Title */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.textSub, fontSize: 13, marginRight: 6 }}>⚖️</Text>
        <Text style={{
          color: colors.text,
          fontWeight: 'bold',
          fontSize: 12,
          letterSpacing: 0.5,
        }}>
          LexTrack
        </Text>
      </View>

      {/* Window Controls */}
      <View style={{
        flexDirection: 'row',
        height: 36,
        alignItems: 'center',
        // Controls must NOT be draggable
        // @ts-ignore
        WebkitAppRegion: 'no-drag',
      }}>
        {/* Minimize */}
        <Pressable
          style={({ hovered, pressed }) => [
            {
              width: 46,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              transitionProperty: 'background-color',
              transitionDuration: '150ms',
            },
            hovered && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
            pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)' }
          ]}
          onPress={handleMinimize}
        >
          <Ionicons name="remove-outline" size={18} color={colors.text} />
        </Pressable>

        {/* Maximize */}
        <Pressable
          style={({ hovered, pressed }) => [
            {
              width: 46,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              transitionProperty: 'background-color',
              transitionDuration: '150ms',
            },
            hovered && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
            pressed && { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)' }
          ]}
          onPress={handleMaximize}
        >
          <Ionicons name={isMaximized ? "copy-outline" : "square-outline"} size={14} color={colors.text} />
        </Pressable>

        {/* Close */}
        <Pressable
          style={({ hovered, pressed }) => [
            {
              width: 46,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              transitionProperty: 'background-color',
              transitionDuration: '150ms',
            },
            hovered && { backgroundColor: '#ef4444' },
            pressed && { backgroundColor: '#b91c1c' }
          ]}
          onPress={handleClose}
        >
          {({ hovered }) => (
            <Ionicons name="close-outline" size={20} color={hovered ? '#ffffff' : colors.text} />
          )}
        </Pressable>
      </View>
    </View>
  );
}
