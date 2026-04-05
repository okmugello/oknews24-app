import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminUsers, updateUser, deleteUser, User } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function UsersScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const loadUsers = useCallback(async () => {
    try {
      const response = await getAdminUsers(search || undefined);
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Errore', 'Impossibile caricare gli utenti');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadUsers();
  };

  const handleToggleAdmin = async (targetUser: User) => {
    const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
    
    Alert.alert(
      'Cambia ruolo',
      `Vuoi ${newRole === 'admin' ? 'promuovere' : 'rimuovere'} ${targetUser.name} ${newRole === 'admin' ? 'ad' : 'da'} admin?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Conferma',
          onPress: async () => {
            try {
              await updateUser(targetUser.user_id, { role: newRole });
              loadUsers();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile aggiornare il ruolo');
            }
          }
        }
      ]
    );
  };

  const handleToggleSubscription = async (targetUser: User) => {
    const options = ['trial', 'monthly', 'yearly', 'expired'];
    const currentIndex = options.indexOf(targetUser.subscription_status);
    const nextIndex = (currentIndex + 1) % options.length;
    const newStatus = options[nextIndex];

    try {
      await updateUser(targetUser.user_id, { subscription_status: newStatus });
      loadUsers();
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare l\'abbonamento');
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (targetUser.user_id === currentUser?.user_id) {
      Alert.alert('Errore', 'Non puoi eliminare il tuo account');
      return;
    }

    Alert.alert(
      'Elimina utente',
      `Sei sicuro di voler eliminare ${targetUser.name}?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUser(targetUser.user_id);
              loadUsers();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare l\'utente');
            }
          }
        }
      ]
    );
  };

  const getSubscriptionBadgeColor = (status: string) => {
    switch (status) {
      case 'monthly':
      case 'yearly':
        return '#10B981';
      case 'expired':
        return '#EF4444';
      default:
        return '#F59E0B';
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <View style={styles.avatarSmall}>
          <Text style={styles.avatarSmallText}>
            {item.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <View style={styles.userDetails}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{item.name}</Text>
            {item.role === 'admin' && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminBadgeText}>Admin</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userMeta}>
            <View style={[styles.statusBadge, { backgroundColor: getSubscriptionBadgeColor(item.subscription_status) + '20' }]}>
              <Text style={[styles.statusText, { color: getSubscriptionBadgeColor(item.subscription_status) }]}>
                {item.subscription_status}
              </Text>
            </View>
            <Text style={styles.articlesRead}>{item.articles_read} articoli</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleAdmin(item)}
        >
          <Ionicons
            name={item.role === 'admin' ? 'shield' : 'shield-outline'}
            size={20}
            color={item.role === 'admin' ? '#3B82F6' : '#6B7280'}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleToggleSubscription(item)}
        >
          <Ionicons name="card-outline" size={20} color="#6B7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteUser(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (currentUser?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed" size={48} color="#9CA3AF" />
          <Text style={styles.noAccessText}>Accesso non autorizzato</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Utenti ({total})</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca utenti..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9CA3AF"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={20} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Caricamento utenti..." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.user_id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Nessun utente trovato</Text>
            </View>
          }
        />
      )}
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
  backButton: {
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  searchInput: {
    flex: 1,
    height: 48,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12
  },
  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  avatarSmallText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  userDetails: {
    flex: 1,
    marginLeft: 12
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937'
  },
  adminBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8
  },
  adminBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6'
  },
  userEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600'
  },
  articlesRead: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 12
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12
  }
});
