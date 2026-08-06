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
  const [userEmail, setUserEmail] = useState(supabase.auth.currentUser?.email || 'lawyer@firm.com');
  const [digestEnabled, setDigestEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Profile fields state
  const [fullName, setFullName] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [phone, setPhone] = useState('');

  // Draft profile states for editing
  const [editFullName, setEditFullName] = useState('');
  const [editBarNumber, setEditBarNumber] = useState('');
  const [editSpecialty, setEditSpecialty] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  // Team Collaboration states
  const [firm, setFirm] = useState(null);
  const [firmRole, setFirmRole] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [firmLoading, setFirmLoading] = useState(true);

  // Create Firm Modal states
  const [showFirmModal, setShowFirmModal] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [createFirmLoading, setCreateFirmLoading] = useState(false);

  // Invite Member states
  const [colleagueEmail, setColleagueEmail] = useState('');
  const [colleagueRole, setColleagueRole] = useState('associate');
  const [inviteLoading, setInviteLoading] = useState(false);

  const loadFirmDetails = async () => {
    setFirmLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      const { data: memberData } = await supabase
        .from('firm_members')
        .select('*, firms(*)')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberData) {
        setFirm(memberData.firms);
        setFirmRole(memberData.role);
        
        // Fetch other members
        const { data: members } = await supabase
          .from('firm_members')
          .select('*, profiles(id, full_name)')
          .eq('firm_id', memberData.firm_id);
        
        if (members) {
          setTeamMembers(members);
        }
      } else {
        setFirm(null);
        setFirmRole('');
        setTeamMembers([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFirmLoading(false);
    }
  };

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

        if (session?.user?.email && active) {
          setUserEmail(session.user.email);
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, bar_number, specialty, phone, email')
          .eq('id', userId)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading profile:', error.message);
        } else if (data && active) {
          setFullName(data.full_name || '');
          setBarNumber(data.bar_number || '');
          setSpecialty(data.specialty || '');
          setPhone(data.phone || '');
          
          if (!data.email && session?.user?.email) {
            await supabase
              .from('profiles')
              .update({ email: session.user.email })
              .eq('id', userId);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadProfile();
    loadFirmDetails();
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
    if (!editFullName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    if (/[^a-zA-Z\s]/.test(editFullName)) {
      Alert.alert('Validation Error', 'Full Name must contain only letters and spaces.');
      return;
    }
    if (editPhone && /[^0-9]/.test(editPhone)) {
      Alert.alert('Validation Error', 'Contact Phone must contain only numbers.');
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
          full_name: editFullName.trim(),
          bar_number: editBarNumber.trim(),
          specialty: editSpecialty.trim(),
          phone: editPhone.trim()
        })
        .eq('id', userId);

      if (error) {
        Alert.alert('Error saving profile', error.message);
      } else {
        setFullName(editFullName.trim());
        setBarNumber(editBarNumber.trim());
        setSpecialty(editSpecialty.trim());
        setPhone(editPhone.trim());
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

  const handleCreateFirm = async () => {
    if (!firmName.trim()) {
      Alert.alert('Validation Error', 'Firm Name is required.');
      return;
    }
    setCreateFirmLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      const { data: newFirm, error: firmError } = await supabase
        .from('firms')
        .insert({
          name: firmName.trim(),
          created_by: userId
        })
        .select()
        .single();

      if (firmError) {
        Alert.alert('Error creating firm', firmError.message);
      } else {
        const { error: memberError } = await supabase
          .from('firm_members')
          .insert({
            firm_id: newFirm.id,
            user_id: userId,
            role: 'owner'
          });

        if (memberError) {
          Alert.alert('Error linking owner role', memberError.message);
        } else {
          setFirmName('');
          setShowFirmModal(false);
          Alert.alert('Success', `Welcome to ${newFirm.name}!`);
          loadFirmDetails();
        }
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setCreateFirmLoading(false);
    }
  };

  const handleInviteColleague = async () => {
    if (!colleagueEmail.trim()) {
      Alert.alert('Validation Error', 'Please enter colleague\'s email.');
      return;
    }
    if (firmRole !== 'owner') {
      Alert.alert('Permission Denied', 'Only the firm owner can invite colleagues.');
      return;
    }
    setInviteLoading(true);
    try {
      const { data: targetProfile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('email', colleagueEmail.trim().toLowerCase())
        .maybeSingle();

      if (profileErr) {
        Alert.alert('Error looking up profile', profileErr.message);
        setInviteLoading(false);
        return;
      }

      if (!targetProfile) {
        Alert.alert('User Not Found', 'No lawyer profile found with that email address. Ask your colleague to sign up first.');
        setInviteLoading(false);
        return;
      }

      const { error: memberErr } = await supabase
        .from('firm_members')
        .insert({
          firm_id: firm.id,
          user_id: targetProfile.id,
          role: colleagueRole,
        });

      if (memberErr) {
        Alert.alert('Error inviting colleague', 'This colleague might already belong to a firm, or has already been added.');
      } else {
        setColleagueEmail('');
        Alert.alert('Success', `${targetProfile.full_name || colleagueEmail} has been added to the firm.`);
        loadFirmDetails();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setInviteLoading(false);
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
            onPress={() => {
              setEditFullName(fullName);
              setEditBarNumber(barNumber);
              setEditSpecialty(specialty);
              setEditPhone(phone);
              setShowEditModal(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={16} color={colors.accent} style={{ marginRight: 6 }} />
            <Text style={[styles.editProfileBtnText, { color: colors.accent }]}>Edit Profile Details</Text>
          </TouchableOpacity>
        </View>

        {/* TEAM / LAW FIRM CARD */}
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Firm & Teammates</Text>
          {firmLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={{ padding: 20 }} />
          ) : firm ? (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>{firm.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <Ionicons name="shield-checkmark" size={14} color={colors.accent} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 13, color: colors.accent, fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {firmRole}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Teammates List */}
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textSub, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8, marginBottom: 8 }}>
                Teammates ({teamMembers.length})
              </Text>
              
              <View style={{ gap: 8, marginBottom: 16 }}>
                {teamMembers.map(member => (
                  <View key={member.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderColor: 'rgba(51,65,85,0.2)' }}>
                    <Text style={{ color: colors.text, fontSize: 14 }}>
                      {member.profiles?.full_name || 'Anonymous Teammate'}
                    </Text>
                    <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>
                        {member.role}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Owner Actions - Invite colleague */}
              {firmRole === 'owner' && (
                <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: 14 }}>
                  <Text style={{ fontSize: 13, color: colors.textSub, fontWeight: '600', marginBottom: 8 }}>Invite Colleague</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, marginBottom: 8, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 }]}
                    placeholder="Enter Colleague Email Address..."
                    placeholderTextColor={colors.textSub}
                    value={colleagueEmail}
                    onChangeText={setColleagueEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                    {['associate', 'paralegal'].map(role => (
                      <TouchableOpacity
                        key={role}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          alignItems: 'center',
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: colleagueRole === role ? colors.accent : colors.border,
                          backgroundColor: colleagueRole === role ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                        }}
                        onPress={() => setColleagueRole(role)}
                      >
                        <Text style={{ color: colleagueRole === role ? colors.accent : colors.textSub, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>
                          {role}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={{ backgroundColor: colors.accent, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                    onPress={handleInviteColleague}
                    disabled={inviteLoading}
                  >
                    {inviteLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Send Invitation</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: colors.textSub, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                You are currently operating as Independent Counsel. Create a Law Firm to collaborate and share cases and clients with associates or paralegals.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: colors.accent, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}
                onPress={() => setShowFirmModal(true)}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Create Law Firm</Text>
              </TouchableOpacity>
            </View>
          )}
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
                value={editFullName}
                onChangeText={(text) => setEditFullName(text.replace(/[^a-zA-Z\s]/g, ''))}
              />
            </View>

            {/* BAR ID */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Bar Registration ID</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. BAR-2026-9042"
                placeholderTextColor={colors.textSub}
                value={editBarNumber}
                onChangeText={setEditBarNumber}
              />
            </View>

            {/* PRACTICE SPECIALTY */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Specialty / Field</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. Corporate Law / Family Law"
                placeholderTextColor={colors.textSub}
                value={editSpecialty}
                onChangeText={setEditSpecialty}
              />
            </View>

            {/* CONTACT PHONE */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Contact Phone</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. 5550199"
                placeholderTextColor={colors.textSub}
                value={editPhone}
                onChangeText={(text) => setEditPhone(text.replace(/[^0-9]/g, ''))}
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

      {/* CREATE FIRM MODAL */}
      <Modal visible={showFirmModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create Law Firm</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>Start a shared workspace for your firm's cases and clients.</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSub }]}>Firm Name *</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="e.g. Pearson Hardman LLC"
                placeholderTextColor={colors.textSub}
                value={firmName}
                onChangeText={setFirmName}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowFirmModal(false)}
                disabled={createFirmLoading}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmSaveBtn, { backgroundColor: colors.accent }]}
                onPress={handleCreateFirm}
                disabled={createFirmLoading}
              >
                {createFirmLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmSaveText}>Create Firm</Text>
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
