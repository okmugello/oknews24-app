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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { forgotPasswordApi, resetPasswordApi } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Email, 2: Token + New Password

  const handleRequestToken = async () => {
    if (!email) {
      Alert.alert('Errore', 'Inserisci il tuo indirizzo email');
      return;
    }

    setIsLoading(true);
    try {
      await forgotPasswordApi(email);
      setStep(2);
      Alert.alert('Email Inviata', 'Controlla la tua casella di posta per il codice di reset.');
    } catch (error: any) {
      console.log('Reset request error:', error);
      Alert.alert('Errore', 'Si è verificato un problema. Riprova più tardi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken || !newPassword) {
      Alert.alert('Errore', 'Inserisci codice e nuova password');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Errore', 'La password deve contenere almeno 6 caratteri');
      return;
    }

    setIsLoading(true);
    try {
      await resetPasswordApi(resetToken, newPassword);
      Alert.alert(
        'Successo',
        'Password aggiornata correttamente. Ora puoi accedere.',
        [{ text: 'Vai al Login', onPress: () => router.replace('/(auth)/login' as any) }]
      );
    } catch (error: any) {
      console.log('Reset password final error:', error);
      Alert.alert('Errore', error.response?.data?.detail || 'Codice non valido o scaduto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => step === 1 ? router.back() : setStep(1)}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Text style={styles.title}>
              {step === 1 ? 'Password dimenticata?' : 'Reimposta Password'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Inserisci la tua email e ti invieremo le istruzioni.'
                : `Inserisci il codice inviato a ${email} e la tua nuova password.`}
            </Text>
          </View>

          {step === 1 ? (
            <View style={styles.formContainer}>
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

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRequestToken}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : <Text style={styles.buttonText}>Invia Codice</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Codice di Reset (es: reset_...)"
                  value={resetToken}
                  onChangeText={setResetToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nuova Password"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleResetPassword}
                disabled={isLoading}
              >
                {isLoading ? <LoadingSpinner /> : <Text style={styles.buttonText}>Aggiorna Password</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setStep(1)}
              >
                <Text style={styles.secondaryButtonText}>Non hai ricevuto l'email? Riprova</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 24 },
  backButton: { marginBottom: 32 },
  headerContainer: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 12 },
  subtitle: { fontSize: 16, color: '#6B7280', lineHeight: 24 },
  formContainer: { width: '100%' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 52, fontSize: 16, color: '#1F2937' },
  primaryButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  secondaryButton: { marginTop: 24, alignItems: 'center' },
  secondaryButtonText: { color: '#3B82F6', fontSize: 14, fontWeight: '500' },
});
