import React, { useState, useEffect } from 'react';
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
  Alert,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { schedulePriorityAlarms, scheduleRegularAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';
import courtsData from '../utils/courts.json';
import { logActivity } from '../utils/activity';

const CASE_TYPES = ['Civil', 'Criminal', 'Family', 'Corporate'];

export default function AddCaseScreen({ navigation, selectView }) {
  const { isDark, colors } = useTheme();
  const [caseNumber, setCaseNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [caseType, setCaseType] = useState('Civil');
  const [dateFiled, setDateFiled] = useState(new Date());
  const [nextHearingDate, setNextHearingDate] = useState(null);
  const [status, setStatus] = useState('Active');
  const [isPriority, setIsPriority] = useState(false);
  const [notes, setNotes] = useState('');

  // Clients directory states
  const [clientId, setClientId] = useState(null);
  const [clients, setClients] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);

  // Court directory states
  const [courtName, setCourtName] = useState('');
  const [courtroom, setCourtroom] = useState('');
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [showCourtroomModal, setShowCourtroomModal] = useState(false);
  // User role check state - always owner/full access
  const isParalegal = false;

  useEffect(() => {
    let active = true;
    const fetchRoleAndClients = async () => {
      try {
        // Fetch clients list
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, full_name')
          .order('full_name', { ascending: true });

        if (clientsData && active) {
          setClients(clientsData);
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    // Add navigation listener to refresh client list when screen comes into focus
    const unsubscribe = navigation.addListener('focus', () => {
      fetchRoleAndClients();
    });

    fetchRoleAndClients();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigation]);

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
      const today = new Date();
      today.setHours(0,0,0,0);
      if (selectedDate < today) {
        Alert.alert('Validation Error', 'Next Hearing Date cannot be in the past.');
        return;
      }
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

      const firmId = null;

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
          firm_id: firmId,
          case_number: caseNumber.trim(),
          client_name: clientName.trim(),
          client_id: clientId,
          case_type: caseType,
          date_filed: dateFiledFormatted,
          next_hearing_date: nextHearingFormatted,
          status: status,
          is_priority: isPriority,
          notes: notes.trim() || null,
          court_name: courtName || null,
          courtroom: courtroom || null,
        })
        .select()
        .single();

      if (error) {
        setErrorMsg(error.message);
      } else {
        // Log Activity
        await logActivity(newCase.id, 'created', `Case registered under ${newCase.case_type} field.`);

        // Notify user of case registration success
        Alert.alert(
          'Case Registered',
          `Case Number ${newCase.case_number} has been created successfully.`,
          [{ text: 'OK' }]
        );

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
        setClientId(null);
        setCaseType('Civil');
        setDateFiled(new Date());
        setNextHearingDate(null);
        setStatus('Active');
        setIsPriority(false);
        setNotes('');
        setCourtName('');
        setCourtroom('');
        
        // Go back to dashboard tab
        if (selectView) {
          selectView('Dashboard');
        } else {
          navigation.navigate('Dashboard');
        }
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isParalegal) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <Ionicons name="lock-closed" size={64} color={colors.danger} />
        <Text style={[styles.title, { color: colors.text, marginTop: 16, textAlign: 'center', fontSize: 22, fontWeight: 'bold' }]}>Permission Denied</Text>
        <Text style={{ color: colors.textSub, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
          Your user profile has a 'Paralegal' role. Paralegals are not authorized to register new cases in this firm.
        </Text>
      </View>
    );
  }

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
            <Text style={[styles.label, { color: colors.textSub }]}>Client *</Text>
            <TouchableOpacity
              style={[styles.pickerTrigger, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowClientModal(true)}
              disabled={loading}
            >
              <Text style={[styles.pickerTriggerText, { color: clientName ? colors.text : colors.textSub }]}>
                {clientName || 'Select Client from Directory...'}
              </Text>
              <Ionicons name="people" size={18} color={colors.textSub} />
            </TouchableOpacity>
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

          {/* COURT SELECTION */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Court *</Text>
            <TouchableOpacity
              style={[styles.pickerTrigger, { backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowCourtModal(true)}
              disabled={loading}
            >
              <Text style={[styles.pickerTriggerText, { color: courtName ? colors.text : colors.textSub }]}>
                {courtName || 'Select Court from Directory...'}
              </Text>
              <Ionicons name="business" size={18} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          {/* COURTROOM SELECTION */}
          {courtName ? (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Courtroom / Hall *</Text>
              <TouchableOpacity
                style={[styles.pickerTrigger, { backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowCourtroomModal(true)}
                disabled={loading}
              >
                <Text style={[styles.pickerTriggerText, { color: courtroom ? colors.text : colors.textSub }]}>
                  {courtroom || 'Select Courtroom...'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSub} />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* DATE FILED */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Date Filed *</Text>
            {Platform.OS === 'web' ? (
              <View style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
                <input
                  type="date"
                  value={dateFiled.toISOString().split('T')[0]}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    const selected = new Date(e.target.value + 'T00:00:00');
                    if (!isNaN(selected.getTime())) {
                      if (selected > new Date()) {
                        setErrorMsg('Date Filed cannot be in the future.');
                        return;
                      }
                      setDateFiled(selected);
                      setErrorMsg('');
                    }
                  }}
                  disabled={loading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    fontSize: 15,
                    flex: 1,
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                />
              </View>
            ) : (
              <>
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
              </>
            )}
          </View>

          {/* NEXT HEARING DATE */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Next Hearing Date (Optional)</Text>
            {Platform.OS === 'web' ? (
              <View style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
                <input
                  type="date"
                  value={nextHearingDate ? nextHearingDate.toISOString().split('T')[0] : ''}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    if (e.target.value) {
                      const selected = new Date(e.target.value + 'T00:00:00');
                      if (!isNaN(selected.getTime())) {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        if (selected < today) {
                          Alert.alert('Validation Error', 'Next Hearing Date cannot be in the past.');
                          return;
                        }
                        setNextHearingDate(selected);
                      }
                    } else {
                      setNextHearingDate(null);
                    }
                  }}
                  disabled={loading}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: nextHearingDate ? (isDark ? '#f8fafc' : '#0f172a') : (isDark ? '#64748b' : '#94a3b8'),
                    fontSize: 15,
                    flex: 1,
                    outline: 'none',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                />
                {nextHearingDate && (
                  <TouchableOpacity
                    onPress={() => setNextHearingDate(null)}
                    style={styles.clearDate}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
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
                    minimumDate={new Date()}
                  />
                )}
              </>
            )}
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

      {/* CLIENT PICKER MODAL */}
      <Modal visible={showClientModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowClientModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Client</Text>
              <TouchableOpacity onPress={() => setShowClientModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {clients.length > 0 ? (
              <FlatList
                data={clients}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      { borderColor: colors.border },
                      clientId === item.id && [styles.modalItemActive, { backgroundColor: colors.background }]
                    ]}
                    onPress={() => {
                      setClientId(item.id);
                      setClientName(item.full_name);
                      setShowClientModal(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, clientId === item.id && styles.modalItemTextActive]}>
                      {item.full_name}
                    </Text>
                    {clientId === item.id && <Ionicons name="checkmark" size={20} color="#38bdf8" />}
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <Text style={{ color: colors.textSub, textAlign: 'center', marginBottom: 16 }}>
                  No clients in your directory yet.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
                  onPress={() => {
                    setShowClientModal(false);
                    if (selectView) selectView('Clients');
                  }}
                >
                  <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Go to Client Directory</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* COURT PICKER MODAL */}
      <Modal visible={showCourtModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCourtModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Court</Text>
              <TouchableOpacity onPress={() => setShowCourtModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={courtsData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    { borderColor: colors.border },
                    courtName === item.name && [styles.modalItemActive, { backgroundColor: colors.background }]
                  ]}
                  onPress={() => {
                    setCourtName(item.name);
                    setCourtroom('');
                    setShowCourtModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, courtName === item.name && styles.modalItemTextActive, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 2 }}>{item.address}</Text>
                  </View>
                  {courtName === item.name && <Ionicons name="checkmark" size={20} color="#38bdf8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* COURTROOM PICKER MODAL */}
      <Modal visible={showCourtroomModal} transparent animationType="slide">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCourtroomModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Courtroom</Text>
              <TouchableOpacity onPress={() => setShowCourtroomModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={courtsData.find(c => c.name === courtName)?.courtrooms || []}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    { borderColor: colors.border },
                    courtroom === item && [styles.modalItemActive, { backgroundColor: colors.background }]
                  ]}
                  onPress={() => {
                    setCourtroom(item);
                    setShowCourtroomModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, courtroom === item && styles.modalItemTextActive, { color: colors.text }]}>
                    {item}
                  </Text>
                  {courtroom === item && <Ionicons name="checkmark" size={20} color="#38bdf8" />}
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
    minHeight: 110,
    paddingTop: 12,
    paddingBottom: 12,
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
