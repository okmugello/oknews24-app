import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://iencfxwfopjvwhuhmvsa.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllbmNmeHdmb3BqdndodWhtdnNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwOTEwNzgsImV4cCI6MjA5MTY2NzA3OH0.XvOXSeLlXs0vNwzItdajL8dH4TjaicsYdBdSkn0fEZY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        try {
          const val = await AsyncStorage.getItem(key);
          if (val) return val;
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
      setItem: async (key: string, value: string) => {
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
      removeItem: async (key: string) => {
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
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export { SUPABASE_URL, SUPABASE_ANON_KEY };
