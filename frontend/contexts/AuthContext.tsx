import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import api from '../services/api';

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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  loginWithGoogle: (googleData: { email: string; name?: string; picture?: string; id_token: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage helper with localStorage fallback for web
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

  const checkAuth = useCallback(async () => {
    try {
      const storedToken = await storage.getItem('session_token');
      const storedUser = await storage.getItem('user_data');

      if (!storedToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      // Restore user from local storage immediately
      const userData = JSON.parse(storedUser);
      setUser(userData);

      // Verify token is still valid with backend
      try {
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` }
        });
        const fresh = response.data;
        fresh.user_id = fresh.user_id || fresh.id;
        setUser(fresh);
        await storage.setItem('user_data', JSON.stringify(fresh));
      } catch (verifyErr: any) {
        // If 401 the token expired - clear session
        if (verifyErr?.response?.status === 401) {
          await storage.removeItem('session_token');
          await storage.removeItem('user_data');
          setUser(null);
        }
        // Otherwise keep local data (network error, etc.)
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

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const userData = response.data;
    const token = userData.session_token || userData.access_token || '';

    userData.user_id = userData.user_id || userData.id || '';

    await storage.setItem('user_data', JSON.stringify(userData));
    await storage.setItem('session_token', token);

    setUser(userData);
  };

  const register = async (email: string, name: string, password: string) => {
    const response = await api.post('/auth/register', { email, name, password });
    const userData = response.data;
    const token = userData.session_token || userData.access_token || '';

    userData.user_id = userData.user_id || userData.id || '';

    await storage.setItem('user_data', JSON.stringify(userData));
    await storage.setItem('session_token', token);

    setUser(userData);
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

    userData.user_id = userData.user_id || userData.id || '';

    await storage.setItem('user_data', JSON.stringify(userData));
    await storage.setItem('session_token', token);

    setUser(userData);
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
        login,
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
