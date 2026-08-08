import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';

let Notifications = null;
let Device = null;

if (Platform.OS !== 'web') {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  // Configure notification behavior for when the app is in the foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Register for push notifications, retrieve the token, and save it to the Supabase profile.
 * Handles simulators and web environments gracefully.
 * @param {string} userId - The Supabase auth user ID
 */
export async function savePushToken(userId) {
  if (!userId || Platform.OS === 'web') return;

  try {
    // Gracefully handle simulator/web
    if (!Device.isDevice) {
      console.log('Push notifications are only supported on physical devices');
      return null;
    }

    // Gracefully handle Expo Go sandbox (SDK 54+ remote notifications limitation)
    let isExpoGo = false;
    try {
      const Constants = require('expo-constants').default;
      const ExecutionEnvironment = require('expo-constants').ExecutionEnvironment;
      isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
    } catch (e) {
      // fallback if expo-constants is not loaded
    }

    if (isExpoGo) {
      console.log('Push notifications skipped: Remote notifications are disabled in the Expo Go client. Create a development build to test notifications.');
      return null;
    }

    // Platform-specific configuration for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#38bdf8',
      });
    }

    // Check existing permission status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask for permission if not granted yet
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    // Retrieve Expo Push Token
    // projectId is automatically read from app.json
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    console.log('Expo Push Token generated successfully:', token);

    // Save/Upsert to Supabase profiles table
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, expo_push_token: token });

    if (error) {
      console.error('Error saving push token to Supabase profiles:', error.message);
    } else {
      console.log('Push token saved successfully to profiles table.');
    }

    return token;
  } catch (error) {
    console.error('Error in savePushToken service:', error);
    return null;
  }
}
