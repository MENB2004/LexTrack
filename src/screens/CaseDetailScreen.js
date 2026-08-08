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
  Linking,
  FlatList,
  useWindowDimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import WebDatePicker from '../components/WebDatePicker';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../components/Sidebar';
import { useKeyboardShortcuts } from '../utils/shortcuts';
import { schedulePriorityAlarms, cancelPriorityAlarms, scheduleRegularAlarms } from '../utils/alarms';
import { useTheme } from '../context/ThemeContext';
import { logActivity } from '../utils/activity';
import courtsData from '../utils/courts.json';

export default function CaseDetailScreen({ route, navigation }) {
  const { isDark, colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;

  useKeyboardShortcuts({
    'escape': () => {
      setShowCloseModal(false);
      setShowScheduleModal(false);
      setShowEditNotesModal(false);
    }
  });

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

  // Edit Notes States
  const [showEditNotesModal, setShowEditNotesModal] = useState(false);
  const [editNotesText, setEditNotesText] = useState('');
  const [editNotesLoading, setEditNotesLoading] = useState(false);

  // Timeline / Activity states
  const [activities, setActivities] = useState([]);

  // Court Registry selection states
  const [selectedCourtName, setSelectedCourtName] = useState('');
  const [selectedCourtroom, setSelectedCourtroom] = useState('');
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [showCourtroomModal, setShowCourtroomModal] = useState(false);

  // User permission role state - always owner/full access
  const userRole = 'owner';

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
        if (data.court_name) {
          setSelectedCourtName(data.court_name);
        }
        if (data.courtroom) {
          setSelectedCourtroom(data.courtroom);
        }



        // Fetch activities log
        const { data: actData } = await supabase
          .from('case_activities')
          .select('*')
          .eq('case_id', caseId)
          .order('created_at', { ascending: false });
        if (actData) {
          setActivities(actData);
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

        // Log Activity
        await logActivity(caseId, nextPriority ? 'priority_on' : 'priority_off', nextPriority ? 'Case flagged as High Priority.' : 'Case priority star removed.');
        
        if (nextPriority) {
          await schedulePriorityAlarms(updatedCase);
        } else {
          await cancelPriorityAlarms(caseId);
          // Recoil/Reschedule normal alarms
          await scheduleRegularAlarms(updatedCase);
        }
        fetchCaseDetails();
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
        // Log Activity
        await logActivity(caseId, 'closed', `Case marked as Closed. Remark: ${closingNote.trim() || 'None'}`);

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

  const handleDeleteCase = async () => {
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm('Are you sure you want to permanently delete this case record? This action cannot be undone.');
      if (confirmDelete) {
        try {
          const { error } = await supabase
            .from('cases')
            .delete()
            .eq('id', caseId);

          if (error) {
            alert('Error: ' + error.message);
          } else {
            await cancelPriorityAlarms(caseId);
            alert('The case has been permanently deleted.');
            navigation.goBack();
          }
        } catch (err) {
          console.error(err);
          alert('An unexpected error occurred during deletion.');
        }
      }
      return;
    }

    Alert.alert(
      'Delete Case',
      'Are you sure you want to permanently delete this case record? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cases')
                .delete()
                .eq('id', caseId);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                // Cancel priority alarms
                await cancelPriorityAlarms(caseId);

                // Show success notification
                Alert.alert(
                  'Case Deleted',
                  'The case has been permanently deleted.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        navigation.goBack();
                      },
                    },
                  ]
                );
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'An unexpected error occurred during deletion.');
            }
          },
        },
      ]
    );
  };

  const handleScheduleHearing = async () => {
    if (!selectedCourtName) {
      Alert.alert('Validation Error', 'Please select a Court from the directory.');
      return;
    }
    setScheduleLoading(true);
    try {
      const dateFormatted = newHearingDate.toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('cases')
        .update({
          next_hearing_date: dateFormatted,
          court_name: selectedCourtName,
          courtroom: selectedCourtroom || null,
        })
        .eq('id', caseId);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        // Log Activity
        await logActivity(caseId, 'hearing_scheduled', `Hearing scheduled on ${dateFormatted} at ${selectedCourtName} - ${selectedCourtroom || 'Main Hall'}.`);

        await cancelPriorityAlarms(caseId);
        
        const updatedCase = {
          ...caseData,
          next_hearing_date: dateFormatted,
          court_name: selectedCourtName,
          courtroom: selectedCourtroom || null,
        };

        if (caseData.is_priority) {
          await schedulePriorityAlarms(updatedCase);
        } else {
          await scheduleRegularAlarms(updatedCase);
        }

        setShowScheduleModal(false);
        fetchCaseDetails();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (editNotesLoading) return;
    setEditNotesLoading(true);
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          notes: editNotesText.trim() || null,
        })
        .eq('id', caseId);

      if (error) {
        Alert.alert('Error updating notes', error.message);
      } else {
        // Log Activity
        await logActivity(caseId, 'note_added', `Case notes updated.`);

        setShowEditNotesModal(false);
        fetchCaseDetails();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setEditNotesLoading(false);
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
      const today = new Date();
      today.setHours(0,0,0,0);
      if (selectedDate < today) {
        Alert.alert('Validation Error', 'Hearing date cannot be in the past.');
        return;
      }
      setNewHearingDate(selectedDate);
    }
  };

  if (loading || !caseData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  const typeColor = getCaseTypeColor(caseData.case_type);

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

          <ScrollView 
            contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 900, width: '100%', alignSelf: 'center' }]}
            showsVerticalScrollIndicator={true}
          >
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
            {caseData.client_id ? (
              <TouchableOpacity
                onPress={() => navigation.navigate('ClientDetail', { clientId: caseData.client_id })}
                style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}
                activeOpacity={0.7}
              >
                <Text style={[styles.value, { color: colors.accent, fontWeight: 'bold', textDecorationLine: 'underline' }]}>
                  {caseData.client_name}
                </Text>
                <Ionicons name="open-outline" size={14} color={colors.accent} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            ) : (
              <Text style={[styles.value, { color: colors.text }]}>{caseData.client_name}</Text>
            )}
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

          {/* COURT DETAILS */}
          {caseData.court_name ? (
            <View style={{ marginTop: 14, borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 }}>
              <Text style={[styles.label, { color: colors.textSub }]}>Court Venue</Text>
              <Text style={[styles.value, { color: colors.text, fontWeight: 'bold' }]}>{caseData.court_name}</Text>
              {caseData.courtroom ? (
                <Text style={[styles.value, { color: colors.textSub, marginTop: 2 }]}>🏛️ Courtroom/Hall: {caseData.courtroom}</Text>
              ) : null}

            </View>
          ) : null}

          {/* NOTES DISPLAY */}
          <View style={[styles.notesGroup, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.label, { color: colors.textSub, marginBottom: 0 }]}>Case Notes</Text>
              {caseData.status === 'Active' && (
                <TouchableOpacity
                  onPress={() => {
                    setEditNotesText(caseData.notes || '');
                    setShowEditNotesModal(true);
                  }}
                  style={{ padding: 4 }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="create-outline" size={18} color={colors.accent} />
                </TouchableOpacity>
              )}
            </View>
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
        <View style={styles.actionContainer}>
          {caseData.status === 'Active' && (
            <>
              <Pressable
                style={({ hovered, pressed }) => [
                  styles.scheduleButton,
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
                onPress={() => setShowScheduleModal(true)}
              >
                <Ionicons name="calendar" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.scheduleButtonText}>Schedule Hearing</Text>
              </Pressable>

              <Pressable
                style={({ hovered, pressed }) => [
                  styles.closeButton,
                  { borderColor: colors.danger, backgroundColor: 'transparent', borderWidth: 1 },
                  hovered && { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' },
                  pressed && { opacity: 0.8 }
                ]}
                onPress={() => setShowCloseModal(true)}
              >
                <Ionicons name="lock-closed" size={20} color={colors.danger} style={{ marginRight: 8 }} />
                <Text style={[styles.closeButtonText, { color: colors.danger }]}>Close Case</Text>
              </Pressable>
            </>
          )}

          {userRole === 'owner' && (
            <Pressable
              style={({ hovered, pressed }) => [
                styles.deleteButton,
                { borderColor: colors.danger, backgroundColor: 'transparent', borderWidth: 1 },
                hovered && { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' },
                pressed && { opacity: 0.8 }
              ]}
              onPress={handleDeleteCase}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete Case Record</Text>
            </Pressable>
          )}
        </View>

        {/* CASE TIMELINE / ACTIVITY LOG */}
        <View style={{ marginTop: 28, marginBottom: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.textSub, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }]}>Case Activity log</Text>
          {activities.length > 0 ? (
            <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderColor: colors.border, marginLeft: 10, gap: 18 }}>
              {activities.map((act) => {
                let iconName = 'ellipse';
                let iconColor = colors.textSub;
                if (act.action_type === 'created') {
                  iconName = 'add-circle';
                  iconColor = colors.success;
                } else if (act.action_type === 'hearing_scheduled') {
                  iconName = 'calendar';
                  iconColor = colors.accent;
                } else if (act.action_type === 'note_added') {
                  iconName = 'document-text';
                  iconColor = '#fbbf24';
                } else if (act.action_type === 'priority_on' || act.action_type === 'priority_off') {
                  iconName = 'star';
                  iconColor = colors.priorityGold;
                } else if (act.action_type === 'closed') {
                  iconName = 'lock-closed';
                  iconColor = colors.danger;
                }

                return (
                  <View key={act.id} style={{ position: 'relative' }}>
                    {/* Left node dot */}
                    <View style={{
                      position: 'absolute',
                      left: -20,
                      top: 4,
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: colors.background,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Ionicons name={iconName} size={12} color={iconColor} />
                    </View>
                    
                    <Text style={{ fontSize: 14, color: colors.text, fontWeight: '600' }}>
                      {act.action_type.toUpperCase().replace('_', ' ')}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.textSub, marginTop: 2 }}>{act.description}</Text>
                    <Text style={{ fontSize: 11, color: colors.textSub, marginTop: 4 }}>
                      {new Date(act.created_at).toLocaleString()}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: colors.textSub, fontStyle: 'italic', fontSize: 13 }}>No activity logged yet.</Text>
          )}
        </View>
      </ScrollView>
        </View>
      </View>

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

            {Platform.OS === 'web' ? (
              <WebDatePicker
                value={newHearingDate}
                onChange={(selected) => {
                  if (selected) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    if (selected < today) {
                      Alert.alert('Validation Error', 'Hearing date cannot be in the past.');
                      return;
                    }
                    setNewHearingDate(selected);
                  }
                }}
                minimumDate={new Date()}
              />
            ) : (
              <>
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
                    minimumDate={new Date()}
                  />
                )}
              </>
            )}

            {/* COURT VENUE SELECTOR */}
            <TouchableOpacity
              style={[styles.dateSelector, { marginTop: 16, backgroundColor: colors.background, borderColor: colors.border }]}
              onPress={() => setShowCourtModal(true)}
            >
              <Ionicons name="business-outline" size={20} color={colors.textSub} style={{ marginRight: 8 }} />
              <Text style={[styles.dateText, { color: selectedCourtName ? colors.text : colors.textSub }]}>
                {selectedCourtName || 'Select Court Venue...'}
              </Text>
            </TouchableOpacity>

            {/* COURTROOM SELECTOR */}
            {selectedCourtName ? (
              <TouchableOpacity
                style={[styles.dateSelector, { marginTop: 16, backgroundColor: colors.background, borderColor: colors.border }]}
                onPress={() => setShowCourtroomModal(true)}
              >
                <Ionicons name="chevron-down" size={20} color={colors.textSub} style={{ marginRight: 8 }} />
                <Text style={[styles.dateText, { color: selectedCourtroom ? colors.text : colors.textSub }]}>
                  {selectedCourtroom || 'Select Courtroom/Hall...'}
                </Text>
              </TouchableOpacity>
            ) : null}

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

      {/* COURT VENUE PICKER */}
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
                    selectedCourtName === item.name && [styles.modalItemActive, { backgroundColor: colors.background }]
                  ]}
                  onPress={() => {
                    setSelectedCourtName(item.name);
                    setSelectedCourtroom('');
                    setShowCourtModal(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalItemText, selectedCourtName === item.name && styles.modalItemTextActive, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.textSub, marginTop: 2 }}>{item.address}</Text>
                  </View>
                  {selectedCourtName === item.name && <Ionicons name="checkmark" size={20} color="#38bdf8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* COURTROOM PICKER */}
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
              data={courtsData.find(c => c.name === selectedCourtName)?.courtrooms || []}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    { borderColor: colors.border },
                    selectedCourtroom === item && [styles.modalItemActive, { backgroundColor: colors.background }]
                  ]}
                  onPress={() => {
                    setSelectedCourtroom(item);
                    setShowCourtroomModal(false);
                  }}
                >
                  <Text style={[styles.modalItemText, selectedCourtroom === item && styles.modalItemTextActive, { color: colors.text }]}>
                    {item}
                  </Text>
                  {selectedCourtroom === item && <Ionicons name="checkmark" size={20} color="#38bdf8" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* EDIT CASE NOTES MODAL */}
      <Modal visible={showEditNotesModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Case Notes</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>Update notes for hearings or ongoing case details.</Text>

            <TextInput
              style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, minHeight: 150 }]}
              placeholder="Enter details about hearings or upcoming actions..."
              placeholderTextColor={colors.textSub}
              value={editNotesText}
              onChangeText={setEditNotesText}
              multiline
              numberOfLines={6}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowEditNotesModal(false)}
                disabled={editNotesLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveNotes}
                disabled={editNotesLoading}
              >
                {editNotesLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmSaveText}>Save Notes</Text>
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
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  notesText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 22,
    marginTop: 4,
  },
  closingGroup: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  closingLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  closingText: {
    fontSize: 14,
    lineHeight: 22,
  },
  closedAtText: {
    fontSize: 12,
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
    transitionProperty: 'all',
    transitionDuration: '200ms',
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
    transitionProperty: 'all',
    transitionDuration: '200ms',
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
  deleteButton: {
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
