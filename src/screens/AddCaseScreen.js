import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  SafeAreaProvider,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import WebDatePicker from '../components/WebDatePicker';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { schedulePriorityAlarms, scheduleRegularAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';
import courtsData from '../utils/courts.json';
import { logActivity } from '../utils/activity';
import { useKeyboardShortcuts } from '../utils/shortcuts';

const CASE_TYPES = ['Civil', 'Criminal', 'Family', 'Corporate'];

export default function AddCaseScreen({ navigation, selectView }) {
  const { isDark, colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const [caseCategory, setCaseCategory] = useState('New'); // 'New' | 'Old'
  const [caseNumber, setCaseNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [caseType, setCaseType] = useState('Civil');
  const [dateFiled, setDateFiled] = useState(new Date());
  const [lastHearingDate, setLastHearingDate] = useState(null);
  const [nextHearingDate, setNextHearingDate] = useState(null);
  const [status, setStatus] = useState('Active');
  const [isPriority, setIsPriority] = useState(false);
  const [notes, setNotes] = useState('');

  // Clients directory states
  const [clientId, setClientId] = useState(null);
  const [clients, setClients] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientAddress, setNewClientAddress] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [newClientLoading, setNewClientLoading] = useState(false);

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

  useKeyboardShortcuts({
    'escape': () => {
      setShowTypeModal(false);
      setShowClientModal(false);
      setShowNewClientForm(false);
    }
  });

  const handleAddNewClient = async () => {
    if (!newClientName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    if (/[^a-zA-Z\s]/.test(newClientName)) {
      Alert.alert('Validation Error', 'Full Name must contain only letters and spaces.');
      return;
    }
    if (newClientPhone && /[^0-9]/.test(newClientPhone)) {
      Alert.alert('Validation Error', 'Phone number must contain only numbers.');
      return;
    }
    if (newClientPhone && newClientPhone.length < 10) {
      Alert.alert('Validation Error', 'Phone number must be exactly 10 digits.');
      return;
    }
    if (newClientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClientEmail.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    setNewClientLoading(true);
    try {
      let user = supabase.auth.currentUser;
      if (!user) {
        const { data: { session } } = await supabase.auth.getSession();
        user = session?.user;
      }
      if (!user) {
        Alert.alert('Authentication Error', 'Please log in again.');
        setNewClientLoading(false);
        return;
      }

      const { data: memberData } = await supabase
        .from('firm_members')
        .select('role, firm_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (memberData?.role === 'paralegal') {
        Alert.alert('Permission Denied', 'Paralegals are not authorized to create client profiles.');
        setNewClientLoading(false);
        return;
      }

      const { data: createdClient, error } = await supabase
        .from('clients')
        .insert({
          user_id: user.id,
          firm_id: memberData?.firm_id || null,
          full_name: newClientName.trim(),
          phone: newClientPhone.trim() || null,
          email: newClientEmail.trim().toLowerCase() || null,
          address: newClientAddress.trim() || null,
          notes: newClientNotes.trim() || null,
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error adding client', error.message);
      } else {
        // Refresh clients list first
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, full_name')
          .order('full_name', { ascending: true });
        if (clientsData) setClients(clientsData);

        // Auto-select the newly created client
        setClientId(createdClient.id);
        setClientName(createdClient.full_name);

        // Reset new client form fields
        setNewClientName('');
        setNewClientPhone('');
        setNewClientEmail('');
        setNewClientAddress('');
        setNewClientNotes('');

        // Close the modal after all state is set
        setShowNewClientForm(false);

        // Show success alert after state updates are queued
        setTimeout(() => {
          Alert.alert('Success', `Client "${createdClient.full_name}" has been created and auto-selected for this case.`);
        }, 100);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setNewClientLoading(false);
    }
  };

  // UI state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showFiledPicker, setShowFiledPicker] = useState(false);
  const [showLastHearingPicker, setShowLastHearingPicker] = useState(false);
  const [showHearingPicker, setShowHearingPicker] = useState(false);

  const onFiledDateChange = (event, selectedDate) => {
    setShowFiledPicker(false);
    if (selectedDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        setErrorMsg('Date Filed cannot be in the future.');
        return;
      }
      setDateFiled(selectedDate);
      setErrorMsg('');
    }
  };

  const onLastHearingDateChange = (event, selectedDate) => {
    setShowLastHearingPicker(false);
    if (selectedDate) {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (selectedDate > today) {
        Alert.alert('Validation Error', 'Last Hearing Date cannot be in the future.');
        return;
      }
      setLastHearingDate(selectedDate);
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
      if (caseCategory === 'Old' && lastHearingDate) {
        const lastH = new Date(lastHearingDate);
        lastH.setHours(0, 0, 0, 0);
        if (selectedDate < lastH) {
          Alert.alert('Validation Error', 'Next Hearing Date must be on or after the Last Hearing Date.');
          return;
        }
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

      // Format dates correctly for database storage (YYYY-MM-DD) using LOCAL time
      const formatLocalDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dateFiledFormatted = formatLocalDate(dateFiled);
      const lastHearingFormatted = (caseCategory === 'Old' && lastHearingDate)
        ? formatLocalDate(lastHearingDate)
        : null;
      const nextHearingFormatted = nextHearingDate 
        ? formatLocalDate(nextHearingDate)
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
          case_category: caseCategory,
          date_filed: dateFiledFormatted,
          last_hearing_date: lastHearingFormatted,
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
        const activityMsg = caseCategory === 'Old'
          ? `Old case registered under ${newCase.case_type} field${lastHearingFormatted ? ` with last hearing on ${lastHearingFormatted}` : ''}${nextHearingFormatted ? ` and next hearing on ${nextHearingFormatted}` : ''}.`
          : `Case registered under ${newCase.case_type} field.`;
        await logActivity(newCase.id, 'created', activityMsg);

        // Notify user of case registration success
        Alert.alert(
          'Case Registered',
          `Case Number ${newCase.case_number} (${caseCategory === 'Old' ? 'Old Case' : 'New Case'}) has been created successfully.`,
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
        setCaseCategory('New');
        setCaseNumber('');
        setClientName('');
        setClientId(null);
        setCaseType('Civil');
        setDateFiled(new Date());
        setLastHearingDate(null);
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
      <ScrollView contentContainerStyle={[styles.scrollContainer, isDesktop && { maxWidth: 800, width: '100%', alignSelf: 'center' }]} keyboardShouldPersistTaps="handled">
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* CASE REGISTRATION TYPE (NEW VS OLD) */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Case Registration Type *</Text>
            <View style={[styles.categoryToggleRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[
                  styles.categoryToggleBtn,
                  caseCategory === 'New' && [styles.categoryToggleBtnActive, { backgroundColor: colors.accent }]
                ]}
                onPress={() => {
                  setCaseCategory('New');
                  setLastHearingDate(null);
                }}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={16}
                  color={caseCategory === 'New' ? '#ffffff' : colors.textSub}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.categoryToggleText,
                    { color: caseCategory === 'New' ? '#ffffff' : colors.textSub }
                  ]}
                >
                  New Case
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.categoryToggleBtn,
                  caseCategory === 'Old' && [styles.categoryToggleBtnActive, { backgroundColor: colors.accent }]
                ]}
                onPress={() => setCaseCategory('Old')}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="folder-open-outline"
                  size={16}
                  color={caseCategory === 'Old' ? '#ffffff' : colors.textSub}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.categoryToggleText,
                    { color: caseCategory === 'Old' ? '#ffffff' : colors.textSub }
                  ]}
                >
                  Old / Ongoing Case
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.helperText, { color: colors.textSub }]}>
              {caseCategory === 'New'
                ? 'Registering a newly filed case (schedule upcoming hearing date).'
                : 'Registering an ongoing/pre-existing case (record last past hearing & next upcoming hearing).'}
            </Text>
          </View>

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

          {/* DATE FILED */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Date Filed</Text>
            {Platform.OS === 'web' ? (
              <WebDatePicker
                value={dateFiled}
                onChange={(selected) => {
                  if (selected) {
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    if (selected > today) {
                      Alert.alert('Validation Error', 'Date Filed cannot be in the future.');
                      return;
                    }
                    setDateFiled(selected);
                  }
                }}
                maximumDate={new Date()}
              />
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

          {/* FOR OLD CASES: LAST HEARING DATE (PAST DATE) */}
          {caseCategory === 'Old' && (
            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Ionicons name="time-outline" size={15} color={colors.textSub} style={{ marginRight: 5 }} />
                <Text style={[styles.label, { color: colors.textSub, marginBottom: 0 }]}>Last Hearing Date (Past Date)</Text>
              </View>
              {Platform.OS === 'web' ? (
                <WebDatePicker
                  value={lastHearingDate}
                  onChange={(selected) => {
                    if (selected) {
                      const today = new Date();
                      today.setHours(23, 59, 59, 999);
                      if (selected > today) {
                        Alert.alert('Validation Error', 'Last Hearing Date cannot be in the future.');
                        return;
                      }
                    }
                    setLastHearingDate(selected);
                  }}
                  maximumDate={new Date()}
                  placeholder="Select last hearing date (past date)..."
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => setShowLastHearingPicker(true)}
                    disabled={loading}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
                    <Text style={[styles.dateText, { color: lastHearingDate ? colors.text : colors.textSub }]}>
                      {lastHearingDate ? lastHearingDate.toLocaleDateString() : 'Select last hearing date (past date)...'}
                    </Text>
                    {lastHearingDate && (
                      <TouchableOpacity
                        onPress={() => setLastHearingDate(null)}
                        style={styles.clearDate}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name="close-circle" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {showLastHearingPicker && (
                    <DateTimePicker
                      value={lastHearingDate || new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      maximumDate={new Date()}
                      onChange={onLastHearingDateChange}
                    />
                  )}
                </>
              )}
            </View>
          )}

          {/* NEXT HEARING DATE (UPCOMING / NEW DATES) */}
          <View style={styles.inputGroup}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="calendar-outline" size={15} color={colors.accent} style={{ marginRight: 5 }} />
              <Text style={[styles.label, { color: colors.textSub, marginBottom: 0 }]}>
                {caseCategory === 'Old' ? 'Next Hearing Date (Upcoming Date)' : 'Next Hearing Date (Optional)'}
              </Text>
            </View>
            {Platform.OS === 'web' ? (
              <WebDatePicker
                value={nextHearingDate}
                onChange={(selected) => {
                  if (selected) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (selected < today) {
                      Alert.alert('Validation Error', 'Next Hearing Date cannot be in the past.');
                      return;
                    }
                    if (caseCategory === 'Old' && lastHearingDate) {
                      const lastH = new Date(lastHearingDate);
                      lastH.setHours(0, 0, 0, 0);
                      if (selected < lastH) {
                        Alert.alert('Validation Error', 'Next Hearing Date must be on or after the Last Hearing Date.');
                        return;
                      }
                    }
                  }
                  setNextHearingDate(selected);
                }}
                minimumDate={new Date()}
                placeholder="Set upcoming hearing date..."
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.dateSelector, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setShowHearingPicker(true)}
                  disabled={loading}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.textSub} style={{ marginRight: 8 }} />
                  <Text style={[styles.dateText, { color: nextHearingDate ? colors.text : colors.textSub }]}>
                    {nextHearingDate ? nextHearingDate.toLocaleDateString() : 'Set upcoming hearing date...'}
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
          <Pressable
            style={({ hovered, pressed }) => [
              styles.saveButton,
              { backgroundColor: colors.accent },
              hovered && {
                transform: [{ translateY: -2 }],
                shadowColor: colors.accent,
                shadowOpacity: 0.2,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 3 },
              },
              pressed && { opacity: 0.8 }
            ]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Register Case</Text>
            )}
          </Pressable>
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
                  <Text style={[styles.modalItemText, { color: colors.text }, caseType === item && styles.modalItemTextActive]}>
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
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowClientModal(false)}
        >
          <View
            style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '70%' }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Client</Text>
              <TouchableOpacity onPress={() => setShowClientModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.background,
                padding: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.border,
                marginHorizontal: 16,
                marginVertical: 10,
              }}
              onPress={() => {
                setShowClientModal(false);
                setShowNewClientForm(true);
              }}
            >
              <Ionicons name="person-add-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
              <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 13 }}>+ Create New Client</Text>
            </TouchableOpacity>
            {clients.length > 0 ? (
              <FlatList
                data={clients}
                keyExtractor={(item) => item.id}
                style={{ flexShrink: 1 }}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}
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
                    <Text style={[styles.modalItemText, { color: colors.text }, clientId === item.id && styles.modalItemTextActive]}>
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
        </Pressable>
      </Modal>

      {/* NEW CLIENT REGISTRATION MODAL */}
      <Modal visible={showNewClientForm} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '80%' }]}>
            <View style={[styles.modalHeader, { borderColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Client Registration</Text>
              <TouchableOpacity onPress={() => setShowNewClientForm(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={true}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Full Name *</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="Enter client's full name"
                  placeholderTextColor={colors.textSub}
                  value={newClientName}
                  onChangeText={(text) => setNewClientName(text.replace(/[^a-zA-Z\s]/g, ''))}
                  editable={!newClientLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Phone Number</Text>
                <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 12, borderRightWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.textSub, fontSize: 14, fontWeight: '600' }}>+91</Text>
                  </View>
                  <TextInput
                    style={{ flex: 1, color: colors.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 }}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor={colors.textSub}
                    value={newClientPhone}
                    onChangeText={(text) => setNewClientPhone(text.replace(/[^0-9]/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={10}
                    editable={!newClientLoading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Email</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="e.g. client@example.com"
                  placeholderTextColor={colors.textSub}
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!newClientLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Office / Home Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="Client's mailing address"
                  placeholderTextColor={colors.textSub}
                  value={newClientAddress}
                  onChangeText={setNewClientAddress}
                  editable={!newClientLoading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="Case backgrounds, referral info, etc."
                  placeholderTextColor={colors.textSub}
                  value={newClientNotes}
                  onChangeText={setNewClientNotes}
                  multiline
                  numberOfLines={3}
                  editable={!newClientLoading}
                />
              </View>

              <Pressable
                style={({ hovered, pressed }) => [
                  styles.saveButton,
                  { backgroundColor: colors.accent, marginTop: 10 },
                  hovered && { transform: [{ translateY: -2 }] },
                  pressed && { opacity: 0.8 }
                ]}
                onPress={handleAddNewClient}
                disabled={newClientLoading}
              >
                {newClientLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveButtonText}>Create & Select Client</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
  categoryToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 4,
  },
  categoryToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  categoryToggleBtnActive: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryToggleText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
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
    transitionProperty: 'all',
    transitionDuration: '200ms',
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
