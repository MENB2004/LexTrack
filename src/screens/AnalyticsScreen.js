import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  FlatList,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen() {
  const { isDark, colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    ongoing: 0,
    completed: 0,
    upcoming: 0,
    priority: 0,
  });
  const [chartData, setChartData] = useState({
    pie: [],
    bar: { labels: [], datasets: [{ data: [] }] },
  });
  const [upcomingHearings, setUpcomingHearings] = useState([]);

  const fetchAnalytics = useCallback(async () => {
    try {
      let currentUserId = supabase.auth.currentUser?.id;
      if (!currentUserId) {
        const { data: { session } } = await supabase.auth.getSession();
        currentUserId = session?.user?.id;
      }
      if (!currentUserId) return;

      const todayStr = new Date().toISOString().split('T')[0];

      // Fetch user's firm membership
      const { data: memberData } = await supabase
        .from('firm_members')
        .select('firm_id')
        .eq('user_id', currentUserId)
        .maybeSingle();

      const firmId = memberData?.firm_id;

      // 1. Fetch all cases for the stats calculations
      let statsQuery = supabase
        .from('cases')
        .select('status, is_priority, next_hearing_date, date_filed');

      if (firmId) {
        statsQuery = statsQuery.or(`user_id.eq.${currentUserId},firm_id.eq.${firmId}`);
      } else {
        statsQuery = statsQuery.eq('user_id', currentUserId);
      }

      const { data: allCases, error: statsError } = await statsQuery;
      if (statsError) throw statsError;

      const casesList = allCases || [];

      const ongoing = casesList.filter((c) => c.status === 'Active').length;
      const completed = casesList.filter((c) => c.status === 'Closed').length;
      const priority = casesList.filter((c) => c.is_priority && c.status === 'Active').length;
      const upcoming = casesList.filter(
        (c) => c.status === 'Active' && c.next_hearing_date && c.next_hearing_date >= todayStr
      ).length;

      setStats({ ongoing, completed, upcoming, priority });

      // 2. Fetch top 5 upcoming hearings for the list
      let hearingsQuery = supabase
        .from('cases')
        .select('id, case_number, client_name, next_hearing_date, is_priority')
        .eq('status', 'Active')
        .gte('next_hearing_date', todayStr)
        .order('next_hearing_date', { ascending: true })
        .limit(5);

      if (firmId) {
        hearingsQuery = hearingsQuery.or(`user_id.eq.${currentUserId},firm_id.eq.${firmId}`);
      } else {
        hearingsQuery = hearingsQuery.eq('user_id', currentUserId);
      }

      const { data: nextHearings, error: listError } = await hearingsQuery;

      if (listError) throw listError;
      setUpcomingHearings(nextHearings || []);

      // 3. Format Pie Chart Data (Active vs Closed split)
      const pieData = [
        {
          name: 'Active',
          population: ongoing,
          color: '#34d399',
          legendFontColor: colors.textSub,
          legendFontSize: 13,
        },
        {
          name: 'Closed',
          population: completed,
          color: '#f87171',
          legendFontColor: colors.textSub,
          legendFontSize: 13,
        },
      ];
      setChartData((prev) => ({ ...prev, pie: pieData }));

      // 4. Format Bar Chart Data (Cases filed per month for last 6 months)
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const last6Months = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        last6Months.push({
          label: monthNames[d.getMonth()],
          year: d.getFullYear(),
          month: d.getMonth(),
          count: 0,
        });
      }

      // Group cases by month filed
      casesList.forEach((c) => {
        if (!c.date_filed) return;
        const filedDate = new Date(c.date_filed);
        const filedYear = filedDate.getFullYear();
        const filedMonth = filedDate.getMonth();

        const match = last6Months.find((m) => m.year === filedYear && m.month === filedMonth);
        if (match) {
          match.count += 1;
        }
      });

      const barData = {
        labels: last6Months.map((m) => m.label),
        datasets: [
          {
            data: last6Months.map((m) => m.count),
          },
        ],
      };
      setChartData((prev) => ({ ...prev, bar: barData }));
    } catch (err) {
      console.error('Error fetching analytics dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [colors.textSub]);

  useFocusEffect(
    useCallback(() => {
      fetchAnalytics();
    }, [fetchAnalytics])
  );

  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => colors.accent,
    labelColor: (opacity = 1) => colors.textSub,
    strokeWidth: 2,
    barPercentage: 0.6,
    decimalPlaces: 0,
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: '#34d399' }]}>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Active</Text>
            <Text style={[styles.statValue, { color: '#34d399' }]}>{stats.ongoing}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: '#ef4444' }]}>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Closed</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{stats.completed}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.priorityGold }]}>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Priority</Text>
            <Text style={[styles.statValue, { color: colors.priorityGold }]}>{stats.priority}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.accent }]}>
            <Text style={[styles.statLabel, { color: colors.textSub }]}>Upcoming</Text>
            <Text style={[styles.statValue, { color: colors.accent }]}>{stats.upcoming}</Text>
          </View>
        </View>

        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>Case Resolution Split</Text>
          {stats.ongoing === 0 && stats.completed === 0 ? (
            <Text style={[styles.noDataText, { color: colors.textSub }]}>No case data available for chart.</Text>
          ) : (
            <PieChart
              data={chartData.pie}
              width={screenWidth - 72}
              height={180}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          )}
        </View>

        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>Cases Filed by Month</Text>
          {chartData.bar.labels.length === 0 ? (
            <Text style={[styles.noDataText, { color: colors.textSub }]}>No filing timeline data available.</Text>
          ) : (
            <BarChart
              data={chartData.bar}
              width={screenWidth - 72}
              height={220}
              chartConfig={{
                ...chartConfig,
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                color: (opacity = 1) => colors.accent,
              }}
              style={{
                marginVertical: 8,
                borderRadius: 8,
              }}
              showBarTops={false}
              fromZero
            />
          )}
        </View>

        <View style={[styles.upcomingSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming Hearings (Next 5)</Text>
          {upcomingHearings.length > 0 ? (
            upcomingHearings.map((item) => (
              <View key={item.id} style={[styles.listItem, { borderColor: colors.border }]}>
                <View style={styles.itemLeft}>
                  <View style={styles.numberRow}>
                    <Text style={[styles.itemNumber, { color: colors.text }]}>{item.case_number}</Text>
                    {item.is_priority && (
                      <Ionicons name="star" size={14} color={colors.priorityGold} style={{ marginLeft: 4 }} />
                    )}
                  </View>
                  <Text style={[styles.itemClient, { color: colors.textSub }]}>{item.client_name}</Text>
                </View>
                <Text style={[styles.itemDate, { color: colors.accent }]}>
                  {new Date(item.next_hearing_date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.noDataText, { color: colors.textSub }]}>No upcoming hearings scheduled.</Text>
          )}
        </View>
      </ScrollView>
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
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (screenWidth - 52) / 2,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    borderLeftWidth: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 6,
  },
  chartCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  noDataText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  upcomingSection: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#0f172a',
  },
  itemLeft: {
    flex: 1,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#cbd5e1',
  },
  itemClient: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  itemDate: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '600',
  },
});
