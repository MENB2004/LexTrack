import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function ClientListScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Client Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) {
        console.error('Error fetching clients:', error.message);
      } else {
        setClients(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching clients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleAddClient = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }
    if (/[^a-zA-Z\s]/.test(fullName)) {
      Alert.alert('Validation Error', 'Full Name must contain only letters and spaces.');
      return;
    }
    if (phone && /[^0-9]/.test(phone)) {
      Alert.alert('Validation Error', 'Phone number must contain only numbers.');
      return;
    }

    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      // Check if user is Paralegal - wait, we will do role checks inside settings and settings load,
      // but let's check role if they belong to a firm.
      const { data: memberData } = await supabase
        .from('firm_members')
        .select('role, firm_id')
        .eq('user_id', userId)
        .maybeSingle();

      const userRole = memberData?.role;
      const firmId = memberData?.firm_id;

      if (userRole === 'paralegal') {
        Alert.alert('Permission Denied', 'Paralegals are not authorized to create client profiles.');
        setAddLoading(false);
        return;
      }

      const { error } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          firm_id: firmId || null,
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim().toLowerCase() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
        });

      if (error) {
        Alert.alert('Error adding client', error.message);
      } else {
        setFullName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setNotes('');
        setShowAddModal(false);
        Alert.alert('Success', 'Client profile created.');
        fetchClients();
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setAddLoading(false);
    }
  };

  const filteredClients = clients.filter(client => {
    const q = searchQuery.toLowerCase();
    return (
      client.full_name?.toLowerCase().includes(q) ||
      client.phone?.toLowerCase().includes(q) ||
      client.email?.toLowerCase().includes(q)
    );
  });

  const renderClientItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => navigation.navigate('ClientDetail', { clientId: item.id })}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.border }]}>
          <Ionicons name="person" size={20} color={colors.accent} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.clientName, { color: colors.text }]}>{item.full_name}</Text>
          {item.email ? (
            <View style={styles.detailRow}>
              <Ionicons name="mail-outline" size={14} color={colors.textSub} style={{ marginRight: 6 }} />
              <Text style={[styles.detailText, { color: colors.textSub }]}>{item.email}</Text>
            </View>
          ) : null}
          {item.phone ? (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={14} color={colors.textSub} style={{ marginRight: 6 }} />
              <Text style={[styles.detailText, { color: colors.textSub }]}>{item.phone}</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* SEARCH ROW */}
      <View style={styles.searchRow}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={20} color={colors.textSub} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search clients by name, email, or phone..."
            placeholderTextColor={colors.textSub}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* CLIENTS LIST */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filteredClients.length > 0 ? (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          renderItem={renderClientItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={fetchClients}
          refreshing={loading}
        />
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="people-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Clients Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSub }]}>
            {searchQuery ? 'Try adjusting your search query.' : 'Add your first client profile to get started.'}
          </Text>
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        onPress={() => setShowAddModal(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* ADD CLIENT MODAL */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Client</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSub }]}>Create a persistent client card to link with law cases.</Text>

              {/* FULL NAME */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Full Name *</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="e.g. Mike Ross"
                  placeholderTextColor={colors.textSub}
                  value={fullName}
                  onChangeText={(text) => setFullName(text.replace(/[^a-zA-Z\s]/g, ''))}
                />
              </View>

              {/* PHONE */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Phone Number</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="e.g. 5550199"
                  placeholderTextColor={colors.textSub}
                  value={phone}
                  onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                  keyboardType="phone-pad"
                />
              </View>

              {/* EMAIL */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Email Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="e.g. mike@pearsonhardman.com"
                  placeholderTextColor={colors.textSub}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {/* ADDRESS */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Office / Home Address</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="e.g. 601 E 54th St, New York"
                  placeholderTextColor={colors.textSub}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              {/* NOTES */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSub }]}>Internal Remarks</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="Additional client details, business connection, etc..."
                  placeholderTextColor={colors.textSub}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={() => setShowAddModal(false)}
                  disabled={addLoading}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.accent }]}
                  onPress={handleAddClient}
                  disabled={addLoading}
                >
                  {addLoading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.saveBtnText}>Add Client</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardInfo: {
    flex: 1,
  },
  clientName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  detailText: {
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
