import { Platform } from 'react-native';

// Configure notification behavior
if (Platform.OS !== 'web') {
  const Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Request notification permissions and show notifications.
 * Uses Web Notification API on desktop, expo-notifications on mobile.
 */
export async function requestNotificationPermission() {
  if (Platform.OS === 'web') {
    if ('Notification' in window && Notification.permission !== 'granted') {
      await Notification.requestPermission();
    }
    return true;
  } else {
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }
}

/**
 * Show a notification to the user.
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 */
export async function showNotification(title, body) {
  if (Platform.OS === 'web') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/assets/icon.png' });
    }
  } else {
    const Notifications = require('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null, // immediate
    });
  }
}

/**
 * Save push token (mobile only — not needed on desktop).
 */
export async function savePushToken(userId) {
  if (Platform.OS === 'web' || !userId) return null;

  try {
    const Device = require('expo-device');
    const Notifications = require('expo-notifications');
    const { supabase } = require('../../lib/supabase');

    if (!Device.isDevice) return null;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await supabase
      .from('profiles')
      .upsert({ id: userId, expo_push_token: token });

    return token;
  } catch (error) {
    console.error('Error in savePushToken:', error);
    return null;
  }
}
