import { Platform } from 'react-native';
import { showNotification } from '../services/notifications';

const Notifications = Platform.OS !== 'web' ? require('expo-notifications') : null;

// Keep track of active setTimeout alarm IDs for web/desktop to enable cancellation
const activeWebAlarms = new Map(); // caseId -> array of timeout IDs

/**
 * Helper to calculate alarm trigger times.
 * @param {string} hearingDate - The next hearing date string (YYYY-MM-DD)
 * @param {number} offsetDays - Days offset (e.g. -2 for 48 hours before)
 * @param {number} offsetHours - Hours offset (e.g. 8 for 8:00 AM)
 * @returns {Date} The trigger Date object
 */
function getTriggerDate(hearingDate, offsetDays = 0, offsetHours = 8) {
  const date = new Date(hearingDate);
  // Set to local morning hour (e.g. 8:00 AM) for full-day alarms
  date.setHours(offsetHours, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date;
}

/**
 * Schedule smart alarms locally on the device for priority cases.
 * Handles: 2-day advance alert, 1-day reminder, and 2-hour final reminder.
 * @param {Object} caseData - The case database object
 */
export async function schedulePriorityAlarms(caseData) {
  if (!caseData.next_hearing_date) return;

  // Cancel any existing alarms first (both web and mobile)
  await cancelPriorityAlarms(caseData.id);

  if (Platform.OS === 'web') {
    try {
      const hearing = new Date(caseData.next_hearing_date);
      const timeouts = [];

      const alerts = [
        {
          title: '⚠️ PRIORITY CASE — 2 Days to Hearing',
          body: `${caseData.case_number} | Client: ${caseData.client_name}\nHearing scheduled on ${hearing.toLocaleDateString()}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, -2, 8),
        },
        {
          title: '🔔 PRIORITY CASE — Hearing Tomorrow',
          body: `${caseData.case_number} | Client: ${caseData.client_name}\nHearing scheduled on ${hearing.toLocaleDateString()}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, -1, 8),
        },
        {
          title: '⏰ PRIORITY CASE — Hearing in 2 Hours',
          body: `${caseData.case_number} | Client: ${caseData.client_name} - Prepare case file.`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, 0, 9),
        },
      ];

      for (const alert of alerts) {
        const delay = alert.triggerDate.getTime() - Date.now();
        if (delay > 0) {
          const timeoutId = setTimeout(() => {
            showNotification(alert.title, alert.body);
          }, delay);
          timeouts.push(timeoutId);
        }
      }

      if (timeouts.length > 0) {
        activeWebAlarms.set(caseData.id, timeouts);
      }
      console.log(`Web priority alarms registered successfully for Case ID: ${caseData.id}`);
    } catch (error) {
      console.error('Error scheduling priority alarms on Web:', error);
    }
  } else {
    try {
      const hearing = new Date(caseData.next_hearing_date);
      const today = new Date();

      const alerts = [
        {
          id: `priority-2day-${caseData.id}`,
          title: '⚠️ PRIORITY CASE — 2 Days to Hearing',
          body: `${caseData.case_number} | Client: ${caseData.client_name}\nHearing scheduled on ${hearing.toLocaleDateString()}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, -2, 8),
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        {
          id: `priority-1day-${caseData.id}`,
          title: '🔔 PRIORITY CASE — Hearing Tomorrow',
          body: `${caseData.case_number} | Client: ${caseData.client_name}\nHearing scheduled on ${hearing.toLocaleDateString()}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, -1, 8),
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        {
          id: `priority-2hour-${caseData.id}`,
          title: '⏰ PRIORITY CASE — Hearing in 2 Hours',
          body: `${caseData.case_number} | Client: ${caseData.client_name} - Prepare case file.`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, 0, 9),
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
      ];

      for (const alert of alerts) {
        if (alert.triggerDate > today) {
          await Notifications.scheduleNotificationAsync({
            identifier: alert.id,
            content: {
              title: alert.title,
              body: alert.body,
              data: { caseId: caseData.id },
              sound: 'default',
              priority: alert.priority,
            },
            trigger: { date: alert.triggerDate },
          });
        }
      }
      console.log(`Priority alarms registered successfully for Case ID: ${caseData.id}`);
    } catch (error) {
      console.error('Error scheduling priority alarms:', error);
    }
  }
}

