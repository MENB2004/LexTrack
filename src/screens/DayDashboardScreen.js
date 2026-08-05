import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { schedulePriorityAlarms, cancelPriorityAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';

export default function DayDashboardScreen({ route, navigation }) {
  const { isDark, colors } = useTheme();
  const { selectedDate } = route.params;
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCasesForDay = useCallback(async () => {
    try {
      let currentUserId = supabase.auth.currentUser?.id;
      if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id;
      }
      if (!currentUserId) return;

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('next_hearing_date', selectedDate)
        .eq('user_id', currentUserId)
        .order('is_priority', { ascending: false });

      if (error) {
        console.error('Error fetching day cases:', error.message);
      } else {
        setCases(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchCasesForDay();

    // Live update subscription
    const channel = supabase
      .channel(`day-cases-${selectedDate}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `next_hearing_date=eq.${selectedDate}`,
        },
        () => {
          fetchCasesForDay();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate, fetchCasesForDay]);

  const togglePriority = async (caseId, currentPriority, caseItem) => {
    const nextPriority = !currentPriority;
    try {
      const { error } = await supabase
        .from('cases')
        .update({ is_priority: nextPriority })
        .eq('id', caseId);

      if (error) {
        console.error('Error toggling priority:', error.message);
      } else {
        if (nextPriority) {
          await schedulePriorityAlarms(caseItem);
        } else {
          await cancelPriorityAlarms(caseId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getCaseTypeColor = (type) => {
    switch (type) {
      case 'Civil': return '#0284c7';
      case 'Criminal': return '#b91c1c';
      case 'Family': return '#db2777';
      case 'Corporate': return '#d97706';
      default: return '#475569';
    }
  };

  const getStatusStyle = (status) => {
    if (status === 'Closed') {
      return { container: styles.statusClosed, text: styles.statusClosedText };
    }
    return { container: styles.statusActive, text: styles.statusActiveText };
  };

  const renderCaseItem = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const typeColor = getCaseTypeColor(item.case_type);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          item.is_priority && { borderColor: colors.priorityGold, borderLeftWidth: 4 }
        ]}
        onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.numberRow}>
              <Text style={[styles.caseNumber, { color: colors.text }]}>{item.case_number}</Text>
              {item.is_priority && (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>Priority</Text>
                </View>
              )}
            </View>
            <Text style={[styles.clientName, { color: colors.textSub }]}>{item.client_name}</Text>
          </View>
          <TouchableOpacity
            onPress={() => togglePriority(item.id, item.is_priority, item)}
            style={styles.starButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={item.is_priority ? 'star' : 'star-outline'}
              size={22}
              color={item.is_priority ? colors.priorityGold : colors.textSub}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.cardFooter, { borderColor: colors.border }]}>
          <View style={styles.badgeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
              <Text style={styles.typeText}>{item.case_type}</Text>
            </View>
            <View style={[styles.statusBadge, statusStyle.container]}>
              <Text style={[styles.statusText, statusStyle.text]}>{item.status}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const displayDate = new Date(selectedDate).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* HEADER BAR */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Daily Hearings</Text>
          <Text style={[styles.headerSubtitle, { color: colors.accent }]}>{displayDate}</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {/* CASE LIST */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : cases.length > 0 ? (
        <FlatList
          data={cases}
          keyExtractor={(item) => item.id}
          renderItem={renderCaseItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.textSub} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Hearings Today</Text>
          <Text style={styles.emptySubtitle}>
            There are no court hearings scheduled for this date.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#38bdf8',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardPriority: {
    borderColor: '#fbbf24',
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caseNumber: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  priorityBadge: {
    backgroundColor: '#7f1d1d',
    borderColor: '#b91c1c',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priorityBadgeText: {
    color: '#fca5a5',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  clientName: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  starButton: {
    padding: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#1e293b',
    paddingTop: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusActive: {
    backgroundColor: '#064e3b',
  },
  statusActiveText: {
    color: '#34d399',
  },
  statusClosed: {
    backgroundColor: '#7f1d1d',
  },
  statusClosedText: {
    color: '#f87171',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
});
