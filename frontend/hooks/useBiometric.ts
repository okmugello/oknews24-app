import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_ENABLED_KEY = 'biometric_enabled';
const SECURE_TOKEN_KEY = 'bio_session_token';

let LocalAuthentication: any = null;
let SecureStore: any = null;

if (Platform.OS !== 'web') {
  LocalAuthentication = require('expo-local-authentication');
  SecureStore = require('expo-secure-store');
}

export type BiometricType = 'face' | 'fingerprint' | 'none';

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  } catch {
    return false;
  }
}

export async function getBiometricType(): Promise<BiometricType> {
  if (Platform.OS === 'web' || !LocalAuthentication) return 'none';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const AuthType = LocalAuthentication.AuthenticationType;
    if (types.includes(AuthType.FACIAL_RECOGNITION)) return 'face';
    if (types.includes(AuthType.FINGERPRINT)) return 'fingerprint';
    return 'none';
  } catch {
    return 'none';
  }
}

export async function authenticateWithBiometric(reason?: string): Promise<boolean> {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason || 'Accedi a OKNews24',
      fallbackLabel: 'Usa password',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

// Salva il token di sessione nel SecureStore (protetto dal SO)
export async function saveTokenSecurely(token: string): Promise<void> {
  if (Platform.OS === 'web' || !SecureStore) return;
  await SecureStore.setItemAsync(SECURE_TOKEN_KEY, token);
  await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
}

export async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !SecureStore) return null;
  try {
    return await SecureStore.getItemAsync(SECURE_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function clearStoredToken(): Promise<void> {
  if (Platform.OS === 'web' || !SecureStore) return;
  try {
    await SecureStore.deleteItemAsync(SECURE_TOKEN_KEY);
  } catch {}
  await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
  return val === 'true';
}

export function useBiometric() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [bioType, setBioType] = useState<BiometricType>('none');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const avail = await isBiometricAvailable();
    const en = await isBiometricEnabled();
    const type = await getBiometricType();
    setAvailable(avail);
    setEnabled(en && avail);
    setBioType(type);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { available, enabled, bioType, loading, reload };
}
