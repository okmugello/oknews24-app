import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const FREE_ARTICLES_LIMIT = 5;

export default function SubscriptionBanner() {
  const { user } = useAuth();

  if (!user || user.subscription_status !== 'trial') {
    return null;
  }

  const remaining = Math.max(0, FREE_ARTICLES_LIMIT - user.articles_read);
  const isLow = remaining <= 2;

  return (
    <View style={[styles.banner, isLow && styles.bannerWarning]}>
      <View style={styles.iconContainer}>
        <Ionicons
          name={isLow ? 'warning' : 'newspaper'}
          size={22}
          color={isLow ? '#F59E0B' : '#3B82F6'}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, isLow && styles.titleWarning]}>
          {remaining > 0 ? `${remaining} articoli gratuiti rimanenti` : 'Prova gratuita terminata'}
        </Text>
        <Text style={styles.subtitle}>
          Visita oknews24.it per attivare l'abbonamento
        </Text>
      </View>
    </View>
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
