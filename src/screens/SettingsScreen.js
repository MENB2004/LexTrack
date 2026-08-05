import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { isDark, toggle, colors } = useTheme();
  const userEmail = supabase.auth.currentUser?.email || 'lawyer@firm.com';
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Profile fields state
  const [fullName, setFullName] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Load preferences and user profile on mount
  useEffect(() => {
    AsyncStorage.getItem('notif_digest').then((v) => {
      if (v !== null) setDigestEnabled(v === 'true');
    });
    AsyncStorage.getItem('notif_reminders').then((v) => {
      if (v !== null) setRemindersEnabled(v === 'true');
    });

    let active = true;
    const loadProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || supabase.auth.currentUser?.id;
        if (!userId) return;

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, bar_number, specialty, phone')
          .eq('id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error.message);
        } else if (data && active) {
          setFullName(data.full_name || '');
          setBarNumber(data.bar_number || '');
          setSpecialty(data.specialty || '');
          setPhone(data.phone || '');
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const handleToggleDigest = async (value) => {
    setDigestEnabled(value);
    await AsyncStorage.setItem('notif_digest', value ? 'true' : 'false');
  };

  const handleToggleReminders = async (value) => {
    setRemindersEnabled(value);
    await AsyncStorage.setItem('notif_reminders', value ? 'true' : 'false');
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to sign out of LexTrack?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            setLogoutLoading(true);
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                Alert.alert('Error signing out', error.message);
              }
            } catch (err) {
              console.error(err);
            } finally {
              setLogoutLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    setEditLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          bar_number: barNumber.trim(),
          specialty: specialty.trim(),
          phone: phone.trim()
        })
        .eq('id', userId);

      if (error) {
        Alert.alert('Error saving profile', error.message);
      } else {
        setShowEditModal(false);
        Alert.alert('Success', 'Profile updated successfully.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.content}>
        {/* ACCOUNT CARD */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Account Profile</Text>
          <View style={styles.accountRow}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.border }]}>
              <Ionicons name="person" size={28} color={colors.accent} />
            </View>
            <View style={styles.accountInfo}>
              <Text style={[styles.emailText, { color: colors.text, fontSize: 16, fontWeight: 'bold' }]}>
                {fullName || 'Lawyer Account'}
              </Text>
              <Text style={[styles.roleText, { color: colors.textSub }]}>{userEmail}</Text>
              {barNumber ? (
                <Text style={[styles.profileDetailText, { color: colors.textSub }]}>
                  🛡️ Bar ID: <Text style={{ color: colors.text }}>{barNumber}</Text>
                </Text>
              ) : null}
              {specialty ? (
                <Text style={[styles.profileDetailText, { color: colors.textSub }]}>
                  💼 Specialty: <Text style={{ color: colors.text }}>{specialty}</Text>
                </Text>
              ) : null}
              {phone ? (
                <Text style={[styles.profileDetailText, { color: colors.textSub }]}>
                  📞 Contact: <Text style={{ color: colors.text }}>{phone}</Text>
                </Text>
              ) : null}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.editProfileBtn, { borderColor: colors.accent, borderWidth: 1 }]}
            onPress={() => setShowEditModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.editProfileBtnText, { color: colors.accent }]}>Edit Profile Details</Text>
          </TouchableOpacity>
        </View>

        {/* PREFERENCES CARD */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>App Preferences</Text>

          {/* THEME TOGGLE */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={colors.accent} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ false: '#94a3b8', true: '#a78bfa' }}
              thumbColor={isDark ? '#7c3aed' : '#f1f5f9'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* REMINDERS TOGGLE */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="notifications-outline" size={20} color={colors.accent} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Hearing Reminders</Text>
            </View>
            <Switch
              value={remindersEnabled}
              onValueChange={handleToggleReminders}
              trackColor={{ false: '#94a3b8', true: '#a78bfa' }}
              thumbColor={remindersEnabled ? '#7c3aed' : '#f1f5f9'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* DAILY DIGEST TOGGLE */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabelContainer}>
              <Ionicons name="mail-outline" size={20} color={colors.accent} style={styles.settingIcon} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Daily Digest Email</Text>
            </View>
            <Switch
              value={digestEnabled}
              onValueChange={handleToggleDigest}
              trackColor={{ false: '#94a3b8', true: '#a78bfa' }}
              thumbColor={digestEnabled ? '#7c3aed' : '#f1f5f9'}
            />
          </View>
        </View>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.danger }]}
          onPress={handleSignOut}
          disabled={logoutLoading}
          activeOpacity={0.8}
        >
          {logoutLoading ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
              <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out of Account</Text>
            </>
          )}
        </TouchableOpacity>

        {/* INFO FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.infoText}>LexTrack Secure Case Manager</Text>
          <Text style={styles.versionText}>Version 1.0.0 (Expo SDK 54)</Text>
        </View>
      </View>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Profile Details</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>Update your lawyer registration profile credentials.</Text>

            {/* FULL NAME */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Full Name *</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. Harvey Specter"
                placeholderTextColor={colors.textSub}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            {/* BAR ID */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Bar Registration ID</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. BAR-2026-9042"
                placeholderTextColor={colors.textSub}
                value={barNumber}
                onChangeText={setBarNumber}
              />
            </View>

            {/* PRACTICE SPECIALTY */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Specialty / Field</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. Corporate Law / Family Law"
                placeholderTextColor={colors.textSub}
                value={specialty}
                onChangeText={setSpecialty}
              />
            </View>

            {/* CONTACT PHONE */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Contact Phone</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. +1 555-0199"
                placeholderTextColor={colors.textSub}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowEditModal(false)}
                disabled={editLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: colors.accent }]}
                onPress={handleSaveProfile}
                disabled={editLoading}
              >
                {editLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  accountInfo: {
    flex: 1,
  },
  emailText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  roleText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 'auto',
    alignItems: 'center',
    paddingBottom: 20,
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  versionText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  profileDetailText: {
    fontSize: 12,
    marginTop: 3,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 16,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmSaveText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
