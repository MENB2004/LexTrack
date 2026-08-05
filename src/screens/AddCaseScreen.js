import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { schedulePriorityAlarms, scheduleRegularAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';

const CASE_TYPES = ['Civil', 'Criminal', 'Family', 'Corporate'];

export default function AddCaseScreen({ navigation }) {
  const { isDark, colors } = useTheme();
  const [caseNumber, setCaseNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [caseType, setCaseType] = useState('Civil');
  const [dateFiled, setDateFiled] = useState(new Date());
  const [nextHearingDate, setNextHearingDate] = useState(null);
  const [status, setStatus] = useState('Active');
  const [isPriority, setIsPriority] = useState(false);
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showFiledPicker, setShowFiledPicker] = useState(false);
  const [showHearingPicker, setShowHearingPicker] = useState(false);

  const onFiledDateChange = (event, selectedDate) => {
    setShowFiledPicker(false);
    if (selectedDate) {
      if (selectedDate > new Date()) {
        setErrorMsg('Date Filed cannot be in the future.');
        return;
      }
      setDateFiled(selectedDate);
      setErrorMsg('');
    }
  };

  const onHearingDateChange = (event, selectedDate) => {
    setShowHearingPicker(false);
    if (selectedDate) {
      setNextHearingDate(selectedDate);
    }
  };

  const handleSave = async () => {
    if (!caseNumber.trim() || !clientName.trim() || !caseType) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      let user = supabase.auth.currentUser;
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user;
      }
      if (!user) {
        setErrorMsg('Authentication error. Please log in again.');
        setLoading(false);
        return;
      }

      // Check for case number uniqueness
      const { data: existingCases, error: checkError } = await supabase
        .from('cases')
        .select('case_number')
        .eq('case_number', caseNumber.trim())
        .limit(1);

      if (checkError) throw checkError;
      if (existingCases && existingCases.length > 0) {
        setErrorMsg('A case with this Case Number already exists.');
        setLoading(false);
        return;
      }

      // Format dates correctly for database storage (YYYY-MM-DD)
      const dateFiledFormatted = dateFiled.toISOString().split('T')[0];
      const nextHearingFormatted = nextHearingDate 
        ? nextHearingDate.toISOString().split('T')[0]
        : null;

      const { data: newCase, error } = await supabase
        .from('cases')
        .insert({
          user_id: user.id,
          case_number: caseNumber.trim(),
          client_name: clientName.trim(),
          case_type: caseType,
          date_filed: dateFiledFormatted,
          next_hearing_date: nextHearingFormatted,
          status: status,
          is_priority: isPriority,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else {
        // Schedule local alarms
        if (newCase) {
          if (newCase.is_priority) {
            await schedulePriorityAlarms(newCase);
          } else {
            await scheduleRegularAlarms(newCase);
          }
        }

        // Reset form fields
        setCaseNumber('');
        setClientName('');
        setCaseType('Civil');
        setDateFiled(new Date());
        setNextHearingDate(null);
        setStatus('Active');
        setIsPriority(false);
        setNotes('');
        
        // Go back to dashboard tab
        navigation.navigate('Dashboard');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* CASE NUMBER */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Case Number *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="e.g. CR-2026-8942"
              placeholderTextColor={colors.textSub}
              value={caseNumber}
              onChangeText={setCaseNumber}
              editable={!loading}
            />
          </View>

          {/* CLIENT NAME */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Client Full Name *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="e.g. Harvey Specter"
              placeholderTextColor={colors.textSub}
              value={clientName}
              onChangeText={clientName => setClientName(clientName)}
              editable={!loading}
            />
          </View>

          {/* CASE TYPE */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Case Type *</Text>
            <TouchableOpacity
              style={[styles.pickerTrigger, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowTypeModal(true)}
              disabled={loading}
            >
              <Text style={[styles.pickerTriggerText, { color: colors.text }]}>{caseType}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          {/* DATE FILED */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Date Filed *</Text>
            <TouchableOpacity
              style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowFiledPicker(true)}
              disabled={loading}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
              <Text style={[styles.dateText, { color: colors.text }]}>{dateFiled.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showFiledPicker && (
              <DateTimePicker
                value={dateFiled}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()}
                onChange={onFiledDateChange}
              />
            )}
          </View>

          {/* NEXT HEARING DATE */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Next Hearing Date (Optional)</Text>
            <TouchableOpacity
              style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowHearingPicker(true)}
              disabled={loading}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
              <Text style={[styles.dateText, { color: nextHearingDate ? colors.text : colors.textSub }]}>
                {nextHearingDate ? nextHearingDate.toLocaleDateString() : 'Set hearing date...'}
              </Text>
              {nextHearingDate && (
                <TouchableOpacity
                  onPress={() => setNextHearingDate(null)}
                  style={styles.clearDate}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            {showHearingPicker && (
              <DateTimePicker
                value={nextHearingDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onHearingDateChange}
              />
            )}
          </View>

          {/* STATUS */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Status</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  status === 'Active' && [styles.toggleBtnActive, { backgroundColor: colors.success, borderColor: colors.success }]
                ]}
                onPress={() => setStatus('Active')}
                disabled={loading}
              >
                <Text style={[styles.toggleText, { color: colors.textSub }, status === 'Active' && styles.toggleTextActive]}>Active</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  { backgroundColor: colors.background, borderColor: colors.border },
                  status === 'Closed' && [styles.toggleBtnActiveClosed, { backgroundColor: colors.danger, borderColor: colors.danger }]
                ]}
                onPress={() => setStatus('Closed')}
                disabled={loading}
              >
                <Text style={[styles.toggleText, { color: colors.textSub }, status === 'Closed' && styles.toggleTextActive]}>Closed</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PRIORITY TOGGLE */}
          <View style={styles.priorityRow}>
            <View>
              <Text style={[styles.priorityLabel, { color: colors.text }]}>Mark as High Priority</Text>
              <Text style={[styles.prioritySub, { color: colors.textSub }]}>Flag this case with a priority star indicator</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsPriority(!isPriority)}
              disabled={loading}
              style={styles.starToggle}
            >
              <Ionicons
                name={isPriority ? 'star' : 'star-outline'}
                size={28}
                color={isPriority ? colors.priorityGold : colors.textSub}
              />
            </TouchableOpacity>
          </View>

          {/* NOTES */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
              placeholder="Enter additional remarks or case details..."
              placeholderTextColor={colors.textSub}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              editable={!loading}
            />
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Register Case</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CASE TYPE PICKER MODAL (Custom Dark Themed Dropdown) */}
      <Modal visible={showTypeModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypeModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Case Type</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={CASE_TYPES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    { borderColor: colors.border },
                    caseType === item && [styles.modalItemActive, { backgroundColor: colors.background }]
                  ]}
                  onPress={() => {
                    setCaseType(item);
                    setShowTypeModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, caseType === item && styles.modalItemTextActive]}>
                    {item}
                  </Text>
                  {caseType === item && <Ionicons name="checkmark" size={20} color="#38bdf8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: '#7f1d1d',
    borderColor: '#b91c1c',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#fee2e2',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#f8fafc',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerTrigger: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  pickerTriggerText: {
    fontSize: 15,
    color: '#f8fafc',
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
    flex: 1,
  },
  clearDate: {
    padding: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#0284c7',
  },
  toggleBtnActiveClosed: {
    backgroundColor: '#b91c1c',
  },
  toggleText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 18,
  },
  priorityLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  prioritySub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  starToggle: {
    padding: 4,
  },
  textArea: {
    textAlignVertical: 'top',
    height: 100,
  },
  saveButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  modalItemActive: {
    backgroundColor: '#0f172a',
  },
  modalItemText: {
    fontSize: 16,
    color: '#cbd5e1',
  },
  modalItemTextActive: {
    color: '#38bdf8',
    fontWeight: 'bold',
  },
});
