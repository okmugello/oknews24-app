import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Switch,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, ThemeMode } from '../../contexts/ThemeContext';
import { getSavedArticles } from '../../services/offlineStorage';
import { deleteOwnAccount, getDevices, removeDevice, DeviceSession } from '../../services/api';
import { getDeviceId } from '../../utils/deviceId';

const FREE_ARTICLES_LIMIT = 5;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, isDark, colors, setMode, toggleTheme } = useTheme();
  const [savedCount, setSavedCount] = useState(0);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string>('');
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [removingDeviceId, setRemovingDeviceId] = useState<string | null>(null);

  useEffect(() => {
    loadSavedCount();
    loadDevices();
    getDeviceId().then(setCurrentDeviceId);
  }, []);

  const loadSavedCount = async () => {
    try {
      const saved = await getSavedArticles();
      setSavedCount(saved.length);
    } catch {}
  };

  const loadDevices = async () => {
    setDevicesLoading(true);
    try {
      const res = await getDevices();
      setDevices(res.data.devices || []);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleRemoveDevice = (deviceId: string, deviceName: string) => {
    Alert.alert(
      'Disconnetti dispositivo',
      `Vuoi disconnettere "${deviceName}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Disconnetti',
          style: 'destructive',
          onPress: async () => {
            setRemovingDeviceId(deviceId);
            try {
              await removeDevice(deviceId);
              setDevices(prev => prev.filter(d => d.device_id !== deviceId));
            } catch {
              Alert.alert('Errore', 'Impossibile disconnettere il dispositivo');
            } finally {
              setRemovingDeviceId(null);
            }
          }
        }
      ]
    );
  };

  const formatLastSeen = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // logout clears state regardless
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Elimina Account',
      'Questa azione è irreversibile. Verranno cancellati permanentemente il tuo account e tutti i tuoi dati (articoli salvati, preferenze, abbonamento).\n\nVuoi procedere?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await deleteOwnAccount();
              await logout();
            } catch (e) {
              setIsDeletingAccount(false);
              Alert.alert('Errore', 'Impossibile eliminare l\'account. Riprova più tardi.');
            }
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
            {(user?.subscription_status === 'trial' || user?.subscription_status === 'expired') && (
              <View style={styles.subscriptionInfoBox}>
                <Ionicons name="globe-outline" size={16} color="#3B82F6" />
                <Text style={styles.subscriptionInfoText}>
                  Visita oknews24.it per attivare l'abbonamento
                </Text>
              </View>
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
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="bookmark-outline" size={24} color="#10B981" />
              <Text style={styles.statValue}>{savedCount}</Text>
              <Text style={styles.statLabel}>Salvati offline</Text>
            </View>
          </View>
        </View>

        {/* User Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferenze</Text>
          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push('/(tabs)/saved-articles' as any)}
          >
            <Ionicons name="bookmark-outline" size={24} color={colors.textSecondary} />
            <Text style={[styles.menuItemText, { color: colors.text }]}>Articoli Salvati</Text>
            {savedCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{savedCount}</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
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

        {/* Dispositivi connessi */}
        {devices.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Dispositivi connessi</Text>
            {devicesLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 8 }} />
            ) : (
              devices.map((d) => {
                const isCurrent = d.device_id === currentDeviceId;
                return (
                  <View key={d.device_id} style={[styles.deviceRow, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={22}
                      color={isCurrent ? '#3B82F6' : '#6B7280'}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.deviceName, { color: colors.text }]}>
                        {d.device_name || 'Dispositivo'}
                        {isCurrent ? ' (questo)' : ''}
                      </Text>
                      <Text style={styles.deviceLastSeen}>
                        Ultimo accesso: {formatLastSeen(d.last_seen)}
                      </Text>
                    </View>
                    {!isCurrent && (
                      removingDeviceId === d.device_id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <TouchableOpacity onPress={() => handleRemoveDevice(d.device_id, d.device_name || 'Dispositivo')}>
                          <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Delete Account */}
        <TouchableOpacity
          style={styles.deleteAccountButton}
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
        >
          {isDeletingAccount ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          )}
          <Text style={styles.deleteAccountText}>
            {isDeletingAccount ? 'Eliminazione in corso...' : 'Elimina Account'}
          </Text>
        </TouchableOpacity>

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
  subscriptionInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 8
  },
  subscriptionInfoText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18
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
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4
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
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginHorizontal: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  deleteAccountText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 8
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
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
  },
  badge: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600'
  },
  deviceLastSeen: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2
  }
});
