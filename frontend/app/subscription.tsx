import React, { useState, useEffect } from 'react';
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
import { getPlans, subscribe, Plan } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SubscriptionScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await getPlans();
      setPlans(response.data.plans);
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSelectedPlan(planId);
    setIsSubscribing(true);

    try {
      await subscribe(planId);
      await refreshUser();

      Alert.alert(
        'Abbonamento attivato!',
        'Grazie per il tuo abbonamento. Ora hai accesso illimitato a tutte le notizie.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert(
        'Errore',
        error.response?.data?.detail || 'Si è verificato un errore'
      );
    } finally {
      setIsSubscribing(false);
      setSelectedPlan(null);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner fullScreen message="Caricamento piani..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abbonamento</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>OK</Text>
          </View>
          <Text style={styles.heroTitle}>Sblocca OKNews24</Text>
          <Text style={styles.heroSubtitle}>
            Accesso illimitato a tutte le notizie locali della Toscana
          </Text>
        </View>

        {/* Current Status */}
        {user && (
          <View style={styles.statusCard}>
            <Ionicons
              name={user.subscription_status === 'trial' ? 'time' : 'checkmark-circle'}
              size={24}
              color={user.subscription_status === 'trial' ? '#F59E0B' : '#10B981'}
            />
            <Text style={styles.statusText}>
              {user.subscription_status === 'trial'
                ? `Prova gratuita: ${5 - user.articles_read} articoli rimanenti`
                : user.subscription_status === 'expired'
                ? 'Abbonamento scaduto'
                : 'Abbonamento attivo'}
            </Text>
          </View>
        )}

        {/* Plans */}
        <View style={styles.plansContainer}>
          {plans.map((plan) => (
            <TouchableOpacity
              key={plan.plan_id}
              style={[
                styles.planCard,
                plan.plan_id === 'yearly' && styles.planCardHighlighted
              ]}
              onPress={() => handleSubscribe(plan.plan_id)}
              disabled={isSubscribing}
            >
              {plan.plan_id === 'yearly' && (
                <View style={styles.bestValueBadge}>
                  <Text style={styles.bestValueText}>RISPARMIA €12</Text>
                </View>
              )}
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.currency}>€</Text>
                <Text style={styles.price}>
                  {plan.plan_id === 'yearly' ? '3' : plan.price.toFixed(0)}
                </Text>
                <Text style={styles.period}>
                  /{plan.plan_id === 'yearly' ? 'mese' : 'mese'}
                </Text>
              </View>
              {plan.plan_id === 'yearly' && (
                <Text style={styles.yearlyPrice}>Fatturazione annuale: €36/anno</Text>
              )}
              <Text style={styles.planDescription}>{plan.description}</Text>
              <View style={[
                styles.subscribeButton,
                plan.plan_id === 'yearly' && styles.subscribeButtonHighlighted
              ]}>
                {isSubscribing && selectedPlan === plan.plan_id ? (
                  <LoadingSpinner />
                ) : (
                  <Text style={[
                    styles.subscribeButtonText,
                    plan.plan_id === 'yearly' && styles.subscribeButtonTextHighlighted
                  ]}>
                    Scegli questo piano
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

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
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Nota: Sistema di pagamento in fase di attivazione. L'abbonamento verrà attivato automaticamente per test.
        </Text>
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
    padding: 20
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
    marginBottom: 16
  },
  logoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center'
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24
  },
  statusText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#92400E'
  },
  plansContainer: {
    marginBottom: 24
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB'
  },
  planCardHighlighted: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF'
  },
  bestValueBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4
  },
  currency: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937'
  },
  price: {
    fontSize: 40,
    fontWeight: '700',
    color: '#1F2937'
  },
  period: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8
  },
  yearlyPrice: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8
  },
  planDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16
  },
  subscribeButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  subscribeButtonHighlighted: {
    backgroundColor: '#3B82F6'
  },
  subscribeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563'
  },
  subscribeButtonTextHighlighted: {
    color: '#FFFFFF'
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
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 18
  }
});
