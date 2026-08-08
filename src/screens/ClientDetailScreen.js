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
  Linking,
  useWindowDimensions,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../context/ThemeContext';

export default function ClientDetailScreen({ route, navigation }) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width > 768;
  const { clientId } = route.params;
  const [client, setClient] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const fetchClientData = async () => {
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError) {
        Alert.alert('Error', 'Unable to load client data.');
        navigation.goBack();
        return;
      }

      setClient(clientData);
      setEditName(clientData.full_name || '');
      setEditPhone(clientData.phone || '');
      setEditEmail(clientData.email || '');
      setEditAddress(clientData.address || '');
      setEditNotes(clientData.notes || '');

      // Fetch linked cases
      const { data: casesData, error: casesError } = await supabase
        .from('cases')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

      if (casesError) {
        console.error('Error fetching linked cases:', casesError.message);
      } else {
        setCases(casesData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const handleUpdateClient = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    if (/[^a-zA-Z\s]/.test(editName)) {
      Alert.alert('Validation Error', 'Full Name must contain only letters and spaces.');
      return;
    }
    if (editPhone && /[^0-9]/.test(editPhone)) {
      Alert.alert('Validation Error', 'Phone number must contain only numbers.');
      return;
    }

    setEditLoading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: editName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim().toLowerCase() || null,
          address: editAddress.trim() || null,
          notes: editNotes.trim() || null,
        })
        .eq('id', clientId);

      if (error) {
        Alert.alert('Error saving client info', error.message);
      } else {
        setShowEditModal(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    // Check role first
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      const { data: memberData } = await supabase
        .from('firm_members')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (memberData?.role === 'paralegal' || memberData?.role === 'associate') {
        Alert.alert('Permission Denied', 'Only firm owners/partners can delete client records.');
        return;
      }
    } catch (err) {
      console.error(err);
    }

    Alert.alert(
      'Delete Client',
      'Are you sure you want to delete this client? Linked cases will not be deleted but will be unlinked.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase
              .from('clients')
              .delete()
              .eq('id', clientId);

            if (error) {
              Alert.alert('Error deleting client', error.message);
              setLoading(false);
            } else {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const handleCall = () => {
    if (client?.phone) {
      Linking.openURL(`tel:+91${client.phone}`);
    }
  };

  const handleEmail = () => {
    if (client?.email) {
      Linking.openURL(`mailto:${client.email}`);
    }
  };

  const handleAddress = () => {
    if (client?.address) {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(client.address)}`);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

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
          {/* HEADER */}
          <View style={[styles.header, { borderColor: colors.border }]}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Client Profile</Text>
            <TouchableOpacity style={{ padding: 4 }} onPress={() => setShowEditModal(true)}>
              <Ionicons name="create-outline" size={24} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={[styles.scrollContent, isDesktop && { maxWidth: 800, width: '100%', alignSelf: 'center' }]}
            showsVerticalScrollIndicator={true}
          >
        {/* CARD WRAPPER */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.avatarLarge, { backgroundColor: colors.border }]}>
              <Ionicons name="person" size={44} color={colors.accent} />
            </View>
            <Text style={[styles.clientNameText, { color: colors.text }]}>{client.full_name}</Text>
          </View>

          {/* ACTION BUTTONS ROW */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionItem, { backgroundColor: colors.background, opacity: client.phone ? 1 : 0.4 }]}
              onPress={handleCall}
              disabled={!client.phone}
            >
              <Ionicons name="call" size={20} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.text }]}>Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, { backgroundColor: colors.background, opacity: client.email ? 1 : 0.4 }]}
              onPress={handleEmail}
              disabled={!client.email}
            >
              <Ionicons name="mail" size={20} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.text }]}>Email</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, { backgroundColor: colors.background, opacity: client.address ? 1 : 0.4 }]}
              onPress={handleAddress}
              disabled={!client.address}
            >
              <Ionicons name="map" size={20} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.text }]}>Address</Text>
            </TouchableOpacity>
          </View>

          {/* DETAIL LINES */}
          <View style={styles.detailCardLines}>
            {client.phone && (
              <View style={styles.detailBlock}>
                <Text style={[styles.label, { color: colors.textSub }]}>Phone Number</Text>
                <Text style={[styles.value, { color: colors.text }]}>+91 {client.phone}</Text>
              </View>
            )}

            {client.email && (
              <View style={styles.detailBlock}>
                <Text style={[styles.label, { color: colors.textSub }]}>Email Address</Text>
                <Text style={[styles.value, { color: colors.text }]}>{client.email}</Text>
              </View>
            )}

            {client.address && (
              <View style={styles.detailBlock}>
                <Text style={[styles.label, { color: colors.textSub }]}>Address</Text>
                <Text style={[styles.value, { color: colors.text }]}>{client.address}</Text>
              </View>
            )}

            <View style={styles.detailBlock}>
              <Text style={[styles.label, { color: colors.textSub }]}>Internal Remarks</Text>
              <Text style={[styles.value, { color: colors.text, fontStyle: client.notes ? 'normal' : 'italic' }]}>
                {client.notes || 'No remarks provided.'}
              </Text>
            </View>
          </View>
        </View>

        {/* ASSOCIATED CASES */}
        <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Linked Cases ({cases.length})</Text>
        {cases.length > 0 ? (
          cases.map(caseItem => (
            <TouchableOpacity
              key={caseItem.id}
              style={[styles.caseCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('CaseDetail', { caseId: caseItem.id })}
              activeOpacity={0.8}
            >
              <View style={styles.caseHeader}>
                <Text style={[styles.caseNum, { color: colors.text }]}>{caseItem.case_number}</Text>
                <Text style={[styles.caseType, { color: colors.accent }]}>{caseItem.case_type}</Text>
              </View>
              <Text style={[styles.caseStatus, { color: caseItem.status === 'Closed' ? colors.danger : colors.success }]}>
                {caseItem.status}
              </Text>
            </TouchableOpacity>
          ))
        ) : (
          <View style={[styles.emptyCasesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyCasesText, { color: colors.textSub }]}>No cases associated with this client profile.</Text>
          </View>
        )}

        {/* DANGER AREA */}
        <Pressable
          style={({ hovered, pressed }) => [
            styles.deleteButton,
            { borderColor: colors.danger },
            hovered && { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)' },
            pressed && { opacity: 0.8 }
          ]}
          onPress={handleDeleteClient}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.deleteText, { color: colors.danger }]}>Delete Client Record</Text>
        </Pressable>
      </ScrollView>
        </View>
      </View>

      {/* EDIT MODAL */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Client Profile</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>Update contact details or remarks for this client.</Text>

              {/* FULL NAME */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Full Name *</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={editName}
                  onChangeText={(text) => setEditName(text.replace(/[^a-zA-Z\s]/g, ''))}
                />
              </View>

              {/* PHONE */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Phone Number</Text>
                <View style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 0 }]}>
                  <View style={{ paddingHorizontal: 12, paddingVertical: 12, borderRightWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.textSub, fontSize: 14, fontWeight: '600' }}>+91</Text>
                  </View>
                  <TextInput
                    style={{ flex: 1, color: colors.text, fontSize: 14, paddingHorizontal: 12, paddingVertical: 12 }}
                    value={editPhone}
                    onChangeText={(text) => setEditPhone(text.replace(/[^0-9]/g, ''))}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>
              </View>

              {/* EMAIL */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* ADDRESS */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={editAddress}
                  onChangeText={setEditAddress}
                />
              </View>

              {/* NOTES */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Internal Remarks</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable
                  style={({ hovered, pressed }) => [
                    styles.cancelBtn,
                    { borderColor: colors.border },
                    hovered && { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' },
                    pressed && { opacity: 0.7 }
                  ]}
                  onPress={() => setShowEditModal(false)}
                  disabled={editLoading}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ hovered, pressed }) => [
                    styles.saveBtn,
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
                  onPress={handleUpdateClient}
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  profileCard: {
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    marginBottom: 24,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  clientNameText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#334155',
    paddingBottom: 20,
  },
  actionItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 80,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  detailCardLines: {
    gap: 16,
  },
  detailBlock: {
    borderBottomWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.4)',
    paddingBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginTop: 8,
  },
  caseCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  caseNum: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  caseType: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  caseStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCasesCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyCasesText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    marginBottom: 40,
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '90%',
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
    transitionProperty: 'all',
    transitionDuration: '200ms',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
