import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import { isBiometricEnabled, isBiometricAvailable, getBiometricType, BiometricType } from '../../hooks/useBiometric';

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithBiometric, biometricEnabled } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioType, setBioType] = useState<BiometricType>('none');
  const [bioLoading, setBioLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const avail = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();
      const type = await getBiometricType();
      setBioEnabled(avail && enabled);
      setBioType(type);
    })();
  }, [biometricEnabled]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      router.replace('/(tabs)' as Href);
    } catch (error: any) {
      Alert.alert(
        'Errore di accesso',
        error.response?.data?.detail || 'Credenziali non valide'
      );
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBioLoading(true);
    try {
      const success = await loginWithBiometric();
      if (success) {
        router.replace('/(tabs)' as Href);
      } else {
        Alert.alert('Autenticazione fallita', 'Riprova o accedi con email e password.');
      }
    } finally {
      setBioLoading(false);
    }
  };

  const bioIcon = bioType === 'face' ? 'scan-outline' : 'finger-print-outline';
  const bioLabel = bioType === 'face' ? 'Accedi con Face ID' : 'Accedi con impronta';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>OK</Text>
            </View>
            <Text style={styles.appName}>OKNews24</Text>
            <Text style={styles.tagline}>Le tue notizie locali</Text>
          </View>

          {/* Biometric quick access */}
          {bioEnabled && (
            <View style={styles.bioSection}>
              <TouchableOpacity
                style={styles.bioButton}
                onPress={handleBiometricLogin}
                disabled={bioLoading}
              >
                {bioLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Ionicons name={bioIcon as any} size={32} color="#3B82F6" />
                    <Text style={styles.bioButtonText}>{bioLabel}</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>oppure con email</Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
          )}

          {/* Login Form */}
          <View style={styles.formContainer}>
            {!bioEnabled && (
              <>
                <Text style={styles.welcomeText}>Bentornato!</Text>
                <Text style={styles.subtitleText}>Accedi per continuare</Text>
              </>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <LoadingSpinner />
              ) : (
                <Text style={styles.loginButtonText}>Accedi</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password' as any)}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Password dimenticata?</Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Non hai un account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register' as Href)}>
                <Text style={styles.registerLink}>Registrati</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937'
  },
  tagline: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4
  },
  bioSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bioButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 40,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
  },
  bioButtonText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#9CA3AF',
  },
  formContainer: {
    width: '100%'
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8
  },
  subtitleText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16
  },
  inputIcon: {
    marginRight: 12
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1F2937'
  },
  eyeIcon: {
    padding: 4
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24
  },
  registerText: {
    fontSize: 14,
    color: '#6B7280'
  },
  registerLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600'
  },
});
