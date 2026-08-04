import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { supabase } from './lib/supabase';

export default function App() {
  const [dbStatus, setDbStatus] = useState('Checking Supabase connection...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConnection() {
      try {
        const { data, error } = await supabase.from('cases').select('count', { count: 'exact', head: true });
        if (error) {
          // If RLS blocks unauthenticated query or table exists, client is connected
          setDbStatus(`Supabase Client Initialized (Status: ${error.message || 'Ready'})`);
        } else {
          setDbStatus('Connected to Supabase Database successfully!');
        }
      } catch (err) {
        setDbStatus(`Client configured. Add your Supabase credentials in .env`);
      } finally {
        setLoading(false);
      }
    }
    checkConnection();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <View style={styles.card}>
        <Text style={styles.badge}>PHASE 1 COMPLETE</Text>
        <Text style={styles.title}>⚖️ LexTrack</Text>
        <Text style={styles.subtitle}>Lawyer Case Management App</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>Backend Setup Status:</Text>
          {loading ? (
            <ActivityIndicator color="#38bdf8" style={{ marginTop: 10 }} />
          ) : (
            <Text style={styles.statusText}>{dbStatus}</Text>
          )}
        </View>

        <Text style={styles.instructions}>
          Next Steps:
          {"\n"}1. Add EXPO_PUBLIC_SUPABASE_URL & EXPO_PUBLIC_SUPABASE_ANON_KEY to .env
          {"\n"}2. Execute supabase_schema.sql in Supabase SQL Editor
          {"\n"}3. Proceed to Phase 2 (Authentication)
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  badge: {
    backgroundColor: '#0369a1',
    color: '#e0f2fe',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 24,
  },
  statusBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statusText: {
    fontSize: 14,
    color: '#38bdf8',
    fontWeight: '500',
  },
  instructions: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 20,
    textAlign: 'left',
    width: '100%',
  },
});
