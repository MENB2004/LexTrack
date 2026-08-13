import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ActivityIndicator, StatusBar, Platform, Alert, Modal, Text, TouchableOpacity } from 'react-native';
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

// Global reference to open the custom Web Alert Modal
let alertShowCallback = null;

if (Platform.OS === 'web') {
  const originalAlert = Alert.alert;
  Alert.alert = (title, message, buttons, options) => {
    if (alertShowCallback) {
      alertShowCallback({ title, message, buttons, options });
    } else {
      console.warn('Global Web Alert triggered before app initialization:', title, message);
      if (originalAlert) {
        originalAlert(title, message, buttons, options);
      }
    }
  };
}

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isDark, colors } = useTheme();
  const [globalAlert, setGlobalAlert] = useState(null);

  // Hook Alert.alert trigger to this component's state
  useEffect(() => {
    if (Platform.OS === 'web') {
      alertShowCallback = (config) => {
        setGlobalAlert(config);
      };
    }
    return () => {
      alertShowCallback = null;
    };
  }, []);

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

      {/* GLOBAL CUSTOM ALERT MODAL (Prevents 'tauri.localhost says') */}
      {Platform.OS === 'web' && globalAlert && (
        <Modal transparent visible={!!globalAlert} animationType="fade">
          <View style={styles.alertOverlay}>
            <View style={[styles.alertContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.alertTitle, { color: colors.text }]}>
                {globalAlert.title}
              </Text>
              {globalAlert.message ? (
                <Text style={[styles.alertSubtitle, { color: colors.textSub }]}>
                  {globalAlert.message}
                </Text>
              ) : null}

              <View style={styles.alertActions}>
                {(globalAlert.buttons && globalAlert.buttons.length > 0
                  ? globalAlert.buttons
                  : [{ text: 'OK' }]
                ).map((btn, index) => {
                  const isDestructive = btn.style === 'destructive' || btn.text?.toLowerCase().includes('delete') || btn.text?.toLowerCase().includes('permanently');
                  const isCancel = btn.style === 'cancel' || btn.text?.toLowerCase().includes('cancel') || btn.text?.toLowerCase().includes('later');
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.alertBtn,
                        isDestructive && { backgroundColor: colors.danger },
                        !isDestructive && !isCancel && { backgroundColor: colors.accent },
                        isCancel && { borderColor: colors.border, borderWidth: 1 }
                      ]}
                      activeOpacity={0.8}
                      onPress={() => {
                        setGlobalAlert(null);
                        if (btn.onPress) btn.onPress();
                      }}
                    >
                      <Text style={[
                        styles.alertBtnText,
                        isCancel ? { color: colors.textSub } : { color: '#ffffff' }
                      ]}>
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  alertContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  alertSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  alertActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 12,
  },
  alertBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
