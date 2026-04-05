import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

const FREE_ARTICLES_LIMIT = 5;

export default function SubscriptionBanner() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user || user.subscription_status !== 'trial') {
    return null;
  }

  const remaining = FREE_ARTICLES_LIMIT - user.articles_read;
  const isLow = remaining <= 2;

  return (
    <TouchableOpacity
      style={[styles.banner, isLow && styles.bannerWarning]}
      onPress={() => router.push('/subscription')}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={isLow ? 'warning' : 'newspaper'}
          size={24}
          color={isLow ? '#F59E0B' : '#3B82F6'}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isLow && styles.titleWarning]}>
          {remaining > 0 ? `${remaining} articoli gratuiti rimanenti` : 'Prova terminata'}
        </Text>
        <Text style={styles.subtitle}>
          Abbonati per accesso illimitato
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#6B7280" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE'
  },
  bannerWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A'
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937'
  },
  titleWarning: {
    color: '#D97706'
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  }
});
