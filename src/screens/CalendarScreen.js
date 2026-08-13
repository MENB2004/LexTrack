import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function CalendarScreen({ navigation }) {
  const { isDark, colors } = useTheme();
  const [markedDates, setMarkedDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const fetchMonthCases = useCallback(async (year, month) => {
    setLoading(true);
    try {
      let currentUserId = supabase.auth.currentUser?.id;
      if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id;
      }
      if (!currentUserId) return;

      // Start & end date of the target month
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate(); // Correct last day of month
      const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('cases')
        .select('id, case_number, client_name, case_type, status, is_priority, next_hearing_date')
        .eq('status', 'Active')
        .gte('next_hearing_date', startOfMonth)
        .lte('next_hearing_date', endOfMonth)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error fetching calendar month cases:', error.message);
        return;
      }

      // Group cases by date
      const grouped = (data || []).reduce((acc, caseItem) => {
        const date = caseItem.next_hearing_date;
        if (!acc[date]) {
          acc[date] = {
            count: 0,
            hasPriority: false,
          };
        }
        acc[date].count += 1;
        if (caseItem.is_priority) {
          acc[date].hasPriority = true;
        }
        return acc;
      }, {});

      // Build markedDates object for react-native-calendars
      const markings = {};
      Object.keys(grouped).forEach((date) => {
        const info = grouped[date];
        const dotColor = '#c084fc'; // Purple dot for active case hearings

        markings[date] = {
          marked: true,
          dots: [{ key: 'hearing', color: dotColor }],
          customStyles: {
            container: {
              borderWidth: info.hasPriority ? 1.5 : 0,
              borderColor: '#ef4444', // Red ring for priority case
              borderRadius: 18,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(2, 132, 199, 0.12)',
            },
            text: {
              fontWeight: '700',
            },
          },
        };
      });

      setMarkedDates(markings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [isDark]);

  // Initial load
  useEffect(() => {
    fetchMonthCases(currentMonth.year, currentMonth.month);

    // Live update subscription
    const channel = supabase
      .channel('calendar-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cases' },
        () => {
          fetchMonthCases(currentMonth.year, currentMonth.month);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMonth, fetchMonthCases]);

  const handleMonthChange = (monthData) => {
    setCurrentMonth({
      year: monthData.year,
      month: monthData.month,
    });
  };

  const handleDayPress = (dayData) => {
    // Navigate to Day Case Dashboard, passing the selected date
    navigation.navigate('DayDashboard', { selectedDate: dayData.dateString });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* CALENDAR BODY */}
      <View style={[styles.calendarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}
        <Calendar
          theme={{
            calendarBackground: colors.surface,
            textSectionTitleColor: colors.accent,
            dayTextColor: colors.text,
            todayTextColor: colors.accent,
            selectedDayBackgroundColor: colors.accent,
            selectedDayTextColor: '#ffffff',
            textDisabledColor: colors.textSub,
            arrowColor: colors.accent,
            monthTextColor: colors.text,
            textMonthFontWeight: 'bold',
            textMonthFontSize: 18,
            dayTextFontSize: 15,
          }}
          markingType={'custom'}
          markedDates={markedDates}
          onDayPress={handleDayPress}
          onMonthChange={handleMonthChange}
          enableSwipeMonths={true}
        />
      </View>

      {/* LEGEND GUIDE */}
      <View style={[styles.legendContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.legendTitle, { color: colors.textSub }]}>Calendar Legend</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendIndicator, { borderWidth: 1.5, borderColor: colors.danger }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>Contains Priority Case</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#c084fc' }]} />
            <Text style={[styles.legendText, { color: colors.text }]}>Active Case Hearings</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerTitle: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '600',
  },
  calendarContainer: {
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  loaderContainer: {
    position: 'absolute',
    top: 18,
    right: 20,
    zIndex: 10,
  },
  legendContainer: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  legendRow: {
    flexDirection: 'column',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
    marginLeft: 3,
  },
  legendText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
});
