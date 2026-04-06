import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { adminCreateUser, deduplicateArticles, refreshArticles } from '../../services/api';

export default function AdminTab() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserPlan, setNewUserPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [isCreating, setIsCreating] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed" size={48} color="#9CA3AF" />
          <Text style={[styles.noAccessText, { color: colors.textSecondary }]}>Accesso non autorizzato</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPassword) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    setIsCreating(true);
    try {
      await adminCreateUser({
        email: newUserEmail,
        name: newUserName,
        password: newUserPassword,
        subscription_plan: newUserPlan
      });
      Alert.alert('Successo', `Utente ${newUserEmail} creato con abbonamento ${newUserPlan}`);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setShowCreateUser(false);
    } catch (err: any) {
      Alert.alert('Errore', err.response?.data?.detail || 'Errore nella creazione utente');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      const res = await deduplicateArticles();
      Alert.alert('Successo', res.data.message);
    } catch (err: any) {
      Alert.alert('Errore', 'Errore nella deduplicazione');
    } finally {
      setIsDeduplicating(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Pannello Admin</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/admin/users')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="people" size={28} color="#3B82F6" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Gestione Utenti</Text>
              <Text style={[styles.menuDescription, { color: colors.textSecondary }]}>Visualizza e gestisci gli utenti registrati</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={() => setShowCreateUser(!showCreateUser)}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="person-add" size={28} color="#22C55E" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Crea Utente Abbonato</Text>
              <Text style={[styles.menuDescription, { color: colors.textSecondary }]}>Aggiungi un nuovo utente con abbonamento</Text>
            </View>
            <Ionicons name={showCreateUser ? 'chevron-down' : 'chevron-forward'} size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          {showCreateUser && (
            <View style={[styles.createUserForm, { backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Nome completo"
                placeholderTextColor={colors.textTertiary}
                value={newUserName}
                onChangeText={setNewUserName}
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={newUserEmail}
                onChangeText={setNewUserEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                placeholder="Password"
                placeholderTextColor={colors.textTertiary}
                value={newUserPassword}
                onChangeText={setNewUserPassword}
                secureTextEntry
              />
              <View style={styles.planSelector}>
                <TouchableOpacity
                  style={[styles.planOption, newUserPlan === 'monthly' && styles.planOptionActive]}
                  onPress={() => setNewUserPlan('monthly')}
                >
                  <Text style={[styles.planOptionText, newUserPlan === 'monthly' && styles.planOptionTextActive]}>
                    Mensile (4 EUR)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.planOption, newUserPlan === 'yearly' && styles.planOptionActive]}
                  onPress={() => setNewUserPlan('yearly')}
                >
                  <Text style={[styles.planOptionText, newUserPlan === 'yearly' && styles.planOptionTextActive]}>
                    Annuale (36 EUR)
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.createButton, isCreating && styles.buttonDisabled]}
                onPress={handleCreateUser}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Crea Utente</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/admin/feeds')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="newspaper" size={28} color="#F59E0B" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Gestione Feed RSS</Text>
              <Text style={[styles.menuDescription, { color: colors.textSecondary }]}>Aggiungi, modifica o rimuovi feed RSS</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/admin/stats')}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="stats-chart" size={28} color="#10B981" />
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Statistiche</Text>
              <Text style={[styles.menuDescription, { color: colors.textSecondary }]}>Visualizza le statistiche dell'app</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuCard, { backgroundColor: colors.card }]}
            onPress={handleDeduplicate}
            disabled={isDeduplicating}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
              {isDeduplicating ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <Ionicons name="trash-bin" size={28} color="#EF4444" />
              )}
            </View>
            <View style={styles.menuContent}>
              <Text style={[styles.menuTitle, { color: colors.text }]}>Rimuovi Duplicati</Text>
              <Text style={[styles.menuDescription, { color: colors.textSecondary }]}>Elimina articoli duplicati dal database</Text>
            </View>
          </TouchableOpacity>
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
  scrollContent: {
    paddingBottom: 24
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937'
  },
  menuContainer: {
    padding: 16
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  menuContent: {
    flex: 1,
    marginLeft: 16
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937'
  },
  menuDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  noAccessText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12
  },
  createUserForm: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12
  },
  planSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  planOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center'
  },
  planOptionActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF'
  },
  planOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280'
  },
  planOptionTextActive: {
    color: '#3B82F6'
  },
  createButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
