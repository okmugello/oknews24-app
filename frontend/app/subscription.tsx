import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { cancelSubscription } from '../services/api';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();

  const isSubscribed = user?.subscription_status === 'monthly' || user?.subscription_status === 'yearly';

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Annulla Abbonamento',
      'Sei sicuro di voler annullare il tuo abbonamento? Manterrai l\'accesso fino alla fine del periodo già pagato.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sì, annulla',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelSubscription();
              await refreshUser();
              Alert.alert('Abbonamento annullato', 'Il tuo abbonamento non verrà rinnovato alla scadenza.');
            } catch (error) {
              Alert.alert('Errore', 'Impossibile annullare l\'abbonamento. Riprova più tardi.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Il tuo abbonamento</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>OK</Text>
          </View>
          <Text style={styles.heroTitle}>OKNews24</Text>
          <Text style={styles.heroSubtitle}>
            Notizie locali dalla Toscana
          </Text>
        </View>

        {/* Current Status */}
        {user && (
          <View style={[
            styles.statusCard,
            isSubscribed ? styles.statusCardActive : styles.statusCardTrial
          ]}>
            <Ionicons
              name={isSubscribed ? 'checkmark-circle' : 'time'}
              size={24}
              color={isSubscribed ? '#10B981' : '#F59E0B'}
            />
            <Text style={[
              styles.statusText,
              isSubscribed ? styles.statusTextActive : styles.statusTextTrial
            ]}>
              {user.subscription_status === 'trial'
                ? `Prova gratuita: ${Math.max(0, 5 - user.articles_read)} articoli rimanenti`
                : user.subscription_status === 'expired'
                ? 'Abbonamento scaduto'
                : `Abbonamento ${user.subscription_status === 'monthly' ? 'mensile' : 'annuale'} attivo`}
            </Text>
          </View>
        )}

        {/* Info message for non-subscribed users */}
        {!isSubscribed && (
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={28} color="#3B82F6" style={styles.infoIcon} />
            <Text style={styles.infoTitle}>Come attivare l'abbonamento</Text>
            <Text style={styles.infoText}>
              Per attivare o gestire il tuo abbonamento, visita il nostro sito web:
            </Text>
            <View style={styles.websiteTag}>
              <Ionicons name="globe-outline" size={16} color="#3B82F6" />
              <Text style={styles.websiteText}>oknews24.it</Text>
            </View>
            <Text style={styles.infoNote}>
              Dopo aver attivato l'abbonamento sul sito, riavvia l'app o accedi nuovamente per aggiornare il tuo stato.
            </Text>
          </View>
        )}

        {/* Features */}
        <View style={styles.features}>
          <Text style={styles.featuresTitle}>Cosa include l'abbonamento</Text>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Accesso illimitato a tutte le notizie</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Notizie da OK Mugello, OK Firenze e OK Valdisieve</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Aggiornamenti in tempo reale</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.featureText}>Nessuna pubblicità</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="notifications" size={20} color="#3B82F6" />
            <Text style={styles.featureText}>Notifiche push per le ultime notizie</Text>
          </View>
        </View>

        {/* Cancel button for subscribed users */}
        {isSubscribed && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
          >
            <Text style={styles.cancelButtonText}>Annulla abbonamento</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937'
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center'
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20
  },
  statusCardTrial: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  statusCardActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  statusText: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600'
  },
  statusTextTrial: {
    color: '#92400E'
  },
  statusTextActive: {
    color: '#065F46'
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'center'
  },
  infoIcon: {
    marginBottom: 10
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 10,
    textAlign: 'center'
  },
  infoText: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 14
  },
  websiteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    marginBottom: 14
  },
  websiteText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3B82F6'
  },
  infoNote: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18
  },
  features: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  featureText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#4B5563'
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600'
  }
});
