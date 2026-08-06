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
  Alert,
  Dimensions,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AddCourtScreen({ navigation }) {
  const { isDark, colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [courtName, setCourtName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [courtroomsText, setCourtroomsText] = useState('');

  // Location Selector Mode
  const [locationMode, setLocationMode] = useState('manual'); // 'manual' | 'map'
  const [latitude, setLatitude] = useState('13.0827'); // Default Madras Coordinates
  const [longitude, setLongitude] = useState('80.2707');

  // Interactive Map Mock state
  const [zoomLevel, setZoomLevel] = useState(14);
  const [pinLocation, setPinLocation] = useState({ x: SCREEN_WIDTH / 2 - 20, y: 70 });

  // Handle map tap to drop pin and calculate coordinates
  const handleMapTap = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    setPinLocation({ x: locationX, y: locationY });

    // Simulate calculating coordinates from relative click pixel position on mockup
    const relativeX = (locationX - (SCREEN_WIDTH - 40) / 2) / 1000;
    const relativeY = (locationY - 75) / 1000;
    const newLat = (13.0827 - relativeY).toFixed(4);
    const newLng = (80.2707 + relativeX).toFixed(4);

    setLatitude(newLat);
    setLongitude(newLng);
  };

  const handleCreateCourt = async () => {
    if (!courtName.trim() || !address.trim()) {
      setErrorMsg('Court Name and Address are required.');
      return;
    }

    const latVal = parseFloat(latitude);
    const lngVal = parseFloat(longitude);
    if (isNaN(latVal) || isNaN(lngVal)) {
      setErrorMsg('Please enter valid numerical coordinate values.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id || supabase.auth.currentUser?.id;
      if (!userId) return;

      const { data: memberData } = await supabase
        .from('firm_members')
        .select('firm_id')
        .eq('user_id', userId)
        .maybeSingle();

      const firmId = memberData?.firm_id;

      // Format courtrooms text list into an array
      const courtroomsArray = courtroomsText
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);

      const { error } = await supabase
        .from('courts')
        .insert({
          user_id: userId,
          firm_id: firmId || null,
          name: courtName.trim(),
          address: address.trim(),
          phone: phone.trim() || null,
          courtrooms: courtroomsArray,
          latitude: latVal,
          longitude: lngVal,
        });

      if (error) {
        Alert.alert('Error adding court', error.message);
      } else {
        Alert.alert('Court Registered', 'The court venue has been registered successfully.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add New Court</Text>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* COURT NAME */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Court Name *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="e.g. Madras High Court"
              placeholderTextColor={colors.textSub}
              value={courtName}
              onChangeText={setCourtName}
            />
          </View>

          {/* CONTACT NUMBER */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Contact Phone</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="e.g. 044-25301000"
              placeholderTextColor={colors.textSub}
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9\-]/g, ''))}
              keyboardType="phone-pad"
            />
          </View>

          {/* STREET ADDRESS */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Address *</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="e.g. Parry's Corner, George Town, Chennai"
              placeholderTextColor={colors.textSub}
              value={address}
              onChangeText={setAddress}
            />
          </View>

          {/* COURTROOMS HALLS */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSub }]}>Courtrooms / Halls (Comma Separated)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="e.g. Court Hall 1, Court Hall 2, Chamber A"
              placeholderTextColor={colors.textSub}
              value={courtroomsText}
              onChangeText={setCourtroomsText}
            />
          </View>

          {/* LOCATION MODE SELECTOR */}
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>Court Geolocation Mapping</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modePill,
                { borderColor: colors.border },
                locationMode === 'manual' && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}
              onPress={() => setLocationMode('manual')}
            >
              <Ionicons name="create-outline" size={16} color={locationMode === 'manual' ? '#ffffff' : colors.textSub} />
              <Text style={[styles.modeText, { color: locationMode === 'manual' ? '#ffffff' : colors.textSub }]}>Manual Entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modePill,
                { borderColor: colors.border },
                locationMode === 'map' && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]}
              onPress={() => setLocationMode('map')}
            >
              <Ionicons name="map-outline" size={16} color={locationMode === 'map' ? '#ffffff' : colors.textSub} />
              <Text style={[styles.modeText, { color: locationMode === 'map' ? '#ffffff' : colors.textSub }]}>Interactive Map</Text>
            </TouchableOpacity>
          </View>

          {locationMode === 'manual' ? (
            <View style={styles.coordsRow}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.label, { color: colors.textSub }]}>Latitude</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="13.0827"
                  placeholderTextColor={colors.textSub}
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.label, { color: colors.textSub }]}>Longitude</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  placeholder="80.2707"
                  placeholderTextColor={colors.textSub}
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : (
            <View style={styles.mapContainer}>
              <Text style={[styles.mapHelpText, { color: colors.textSub }]}>
                Tap anywhere on the virtual grid below to pin the courthouse location:
              </Text>

              <Pressable
                style={[styles.mapVisual, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderColor: colors.border }]}
                onPress={handleMapTap}
              >
                {/* Visual streets grid simulation */}
                <View style={[styles.mapLineH, { top: '30%', backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
                <View style={[styles.mapLineH, { top: '65%', backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
                <View style={[styles.mapLineV, { left: '40%', backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />
                <View style={[styles.mapLineV, { left: '75%', backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

                {/* Courthouse landmark marker */}
                <View style={[styles.landmark, { left: '20%', top: '40%' }]}>
                  <Ionicons name="business" size={16} color={colors.accent} />
                  <Text style={styles.landmarkLabel}>Central Hub</Text>
                </View>

                {/* Dropped Location Pin */}
                <View style={[styles.droppedPin, { left: pinLocation.x, top: pinLocation.y }]}>
                  <Ionicons name="location" size={32} color="#ef4444" />
                </View>

                {/* Map Control Buttons */}
                <View style={styles.mapControls}>
                  <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel(zoomLevel + 1)}>
                    <Ionicons name="add" size={18} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.zoomBtn} onPress={() => setZoomLevel(Math.max(1, zoomLevel - 1))}>
                    <Ionicons name="remove" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              </Pressable>

              <View style={[styles.mapValuesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="locate" size={18} color={colors.accent} style={{ marginRight: 8 }} />
                <Text style={[styles.mapCoordsLabel, { color: colors.textSub }]}>
                  Selected Coordinates: <Text style={{ color: colors.text, fontWeight: 'bold' }}>{latitude}° N, {longitude}° E</Text>
                </Text>
              </View>
            </View>
          )}

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.accent }]}
            onPress={handleCreateCourt}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Register Court Venue</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingVertical: 20,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  coordsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mapContainer: {
    marginBottom: 24,
  },
  mapHelpText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 10,
  },
  mapVisual: {
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  mapLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
  },
  mapLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 6,
  },
  landmark: {
    position: 'absolute',
    alignItems: 'center',
  },
  landmarkLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#64748b',
    marginTop: 2,
  },
  droppedPin: {
    position: 'absolute',
    marginLeft: -16,
    marginTop: -32,
  },
  mapControls: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    gap: 8,
  },
  zoomBtn: {
    backgroundColor: '#0f172a',
    opacity: 0.85,
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapValuesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  mapCoordsLabel: {
    fontSize: 13,
    flex: 1,
  },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
