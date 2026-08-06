import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import Logo from '../components/Logo';
import { Ionicons } from '@expo/vector-icons';

const getPasswordStrength = (pwd) => {
  if (!pwd) return { score: 0, label: '', color: '#94a3b8' };
  let score = 0;
  if (pwd.length >= 6) score += 1;
  if (pwd.length >= 10) score += 1;
  if (/[a-z]/.test(pwd)) score += 1;
  if (/[A-Z]/.test(pwd)) score += 1;
  if (/[0-9]/.test(pwd)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 4) return { score, label: 'Medium', color: '#f59e0b' };
  return { score, label: 'Strong', color: '#10b981' };
};

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [generatedInfo, setGeneratedInfo] = useState('');

  const generateStrongPassword = () => {
    const length = 14;
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    const allChars = lowercase + uppercase + numbers + symbols;

    let pwd = '';
    // Ensure we have at least one character from each class
    pwd += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pwd += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

    // Fill the rest
    for (let i = 4; i < length; i++) {
      pwd += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }

    // Shuffle
    pwd = pwd.split('').sort(() => 0.5 - Math.random()).join('');

    setPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
    setGeneratedInfo('Strong password generated and applied.');
    
    // Auto-clear notification after a few seconds
    setTimeout(() => {
      setGeneratedInfo('');
    }, 5000);
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: 'https://wfspwemzbprucailzuvr.supabase.co/storage/v1/object/public/public-assets/email-verified.html',
        },
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      if (data.user) {
        setSuccessMsg('Registration successful! Please check your email to confirm your account.');
        // Clean fields
        setEmail('');
        setPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg('Sign up completed, but no user data returned.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.headerContainer}>
            <Logo size={70} />
            <Text style={[styles.logo, { marginTop: 12 }]}>LexTrack</Text>
            <Text style={styles.subtitle}>Create your secure case manager account</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.cardTitle}>Sign Up</Text>

            {errorMsg ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="email@lawfirm.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!loading}
              />
            </View>

             <View style={styles.inputContainer}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={18} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Minimum 6 characters"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (generatedInfo) setGeneratedInfo('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
              />
            </View>

            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthLabelRow}>
                  <Text style={styles.strengthLabel}>Password Strength: </Text>
                  <Text style={[styles.strengthValue, { color: getPasswordStrength(password).color }]}>
                    {getPasswordStrength(password).label}
                  </Text>
                </View>
                <View style={styles.strengthBarBg}>
                  <View style={[
                    styles.strengthBar,
                    {
                      width: `${(getPasswordStrength(password).score / 6) * 100}%`,
                      backgroundColor: getPasswordStrength(password).color
                    }
                  ]} />
                </View>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="#64748b"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (generatedInfo) setGeneratedInfo('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateStrongPassword}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Ionicons name="key" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
              <Text style={styles.generateButtonText}>Generate Strong Password</Text>
            </TouchableOpacity>

            {generatedInfo ? (
              <Text style={styles.generatedInfoText}>{generatedInfo}</Text>
            ) : null}

            <TouchableOpacity
              style={styles.signUpButton}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.signUpButtonText}>Register Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.loginLink}> Log In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 20,
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
  successBanner: {
    backgroundColor: '#064e3b',
    borderColor: '#059669',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    color: '#d1fae5',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  inputContainer: {
    marginBottom: 20,
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
  signUpButton: {
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
  signUpButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  loginLink: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyeBtn: {
    padding: 4,
    marginBottom: 4,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    backgroundColor: '#0f172a',
    marginBottom: 20,
  },
  generateButtonText: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  generatedInfoText: {
    color: '#34d399',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  strengthContainer: {
    marginBottom: 16,
  },
  strengthLabelRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  strengthLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  strengthValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  strengthBarBg: {
    height: 6,
    backgroundColor: '#0f172a',
    borderRadius: 3,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 3,
  },
});
