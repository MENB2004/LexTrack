import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, StatusBar, Platform, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './lib/supabase';
import AuthNavigator from './src/navigation/AuthNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { savePushToken } from './src/services/notifications';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';
const Updates = Platform.OS !== 'web' ? require('expo-updates') : null;

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import TitleBar from './src/components/TitleBar';

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isDark, colors } = useTheme();

  // Inject custom scrollbar style for desktop/web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        /* Premium custom scrollbars */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 4px;
          border: 1px solid #0f172a;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #38bdf8;
        }
        
        /* Remove web focus rings outline */
        *:focus {
          outline: none !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  useEffect(() => {
    // 1. Fetch initial session on app mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user && Platform.OS !== 'web') {
        savePushToken(session.user.id);
      }
      setLoading(false);
    });

    // 2. Listen for auth changes (login, logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED') && Platform.OS !== 'web') {
        savePushToken(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check for OTA updates via EAS Update
  useEffect(() => {
    async function checkUpdates() {
      if (__DEV__ || Platform.OS === 'web' || !Updates) return; // Don't check for OTA updates during local development or on web
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          Alert.alert(
            'Update Required',
            'A new version of LexTrack is available. The app will restart now to apply the update.',
            [
              {
                text: 'Update Now',
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ],
            { cancelable: false }
          );
        }
      } catch (err) {
        console.warn('EAS Update Check Error:', err);
      }
    }

    checkUpdates();
  }, []);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {Platform.OS === 'web' && <TitleBar />}
      <NavigationContainer theme={{
        dark: isDark,
        colors: {
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          primary: colors.accent,
        }
      }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        {session ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
