import React, { useState } from 'react';
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

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Errore', 'Inserisci email e password');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      console.log('Login completed successfully');
      router.replace('/(tabs)' as Href);
    } catch (error: any) {
      console.log('Login error:', error);
      Alert.alert(
        'Errore di accesso',
        error.response?.data?.detail || 'Credenziali non valide'
      );
      setIsLoading(false);
    }
  };

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

          {/* Login Form */}
          <View style={styles.formContainer}>
            <Text style={styles.welcomeText}>Bentornato!</Text>
            <Text style={styles.subtitleText}>Accedi per continuare</Text>

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
    marginBottom: 40
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
  }
});