/**
 * Cancel priority and regular scheduled alarms for a specific case.
 * @param {string} caseId - The case ID
 */
export async function cancelPriorityAlarms(caseId) {
  if (Platform.OS === 'web') {
    const timeouts = activeWebAlarms.get(caseId);
    if (timeouts) {
      timeouts.forEach(id => clearTimeout(id));
      activeWebAlarms.delete(caseId);
      console.log(`Web scheduled alarms cleared successfully for Case ID: ${caseId}`);
    }
    return;
  }

  try {
    const alertIds = [
      `priority-2day-${caseId}`,
      `priority-1day-${caseId}`,
      `priority-2hour-${caseId}`,
      `regular-1day-${caseId}`,
      `regular-1hour-${caseId}`,
    ];

    for (const id of alertIds) {
      await Notifications.cancelScheduledNotificationAsync(id);
    }
    console.log(`Scheduled alarms cleared successfully for Case ID: ${caseId}`);
  } catch (error) {
    console.error('Error cancelling alarms:', error);
  }
}

/**
 * Schedule standard reminders locally on the device for regular (non-priority) cases.
 * Handles: 1-day reminder and 1-hour final reminder.
 * @param {Object} caseData - The case database object
 */
export async function scheduleRegularAlarms(caseData) {
  if (!caseData.next_hearing_date) return;

  // Cancel any existing alarms first
  await cancelPriorityAlarms(caseData.id);

  if (Platform.OS === 'web') {
    try {
      const hearing = new Date(caseData.next_hearing_date);
      const timeouts = [];

      const alerts = [
        {
          title: '📅 Case Hearing Tomorrow',
          body: `${caseData.case_number} | Client: ${caseData.client_name}\nHearing scheduled on ${hearing.toLocaleDateString()}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, -1, 9),
        },
        {
          title: '⏰ Case Hearing in 1 Hour',
          body: `${caseData.case_number} | Client: ${caseData.client_name}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, 0, 10),
        },
      ];

      for (const alert of alerts) {
        const delay = alert.triggerDate.getTime() - Date.now();
        if (delay > 0) {
          const timeoutId = setTimeout(() => {
            showNotification(alert.title, alert.body);
          }, delay);
          timeouts.push(timeoutId);
        }
      }

      if (timeouts.length > 0) {
        activeWebAlarms.set(caseData.id, timeouts);
      }
      console.log(`Web regular alarms registered successfully for Case ID: ${caseData.id}`);
    } catch (error) {
      console.error('Error scheduling regular alarms on Web:', error);
    }
  } else {
    try {
      const hearing = new Date(caseData.next_hearing_date);
      const today = new Date();

      const alerts = [
        {
          id: `regular-1day-${caseData.id}`,
          title: '📅 Case Hearing Tomorrow',
          body: `${caseData.case_number} | Client: ${caseData.client_name}\nHearing scheduled on ${hearing.toLocaleDateString()}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, -1, 9),
        },
        {
          id: `regular-1hour-${caseData.id}`,
          title: '⏰ Case Hearing in 1 Hour',
          body: `${caseData.case_number} | Client: ${caseData.client_name}`,
          triggerDate: getTriggerDate(caseData.next_hearing_date, 0, 10),
        },
      ];

      for (const alert of alerts) {
        if (alert.triggerDate > today) {
          await Notifications.scheduleNotificationAsync({
            identifier: alert.id,
            content: {
              title: alert.title,
              body: alert.body,
              data: { caseId: caseData.id },
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.DEFAULT,
            },
            trigger: { date: alert.triggerDate },
          });
        }
      }
      console.log(`Regular alarms registered successfully for Case ID: ${caseData.id}`);
    } catch (error) {
      console.error('Error scheduling regular alarms:', error);
    }
  }
}
