import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import api from '../services/api';
import { getDeviceId, getDeviceName } from '../utils/deviceId';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  saveTokenSecurely,
  clearStoredToken,
  getStoredToken,
  authenticateWithBiometric,
  getBiometricType,
} from '../hooks/useBiometric';

interface User {
  user_id: string;
  id?: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  articles_read: number;
  subscription_status: string;
  subscription_end_date?: string;
  enabled_feeds?: string[];
  favorite_feed?: string | null;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<void>;
  disableBiometric: () => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  loginWithGoogle: (googleData: { email: string; name?: string; picture?: string; id_token: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) return value;
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const bioAvail = await isBiometricAvailable();
      const bioEnabled = await isBiometricEnabled();
      setBiometricAvailable(bioAvail);
      setBiometricEnabled(bioEnabled && bioAvail);

      const storedToken = await storage.getItem('session_token');
      const storedUser = await storage.getItem('user_data');

      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      const userData = JSON.parse(storedUser);
      setUser(userData);

      try {
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        const fresh = response.data;
        fresh.user_id = fresh.user_id || fresh.id;
        setUser(fresh);
        await storage.setItem('user_data', JSON.stringify(fresh));
      } catch (verifyErr: any) {
        if (verifyErr?.response?.status === 401) {
          await storage.removeItem('session_token');
          await storage.removeItem('user_data');
          setUser(null);
        }
      }
    } catch (error) {
      console.log('Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const _persistLogin = async (userData: any, token: string) => {
    userData.user_id = userData.user_id || userData.id || '';
    await storage.setItem('user_data', JSON.stringify(userData));
    await storage.setItem('session_token', token);
    // Aggiorna il token nel SecureStore se la biometria è abilitata
    const bioEnabled = await isBiometricEnabled();
    if (bioEnabled) {
      await saveTokenSecurely(token);
    }
    setUser(userData);
  };

  const login = async (email: string, password: string) => {
    const device_id = await getDeviceId();
    const device_name = getDeviceName();
    const response = await api.post('/auth/login', { email, password, device_id, device_name });
    const userData = response.data;
    const token = userData.session_token || userData.access_token || '';
    await _persistLogin(userData, token);

    // Dopo login riuscito: offri biometria se disponibile e non ancora abilitata
    const bioAvail = await isBiometricAvailable();
    setBiometricAvailable(bioAvail);
    const bioEnabled = await isBiometricEnabled();
    if (bioAvail && !bioEnabled) {
      const bioType = await getBiometricType();
      const label = bioType === 'face' ? 'Face ID' : 'impronta digitale';
      setTimeout(() => {
        Alert.alert(
          `Abilita ${label}`,
          `Vuoi usare ${label} per accedere più velocemente la prossima volta?`,
          [
            { text: 'Non ora', style: 'cancel' },
            {
              text: `Abilita`,
              onPress: async () => {
                await saveTokenSecurely(token);
                setBiometricEnabled(true);
              },
            },
          ]
        );
      }, 800);
    }
  };

  // Accesso tramite biometria: verifica il token salvato in SecureStore
  const loginWithBiometric = async (): Promise<boolean> => {
    try {
      const bioType = await getBiometricType();
      const label = bioType === 'face' ? 'Face ID' : 'impronta digitale';
      const authenticated = await authenticateWithBiometric(`Accedi con ${label}`);
      if (!authenticated) return false;

      // Prova a usare il token salvato in SecureStore
      const secureToken = await getStoredToken();
      if (!secureToken) return false;

      // Verifica che il token sia ancora valido
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${secureToken}` }
      });
      const userData = response.data;
      userData.user_id = userData.user_id || userData.id || '';

      await storage.setItem('user_data', JSON.stringify(userData));
      await storage.setItem('session_token', secureToken);
      setUser(userData);
      return true;
    } catch (e: any) {
      if (e?.response?.status === 401) {
        // Token scaduto: disabilita biometria e chiedi login manuale
        await clearStoredToken();
        setBiometricEnabled(false);
      }
      return false;
    }
  };

  // Abilita biometria dal profilo: verifica con Face ID e salva il token attuale
  const enableBiometric = async (): Promise<void> => {
    const bioType = await getBiometricType();
    const label = bioType === 'face' ? 'Face ID' : 'impronta digitale';
    const authenticated = await authenticateWithBiometric(`Configura ${label} per OKNews24`);
    if (!authenticated) {
      Alert.alert('Autenticazione fallita', 'Non è stato possibile configurare la biometria.');
      return;
    }
    const currentToken = await storage.getItem('session_token');
    if (!currentToken) return;
    await saveTokenSecurely(currentToken);
    setBiometricEnabled(true);
    Alert.alert('Biometria abilitata', `${label} è ora attivo per il login.`);
  };

  const disableBiometric = async (): Promise<void> => {
    await clearStoredToken();
    setBiometricEnabled(false);
  };

  const register = async (email: string, name: string, password: string) => {
    const response = await api.post('/auth/register', { email, name, password });
    const userData = response.data;
    const token = userData.session_token || userData.access_token || '';
    await _persistLogin(userData, token);
  };

  const loginWithGoogle = async (googleData: { email: string; name?: string; picture?: string; id_token: string }) => {
    const response = await api.post('/auth/google', {
      email: googleData.email,
      name: googleData.name,
      picture: googleData.picture,
      id_token: googleData.id_token,
    });
    const userData = response.data;
    const token = userData.session_token || userData.access_token || '';
    await _persistLogin(userData, token);
  };

  const logout = async () => {
    try {
      const storedToken = await storage.getItem('session_token');
      if (storedToken) {
        await api.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
      }
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      await storage.removeItem('session_token');
      await storage.removeItem('user_data');
      // NON cancellare il token biometrico al logout: serve per il re-accesso rapido
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const storedToken = await storage.getItem('session_token');
      const storedUser = await storage.getItem('user_data');

      if (storedToken && storedUser) {
        const localUser = JSON.parse(storedUser);
        setUser(localUser);

        try {
          const response = await api.get('/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          });
          const fresh = response.data;
          fresh.user_id = fresh.user_id || fresh.id;
          setUser(fresh);
          await storage.setItem('user_data', JSON.stringify(fresh));
        } catch {
          console.log('Could not refresh from server');
        }
      }
    } catch (error) {
      console.log('Refresh user failed:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        biometricEnabled,
        biometricAvailable,
        login,
        loginWithBiometric,
        enableBiometric,
        disableBiometric,
        register,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
