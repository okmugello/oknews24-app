import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_URL = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  articles_read: number;
  subscription_status: string;
  subscription_end_date?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  loginWithGoogle: () => void;
  processGoogleSession: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper functions for storage (with localStorage fallback for web)
const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      // Try AsyncStorage first
      const value = await AsyncStorage.getItem(key);
      if (value) return value;
      
      // Fallback to localStorage on web
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (e) {
      // Fallback to localStorage on web if AsyncStorage fails
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
      // Also save to localStorage on web as backup
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      // Fallback to localStorage on web
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
      // Also remove from localStorage on web
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // Fallback to localStorage on web
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    }
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      const storedToken = await storage.getItem('session_token');
      const storedUser = await storage.getItem('user_data');
      
      console.log('Checking auth - Token:', storedToken ? 'exists' : 'none');
      console.log('Checking auth - User:', storedUser ? 'exists' : 'none');
      
      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      setSessionToken(storedToken);
      
      // First set user from stored data for instant UI
      const userData = JSON.parse(storedUser);
      setUser(userData);
      
      // Then try to verify with server (optional, for data freshness)
      try {
        const response = await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          withCredentials: true
        });
        // Update with fresh data from server
        setUser(response.data);
        await storage.setItem('user_data', JSON.stringify(response.data));
      } catch (verifyError) {
        // If server verification fails, we still have local data
        console.log('Server verification failed, using local data');
      }
    } catch (error) {
      console.log('Auth check failed:', error);
      await storage.removeItem('session_token');
      await storage.removeItem('user_data');
      setSessionToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    console.log('Attempting login for:', email);
    console.log('API URL:', API_URL);
    
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password
    }, { withCredentials: true });

    console.log('Login successful:', response.data);

    const userData = response.data;
    const newSessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store in both AsyncStorage and localStorage (for web)
    await storage.setItem('user_data', JSON.stringify(userData));
    await storage.setItem('session_token', newSessionToken);
    
    setSessionToken(newSessionToken);
    setUser(userData);
    
    console.log('User set, navigation should happen');
  };

  const register = async (email: string, name: string, password: string) => {
    console.log('Attempting registration for:', email);
    
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      email,
      name,
      password
    }, { withCredentials: true });

    console.log('Register response:', response.data);

    const userData = response.data;
    const newSessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    await storage.setItem('user_data', JSON.stringify(userData));
    await storage.setItem('session_token', newSessionToken);
    
    setSessionToken(newSessionToken);
    setUser(userData);
  };

  const loginWithGoogle = () => {
    // For mobile, we'll handle this differently - open a web browser
    const redirectUrl = `${API_URL}/auth-callback`;
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    return authUrl;
  };

  const processGoogleSession = async (sessionId: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/session`, {
        session_id: sessionId
      }, { withCredentials: true });

      const userData = response.data;
      const token = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      await storage.setItem('user_data', JSON.stringify(userData));
      await storage.setItem('session_token', token);
      
      setSessionToken(token);
      setUser(userData);
    } catch (error) {
      console.error('Google session processing failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const storedToken = await storage.getItem('session_token');
      await axios.post(`${API_URL}/api/auth/logout`, {}, {
        headers: storedToken ? { Authorization: `Bearer ${storedToken}` } : {},
        withCredentials: true
      });
    } catch (error) {
      console.log('Logout error:', error);
    } finally {
      await storage.removeItem('session_token');
      await storage.removeItem('user_data');
      setSessionToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const storedUser = await storage.getItem('user_data');
      const storedToken = await storage.getItem('session_token');
      
      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setSessionToken(storedToken);
        
        // Try to get fresh data from server
        try {
          const response = await axios.get(`${API_URL}/api/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
            withCredentials: true
          });
          setUser(response.data);
          await storage.setItem('user_data', JSON.stringify(response.data));
        } catch (err) {
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
        login,
        register,
        loginWithGoogle,
        processGoogleSession,
        logout,
        refreshUser
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
