import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminStats } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

interface Stats {
  total_users: number;
  trial_users: number;
  subscribed_users: number;
  total_articles: number;
  total_feeds: number;
}

export default function StatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const response = await getAdminStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadStats();
  };

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed" size={48} color="#9CA3AF" />
          <Text style={styles.noAccessText}>Accesso non autorizzato</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Statistiche</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingSpinner fullScreen message="Caricamento statistiche..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistiche</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#3B82F6']}
          />
        }
      >
        {/* Users Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Utenti</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="people" size={32} color="#3B82F6" />
              <Text style={[styles.statValue, { color: '#3B82F6' }]}>
                {stats?.total_users || 0}
              </Text>
              <Text style={styles.statLabel}>Totale</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={32} color="#F59E0B" />
              <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                {stats?.trial_users || 0}
              </Text>
              <Text style={styles.statLabel}>In prova</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              <Text style={[styles.statValue, { color: '#10B981' }]}>
                {stats?.subscribed_users || 0}
              </Text>
              <Text style={styles.statLabel}>Abbonati</Text>
            </View>
          </View>
        </View>

        {/* Content Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contenuti</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCardLarge}>
              <View style={[styles.iconContainer, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="newspaper" size={28} color="#EF4444" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValueLarge}>{stats?.total_articles || 0}</Text>
                <Text style={styles.statLabelLarge}>Articoli totali</Text>
              </View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCardLarge}>
              <View style={[styles.iconContainer, { backgroundColor: '#E0E7FF' }]}>
                <Ionicons name="list" size={28} color="#6366F1" />
              </View>
              <View style={styles.statInfo}>
                <Text style={styles.statValueLarge}>{stats?.total_feeds || 0}</Text>
                <Text style={styles.statLabelLarge}>Feed RSS attivi</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Azioni rapide</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/users')}
          >
            <Ionicons name="people-outline" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>Gestisci utenti</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/feeds')}
          >
            <Ionicons name="newspaper-outline" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>Gestisci feed</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
  scrollContent: {
    padding: 16
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 12
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 4
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4
  },
  statsRow: {
    marginBottom: 12
  },
  statCardLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  statInfo: {
    marginLeft: 16
  },
  statValueLarge: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937'
  },
  statLabelLarge: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  actionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937'
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
  }
});
