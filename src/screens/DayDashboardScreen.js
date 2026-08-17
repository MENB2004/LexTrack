import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  useWindowDimensions,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../components/Sidebar';
import { schedulePriorityAlarms, cancelPriorityAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';

export default function DayDashboardScreen({ route, navigation }) {
  const { isDark, colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
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

  const handleExportPDF = () => {
    if (cases.length === 0) {
      Alert.alert('No Cases', 'There are no cases to export for this date.');
      return;
    }

    const formatDate = (dateStr) => {
      if (!dateStr) return '—';
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
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

    const tableRows = cases.map((c, i) => `
      <tr style="${i % 2 === 0 ? 'background-color: #f8fafc;' : 'background-color: #ffffff;'}">
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b; font-size: 13px;">
          ${c.case_number || '—'}${c.is_priority ? ' <span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;margin-left:6px;">★ PRIORITY</span>' : ''}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <span style="background-color:${getCaseTypeColor(c.case_type)};color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;">${c.case_type || '—'}</span>
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 13px;">${formatDate(c.date_filed)}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500; font-size: 13px;">${c.client_name || '—'}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <span style="background-color:${c.status === 'Active' ? '#dcfce7' : '#fee2e2'};color:${c.status === 'Active' ? '#166534' : '#991b1b'};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;">${c.status || '—'}</span>
        </td>
      </tr>
    `).join('');

    const priorityCount = cases.filter(c => c.is_priority).length;
    const activeCount = cases.filter(c => c.status === 'Active').length;
    const closedCount = cases.filter(c => c.status === 'Closed').length;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>LexTrack — Daily Hearings Report — ${displayDate}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #ffffff;
            color: #1e293b;
            padding: 40px;
          }
          @media print {
            body { padding: 20px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div style="border-bottom: 3px solid #0284c7; padding-bottom: 20px; margin-bottom: 28px;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <h1 style="font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">LexTrack</h1>
              <p style="font-size: 13px; color: #64748b; margin-top: 4px;">Case Management System</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Daily Hearings Report</p>
              <p style="font-size: 16px; font-weight: 700; color: #0284c7; margin-top: 4px;">${displayDate}</p>
            </div>
          </div>
        </div>

        <div style="display:flex; gap: 16px; margin-bottom: 28px;">
          <div style="flex:1; background:#f0f9ff; border:1px solid #bae6fd; border-radius:10px; padding:14px 18px;">
            <p style="font-size:11px; color:#0284c7; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Total Cases</p>
            <p style="font-size:28px; font-weight:800; color:#0c4a6e; margin-top:2px;">${cases.length}</p>
          </div>
          <div style="flex:1; background:#fefce8; border:1px solid #fde68a; border-radius:10px; padding:14px 18px;">
            <p style="font-size:11px; color:#a16207; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Priority</p>
            <p style="font-size:28px; font-weight:800; color:#78350f; margin-top:2px;">${priorityCount}</p>
          </div>
          <div style="flex:1; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px 18px;">
            <p style="font-size:11px; color:#16a34a; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Active</p>
            <p style="font-size:28px; font-weight:800; color:#14532d; margin-top:2px;">${activeCount}</p>
          </div>
          <div style="flex:1; background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 18px;">
            <p style="font-size:11px; color:#dc2626; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Closed</p>
            <p style="font-size:28px; font-weight:800; color:#7f1d1d; margin-top:2px;">${closedCount}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
          <thead>
            <tr style="background-color: #0f172a;">
              <th style="padding: 12px 14px; text-align: left; color: #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Case Number</th>
              <th style="padding: 12px 14px; text-align: left; color: #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Case Type</th>
              <th style="padding: 12px 14px; text-align: left; color: #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Date Registered</th>
              <th style="padding: 12px 14px; text-align: left; color: #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Client Name</th>
              <th style="padding: 12px 14px; text-align: left; color: #e2e8f0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">
          <p style="font-size: 11px; color: #94a3b8;">Generated on ${new Date().toLocaleString('en-IN')} — LexTrack</p>
          <p style="font-size: 11px; color: #94a3b8;">Page 1 of 1</p>
        </div>
      </body>
      </html>
    `;

    if (Platform.OS === 'web') {
      // Use a hidden iframe to avoid popup blockers
      const existingFrame = document.getElementById('lextrack-pdf-frame');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'lextrack-pdf-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-10000px';
      iframe.style.left = '-10000px';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(htmlContent);
      iframeDoc.close();

      // Wait for content and fonts to load, then print
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        // Clean up iframe after printing
        setTimeout(() => {
          iframe.remove();
        }, 1000);
      }, 600);
    }
  };

  return (
    <SafeAreaView 
      style={[
        styles.container, 
        { backgroundColor: colors.background },
        Platform.OS === 'web' && { height: '100vh', overflow: 'hidden' }
      ]} 
      edges={['top', 'left', 'right']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {isDesktop && (
          <Sidebar 
            currentView={null} 
            onSelect={(screenName) => navigation.navigate('Main', { screen: screenName })} 
          />
        )}
        
        <View style={{ flex: 1, height: '100%' }}>
          {/* HEADER BAR */}
          <View style={[styles.header, { borderColor: colors.border }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Daily Hearings</Text>
              <Text style={[styles.headerSubtitle, { color: colors.accent }]}>{displayDate}</Text>
            </View>
            {Platform.OS === 'web' && cases.length > 0 && (
              <Pressable
                style={({ hovered, pressed }) => [
                  styles.exportButton,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  hovered && { backgroundColor: colors.accent, borderColor: colors.accent },
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleExportPDF}
              >
                {({ hovered }) => (
                  <>
                    <Ionicons name="download-outline" size={16} color={hovered ? '#ffffff' : colors.accent} style={{ marginRight: 6 }} />
                    <Text style={[styles.exportButtonText, { color: hovered ? '#ffffff' : colors.accent }]}>Export PDF</Text>
                  </>
                )}
              </Pressable>
            )}
            {(Platform.OS !== 'web' || cases.length === 0) && <View style={{ width: 32 }} />}
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
              showsVerticalScrollIndicator={true}
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
        </View>
      </View>
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
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  exportButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
