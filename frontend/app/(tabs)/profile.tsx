import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';

const FREE_ARTICLES_LIMIT = 5;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, isDark, colors, setMode, toggleTheme } = useTheme();

  const handleLogout = () => {
    Alert.alert(
      'Esci',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)' as any);
          }
        }
      ]
    );
  };

  const handleThemeChange = () => {
    // Cycle through: system -> light -> dark -> system
    const nextMode: ThemeMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(nextMode);
  };

  const getThemeText = () => {
    switch (mode) {
      case 'system': return 'Automatico';
      case 'light': return 'Chiaro';
      case 'dark': return 'Scuro';
    }
  };

  const getThemeIcon = () => {
    switch (mode) {
      case 'system': return 'phone-portrait-outline';
      case 'light': return 'sunny-outline';
      case 'dark': return 'moon-outline';
    }
  };

  const getSubscriptionText = () => {
    switch (user?.subscription_status) {
      case 'trial':
        return `Prova gratuita (${FREE_ARTICLES_LIMIT - (user?.articles_read || 0)} articoli rimanenti)`;
      case 'monthly':
        return 'Abbonamento mensile attivo';
      case 'yearly':
        return 'Abbonamento annuale attivo';
      case 'expired':
        return 'Abbonamento scaduto';
      default:
        return 'Nessun abbonamento';
    }
  };

  const getSubscriptionColor = () => {
    switch (user?.subscription_status) {
      case 'monthly':
      case 'yearly':
        return '#10B981';
      case 'expired':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profilo</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          {user?.role === 'admin' && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>

        {/* Subscription Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abbonamento</Text>
          <View style={styles.subscriptionCard}>
            <View style={styles.subscriptionHeader}>
              <Ionicons
                name={user?.subscription_status === 'trial' ? 'time' : 'checkmark-circle'}
                size={24}
                color={getSubscriptionColor()}
              />
              <Text style={[styles.subscriptionStatus, { color: getSubscriptionColor() }]}>
                {getSubscriptionText()}
              </Text>
            </View>
            {user?.subscription_status === 'trial' || user?.subscription_status === 'expired' ? (
              <TouchableOpacity
                style={styles.subscribeButton}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.subscribeButtonText}>Abbonati ora</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.manageButton}
                onPress={() => router.push('/subscription')}
              >
                <Text style={styles.manageButtonText}>Gestisci abbonamento</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiche</Text>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Ionicons name="book-outline" size={24} color="#3B82F6" />
              <Text style={styles.statValue}>{user?.articles_read || 0}</Text>
              <Text style={styles.statLabel}>Articoli letti</Text>
            </View>
          </View>
        </View>

        {/* User Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferenze</Text>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/(tabs)/feed-preferences' as any)}
          >
            <Ionicons name="newspaper-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Gestione Feed</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
          
          {/* Theme Toggle */}
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={handleThemeChange}
          >
            <Ionicons name={getThemeIcon() as any} size={24} color={colors.textSecondary} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Tema: {getThemeText()}</Text>
            <View style={styles.themeToggle}>
              <Ionicons 
                name={isDark ? "moon" : "sunny"} 
                size={20} 
                color={isDark ? "#F59E0B" : "#3B82F6"} 
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Admin Menu */}
        {user?.role === 'admin' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amministrazione</Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/admin/users')}
            >
              <Ionicons name="people-outline" size={24} color="#4B5563" />
              <Text style={styles.menuItemText}>Gestione Utenti</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/admin/feeds')}
            >
              <Ionicons name="list-outline" size={24} color="#4B5563" />
              <Text style={styles.menuItemText}>Gestione Feed RSS</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/admin/stats')}
            >
              <Ionicons name="stats-chart-outline" size={24} color="#4B5563" />
              <Text style={styles.menuItemText}>Statistiche</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
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
  profileCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 24,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  avatarContainer: {
    marginBottom: 16
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937'
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12
  },
  adminBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4
  },
  section: {
    marginTop: 24,
    marginHorizontal: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  subscriptionStatus: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  },
  subscribeButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  manageButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  manageButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600'
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  statItem: {
    flex: 1,
    alignItems: 'center'
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4
  },
  menuItem: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12
  },
  themeToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: '#FEE2E2',
    borderRadius: 12
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8
  }
});
