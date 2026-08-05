import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { schedulePriorityAlarms, cancelPriorityAlarms, scheduleRegularAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';

export default function CaseDetailScreen({ route, navigation }) {
  const { isDark, colors } = useTheme();
  const { caseId } = route.params;
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal and Action States
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingNote, setClosingNote] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newHearingDate, setNewHearingDate] = useState(new Date());
  const [locationText, setLocationText] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const fetchCaseDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (error) {
        Alert.alert('Error', 'Unable to retrieve case details.');
        navigation.goBack();
      } else {
        setCaseData(data);
        if (data.next_hearing_date) {
          setNewHearingDate(new Date(data.next_hearing_date));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
  }, [caseId]);

  const togglePriority = async () => {
    if (!caseData) return;
    const nextPriority = !caseData.is_priority;
    try {
      const { error } = await supabase
        .from('cases')
        .update({ is_priority: nextPriority })
        .eq('id', caseId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        const updatedCase = { ...caseData, is_priority: nextPriority };
        setCaseData(updatedCase);
        
        if (nextPriority) {
          await schedulePriorityAlarms(updatedCase);
        } else {
          await cancelPriorityAlarms(caseId);
          // Recoil/Reschedule normal alarms
          await scheduleRegularAlarms(updatedCase);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseCase = async () => {
    setCloseLoading(true);
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'Closed',
          closing_note: closingNote.trim() || null,
          closed_at: new Date().toISOString(),
        })
        .eq('id', caseId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        await cancelPriorityAlarms(caseId);
        setShowCloseModal(false);
        setClosingNote('');
        fetchCaseDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCloseLoading(false);
    }
  };

  const handleScheduleHearing = async () => {
    setScheduleLoading(true);
    try {
      const dateFormatted = newHearingDate.toISOString().split('T')[0];
      
      // Store location inside notes or handle location updates
      let updatedNotes = caseData.notes || '';
      if (locationText.trim()) {
        updatedNotes = `${updatedNotes}\n[Courtroom/Location]: ${locationText.trim()}`.trim();
      }

      const { error } = await supabase
        .from('cases')
        .update({
          next_hearing_date: dateFormatted,
          notes: updatedNotes || null,
        })
        .eq('id', caseId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        await cancelPriorityAlarms(caseId);
        
        const updatedCase = {
          ...caseData,
          next_hearing_date: dateFormatted,
          notes: updatedNotes || null,
        };

        if (caseData.is_priority) {
          await schedulePriorityAlarms(updatedCase);
        } else {
          await scheduleRegularAlarms(updatedCase);
        }

        setShowScheduleModal(false);
        setLocationText('');
        fetchCaseDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScheduleLoading(false);
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

  const onDatePickerChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setNewHearingDate(selectedDate);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  const typeColor = getCaseTypeColor(caseData.case_type);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* HEADER BAR */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Case Details</Text>
        <TouchableOpacity onPress={togglePriority} style={{ padding: 4 }}>
          <Ionicons
            name={caseData.is_priority ? 'star' : 'star-outline'}
            size={24}
            color={caseData.is_priority ? colors.priorityGold : colors.textSub}
          />
        </TouchableOpacity>
      </View>

      {/* DYNAMIC PRIORITY BANNER */}
      {caseData.is_priority && (
        <View style={[styles.priorityBanner, { backgroundColor: colors.danger }]}>
          <Text style={styles.priorityBannerText}>⚠️ HIGH PRIORITY CASE</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* CARD WRAPPER */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.caseNumber, { color: colors.text }]}>{caseData.case_number}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColor }]}>
              <Text style={styles.typeText}>{caseData.case_type}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textSub }]}>Client Name</Text>
            <Text style={[styles.value, { color: colors.text }]}>{caseData.client_name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textSub }]}>Date Filed</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {new Date(caseData.date_filed).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textSub }]}>Current Status</Text>
            <View style={styles.badgeRow}>
              <View style={[
                styles.statusBadge,
                caseData.status === 'Closed' ? styles.statusClosed : styles.statusActive
              ]}>
                <Text style={[
                  styles.statusText,
                  caseData.status === 'Closed' ? styles.statusClosedText : styles.statusActiveText
                ]}>
                  {caseData.status}
                </Text>
              </View>
            </View>
          </View>

          {/* NEXT HEARING DATE */}
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.textSub }]}>Next Hearing Date</Text>
            {caseData.next_hearing_date ? (
              <Text style={[styles.valueHighlight, { color: colors.accent }]}>
                {new Date(caseData.next_hearing_date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            ) : (
              <Text style={[styles.valuePlaceholder, { color: colors.textSub }]}>No upcoming hearings scheduled</Text>
            )}
          </View>

          {/* NOTES DISPLAY */}
          <View style={[styles.notesGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textSub }]}>Case Notes</Text>
            <Text style={[styles.notesText, { color: colors.text }]}>{caseData.notes || 'No notes added yet.'}</Text>
          </View>

          {/* CLOSING NOTES DISPLAY (IF CLOSED) */}
          {caseData.status === 'Closed' && (
            <View style={[styles.closingGroup, { backgroundColor: isDark ? '#7f1d1d' : '#fee2e2', borderColor: colors.danger }]}>
              <Text style={[styles.closingLabel, { color: isDark ? '#fca5a5' : '#991b1b' }]}>Closing Note</Text>
              <Text style={[styles.closingText, { color: isDark ? '#fecaca' : '#7f1d1d' }]}>{caseData.closing_note || 'No closing remarks provided.'}</Text>
              <Text style={[styles.closedAtText, { color: isDark ? '#f87171' : '#b91c1c' }]}>
                Closed on:{' '}
                {new Date(caseData.closed_at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
        </View>

        {/* BOTTOM ACTION BUTTONS */}
        {caseData.status === 'Active' && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.scheduleButton, { backgroundColor: colors.accent }]}
              onPress={() => setShowScheduleModal(true)}
            >
              <Ionicons name="calendar" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.scheduleButtonText}>Schedule Hearing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.closeButton, { borderColor: colors.danger, backgroundColor: 'transparent', borderWidth: 1 }]}
              onPress={() => setShowCloseModal(true)}
            >
              <Ionicons name="lock-closed" size={20} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.closeButtonText, { color: colors.danger }]}>Close Case</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* CLOSE CASE MODAL */}
      <Modal visible={showCloseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Close Case</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>
              Are you sure you want to close this case? You must provide a brief closing note.
            </Text>

            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="e.g. Case settled out of court / Verdict reached"
              placeholderTextColor={colors.textSub}
              value={closingNote}
              onChangeText={setClosingNote}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowCloseModal(false)}
                disabled={closeLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmCloseBtn, { backgroundColor: colors.danger }]}
                onPress={handleCloseCase}
                disabled={closeLoading}
              >
                {closeLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmCloseText}>Confirm Close</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SCHEDULE NEXT HEARING MODAL */}
      <Modal visible={showScheduleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Schedule Next Hearing</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>Select the new hearing date and optional location.</Text>

            <TouchableOpacity style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color={colors.textSub} style={{ marginRight: 8 }} />
              <Text style={[styles.dateText, { color: colors.text }]}>{newHearingDate.toLocaleDateString()}</Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={newHearingDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDatePickerChange}
              />
            )}

            <TextInput
              style={[styles.modalInput, { marginTop: 16, color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Courtroom Number / Location (e.g. Court 3B)"
              placeholderTextColor={colors.textSub}
              value={locationText}
              onChangeText={setLocationText}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowScheduleModal(false)}
                disabled={scheduleLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: colors.accent }]}
                onPress={handleScheduleHearing}
                disabled={scheduleLoading}
              >
                {scheduleLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmSaveText}>Schedule</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  priorityBanner: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#b91c1c',
  },
  priorityBannerText: {
    color: '#fee2e2',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  detailsCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingBottom: 16,
    marginBottom: 18,
  },
  caseNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  typeBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  infoRow: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  valueHighlight: {
    fontSize: 15,
    color: '#38bdf8',
    fontWeight: '600',
  },
  valuePlaceholder: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
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
  notesGroup: {
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingTop: 16,
    marginTop: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  closingGroup: {
    borderTopWidth: 1,
    borderColor: '#334155',
    paddingTop: 16,
    marginTop: 16,
  },
  closingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  closingText: {
    fontSize: 14,
    color: '#fca5a5',
    lineHeight: 20,
  },
  closedAtText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  actionContainer: {
    gap: 12,
  },
  scheduleButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#451a03',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#78350f',
  },
  closeButtonText: {
    color: '#fef3c7',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
    textAlignVertical: 'top',
  },
  dateSelector: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateText: {
    fontSize: 15,
    color: '#f8fafc',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
  },
  confirmCloseBtn: {
    backgroundColor: '#7f1d1d',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  confirmCloseText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  confirmSaveBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  confirmSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
