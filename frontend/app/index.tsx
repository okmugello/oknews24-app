import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { initializeApp } from '../services/api';

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth();
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    // Initialize app on first load
    const init = async () => {
      try {
        await initializeApp();
      } catch (error) {
        console.log('Init error (may be already initialized):', error);
      }
      setInitDone(true);
    };
    init();
  }, []);

  // Show loading while checking auth
  if (isLoading || !initDone) {
    return (
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>OK</Text>
          </View>
          <Text style={styles.appName}>OKNews24</Text>
          <Text style={styles.tagline}>Le tue notizie locali</Text>
        </View>
        <LoadingSpinner message="Caricamento..." />
      </View>
    );
  }

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937'
  },
  tagline: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4
  }
});
