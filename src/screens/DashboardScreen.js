import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { schedulePriorityAlarms, cancelPriorityAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';

export default function DashboardScreen({ navigation, selectView }) {
  const { isDark, colors } = useTheme();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState(false);
  const [userId, setUserId] = useState(null);

  const fetchCases = useCallback(async (currentUserId) => {
    if (!currentUserId) return;
    try {
      let query = supabase
        .from('cases')
        .select('*')
        .eq('user_id', currentUserId);

      // Sort by priority (descending) first, then next hearing date (ascending)
      query = query
        .order('is_priority', { ascending: false })
        .order('next_hearing_date', { ascending: true, nullsFirst: false });

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching cases:', error.message);
      } else {
        setCases(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching cases:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let channel = null;

    const initDashboard = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!active) return;

        const currentUserId = session?.user?.id || supabase.auth.currentUser?.id;
        if (currentUserId) {
          setUserId(currentUserId);
          fetchCases(currentUserId);

          channel = supabase
            .channel(`dashboard-cases-${currentUserId}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'cases',
                filter: `user_id=eq.${currentUserId}`,
              },
              () => {
                if (active) fetchCases(currentUserId);
              }
            )
            .subscribe();
        }
      } catch (err) {
        console.error('Error initializing dashboard auth:', err);
      }
    };

    initDashboard();

    return () => {
      active = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchCases]);

  // Toggle priority directly from dashboard card (premium micro-interaction)
  const togglePriority = async (caseId, currentPriority, caseItem) => {
    const nextPriority = !currentPriority;
    try {
      const { error } = await supabase
        .from('cases')
        .update({ is_priority: nextPriority })
        .eq('id', caseId);

      if (error) {
        console.error('Error updating priority:', error.message);
      } else {
        if (nextPriority) {
          await schedulePriorityAlarms(caseItem);
        } else {
          await cancelPriorityAlarms(caseId);
        }
      }
    } catch (err) {
      console.error('Unexpected error toggling priority:', err);
    }
  };

  // Filter and search logic
  const filteredCases = cases.filter((item) => {
    const matchesSearch =
      item.case_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPriority = !priorityFilter || item.is_priority;
    return matchesSearch && matchesPriority;
  });

  const getStatusStyle = (status) => {
    if (status === 'Closed') {
      return { container: styles.statusClosed, text: styles.statusClosedText };
    }
    return { container: styles.statusActive, text: styles.statusActiveText };
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

  const renderCaseItem = ({ item }) => {
    const statusStyle = getStatusStyle(item.status);
    const typeColor = getCaseTypeColor(item.case_type);

    return (
      <Pressable
        style={({ hovered, pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          item.is_priority && { borderColor: colors.priorityGold, borderLeftWidth: 4 },
          hovered && { backgroundColor: isDark ? '#2e3b50' : '#f1f5f9', transform: [{ scale: 1.01 }] },
          pressed && { opacity: 0.9 }
        ]}
        onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Text style={[styles.caseNumber, { color: colors.text }]}>{item.case_number}</Text>
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

          {item.next_hearing_date ? (
            <View style={styles.hearingContainer}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSub} style={{ marginRight: 4 }} />
              <Text style={[styles.hearingText, { color: colors.textSub }]}>
                {new Date(item.next_hearing_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          ) : (
            <Text style={[styles.noHearingText, { color: colors.textSub }]}>No hearing scheduled</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* SEARCH & FILTER ROW */}
      <View style={styles.searchFilterRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSub} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search cases..."
            placeholderTextColor={colors.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          onPress={() => setPriorityFilter(!priorityFilter)}
          style={[
            styles.filterButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            priorityFilter && { borderColor: colors.priorityGold, backgroundColor: isDark ? '#1e1b4b' : '#fef3c7' }
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name={priorityFilter ? 'star' : 'star-outline'}
            size={22}
            color={priorityFilter ? colors.priorityGold : colors.textSub}
          />
        </TouchableOpacity>
      </View>

      {/* LIST SECTION */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : filteredCases.length > 0 ? (
        <FlatList
          data={filteredCases}
          keyExtractor={(item) => item.id}
          renderItem={renderCaseItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={() => fetchCases(userId)}
          refreshing={loading}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={64} color="#334155" />
          <Text style={styles.emptyTitle}>No Cases Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || priorityFilter
              ? 'Try adjusting your search query or priority filters.'
              : 'Tap "Register New Case" inside menu to add your first case.'}
          </Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => selectView ? selectView('AddCase') : selectView ? selectView('AddCase') : navigation.navigate('Add Case')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    paddingVertical: 10,
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  caseNumber: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
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
  hearingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hearingText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  noHearingText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
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
