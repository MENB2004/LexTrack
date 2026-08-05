import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

const darkColors = {
  background: '#0f172a', // Slate 900
  surface: '#1e293b',    // Slate 800
  accent: '#38bdf8',     // Sky 400
  text: '#f8fafc',       // Slate 50
  textSub: '#94a3b8',    // Slate 400
  priorityGold: '#fbbf24', // Amber 400
  danger: '#ef4444',     // Red 500
  success: '#10b981',    // Emerald 500
  border: '#334155',     // Slate 700
};

const lightColors = {
  background: '#f8fafc', // Slate 50
  surface: '#ffffff',    // White
  accent: '#0284c7',     // Sky 600
  text: '#0f172a',       // Slate 900
  textSub: '#64748b',    // Slate 500
  priorityGold: '#d97706', // Amber 600
  danger: '#dc2626',     // Red 600
  success: '#059669',    // Emerald 600
  border: '#cbd5e1',     // Slate 300
};

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true); // default to dark theme

  useEffect(() => {
    AsyncStorage.getItem('theme').then((value) => {
      if (value) {
        setIsDark(value === 'dark');
      }
    });
  }, []);

  const toggle = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('theme', next ? 'dark' : 'light');
  };

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggle, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
