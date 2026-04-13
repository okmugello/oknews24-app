import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { getPlans, createCheckoutSession, verifyCheckoutSession, cancelSubscription, Plan } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, refreshUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    
    // Check for success/cancel from Stripe redirect
    if (params.success === 'true' && params.session_id) {
      verifyPayment(params.session_id as string);
    } else if (params.canceled === 'true') {
      setVerificationMessage('Pagamento annullato. Puoi riprovare quando vuoi.');
    }
  }, [params]);

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

  const verifyPayment = async (sessionId: string) => {
    setIsProcessing(true);
    try {
      const response = await verifyCheckoutSession(sessionId);
      if (response.data.success) {
        await refreshUser();
        setVerificationMessage('Pagamento completato con successo! Il tuo abbonamento è ora attivo.');
      } else {
        setVerificationMessage('Verifica del pagamento in corso. Ricarica tra qualche secondo.');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setVerificationMessage('Errore nella verifica del pagamento. Contatta il supporto se il problema persiste.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSelectedPlan(planId);
    setIsProcessing(true);

    try {
      // On mobile, use oknews24.it as redirect (we'll verify manually)
      // On web, use current origin for proper redirect
      let successUrl: string | undefined;
      let cancelUrl: string | undefined;
      if (Platform.OS !== 'web') {
        successUrl = 'https://oknews24.it/subscription?success=true&session_id={CHECKOUT_SESSION_ID}';
        cancelUrl = 'https://oknews24.it/subscription?canceled=true';
      }

      const response = await createCheckoutSession(planId, successUrl, cancelUrl);
      const checkoutUrl = response.data.checkout_url;
      const sessionId = response.data.session_id;
      
      if (checkoutUrl) {
        if (Platform.OS === 'web') {
          window.location.href = checkoutUrl;
        } else {
          const canOpen = await Linking.canOpenURL(checkoutUrl);
          if (canOpen) {
            await Linking.openURL(checkoutUrl);
            // Store session_id so user can verify manually after returning
            setPendingSessionId(sessionId);
            setVerificationMessage('Completa il pagamento nel browser, poi torna qui e premi "Verifica pagamento".');
          } else {
            Alert.alert('Errore', 'Impossibile aprire la pagina di pagamento');
          }
        }
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      Alert.alert(
        'Errore',
        error.response?.data?.detail || 'Impossibile avviare il pagamento. Riprova.'
      );
    } finally {
      setIsProcessing(false);
      setSelectedPlan(null);
    }
  };

  const handleVerifyManual = async () => {
    if (!pendingSessionId) return;
    setIsProcessing(true);
    try {
      const response = await verifyCheckoutSession(pendingSessionId);
      if (response.data.success) {
        await refreshUser();
        setPendingSessionId(null);
        setVerificationMessage('Pagamento completato con successo! Il tuo abbonamento è ora attivo.');
      } else {
        setVerificationMessage('Pagamento non ancora confermato. Completa il pagamento nel browser e riprova.');
      }
    } catch (error) {
      setVerificationMessage('Errore nella verifica. Riprova tra qualche secondo.');
    } finally {
      setIsProcessing(false);
    }
  };

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
              Alert.alert('Errore', 'Impossibile annullare l\'abbonamento');
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner fullScreen message="Caricamento piani..." />
      </SafeAreaView>
    );
  }

  const isSubscribed = user?.subscription_status === 'monthly' || user?.subscription_status === 'yearly';

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
        {/* Verification Message */}
        {verificationMessage && (
          <View style={[
            styles.messageCard,
            params.success === 'true' || verificationMessage.includes('successo') ? styles.successCard : styles.warningCard
          ]}>
            <Ionicons 
              name={params.success === 'true' || verificationMessage.includes('successo') ? 'checkmark-circle' : 'information-circle'} 
              size={24} 
              color={params.success === 'true' || verificationMessage.includes('successo') ? '#10B981' : '#F59E0B'} 
            />
            <Text style={styles.messageText}>{verificationMessage}</Text>
          </View>
        )}

        {/* Manual verification button for mobile */}
        {pendingSessionId && Platform.OS !== 'web' && (
          <TouchableOpacity
            style={styles.verifyButton}
            onPress={handleVerifyManual}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <LoadingSpinner />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.verifyButtonText}>Verifica pagamento</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>OK</Text>
          </View>
          <Text style={styles.heroTitle}>
            {isSubscribed ? 'Il tuo abbonamento' : 'Sblocca OKNews24'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isSubscribed 
              ? 'Grazie per il tuo supporto!' 
              : 'Accesso illimitato a tutte le notizie locali della Toscana'}
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
                ? `Prova gratuita: ${5 - user.articles_read} articoli rimanenti`
                : user.subscription_status === 'expired'
                ? 'Abbonamento scaduto'
                : `Abbonamento ${user.subscription_status === 'monthly' ? 'mensile' : 'annuale'} attivo`}
            </Text>
          </View>
        )}

        {/* Plans - Show only if not subscribed */}
        {!isSubscribed && (
          <View style={styles.plansContainer}>
            {plans.map((plan) => (
              <TouchableOpacity
                key={plan.plan_id}
                style={[
                  styles.planCard,
                  plan.plan_id === 'yearly' && styles.planCardHighlighted
                ]}
                onPress={() => handleSubscribe(plan.plan_id)}
                disabled={isProcessing}
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
                  <Text style={styles.period}>/mese</Text>
                </View>
                {plan.plan_id === 'yearly' && (
                  <Text style={styles.yearlyPrice}>Fatturazione annuale: €36/anno</Text>
                )}
                <Text style={styles.planDescription}>{plan.description}</Text>
                <View style={[
                  styles.subscribeButton,
                  plan.plan_id === 'yearly' && styles.subscribeButtonHighlighted
                ]}>
                  {isProcessing && selectedPlan === plan.plan_id ? (
                    <LoadingSpinner />
                  ) : (
                    <>
                      <Ionicons 
                        name="card" 
                        size={20} 
                        color={plan.plan_id === 'yearly' ? '#FFFFFF' : '#4B5563'} 
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[
                        styles.subscribeButtonText,
                        plan.plan_id === 'yearly' && styles.subscribeButtonTextHighlighted
                      ]}>
                        Paga con Stripe
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Cancel button for subscribed users */}
        {isSubscribed && (
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={handleCancelSubscription}
          >
            <Text style={styles.cancelButtonText}>Annulla abbonamento</Text>
          </TouchableOpacity>
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
            <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />
            <Text style={styles.featureText}>Pagamenti sicuri con Stripe</Text>
          </View>
        </View>

        {/* Stripe Badge */}
        <View style={styles.stripeBadge}>
          <Ionicons name="lock-closed" size={16} color="#6B7280" />
          <Text style={styles.stripeBadgeText}>Pagamenti sicuri gestiti da Stripe</Text>
        </View>
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
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24
  },
  successCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0'
  },
  warningCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  messageText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20
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
    padding: 16,
    borderRadius: 12,
    marginBottom: 24
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    borderRadius: 12
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
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600'
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
  stripeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12
  },
  stripeBadgeText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#6B7280'
  }
});
