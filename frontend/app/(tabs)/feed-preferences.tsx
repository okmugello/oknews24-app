import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getFeedPreferences, updateFeedPreferences, Feed } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function FeedPreferencesScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [allFeeds, setAllFeeds] = useState<Feed[]>([]);
  const [enabledFeeds, setEnabledFeeds] = useState<string[]>([]);
  const [favoriteFeed, setFavoriteFeed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPreferences = async () => {
    try {
      const response = await getFeedPreferences();
      setAllFeeds(response.data.all_feeds);
      setEnabledFeeds(response.data.enabled_feeds);
      setFavoriteFeed(response.data.favorite_feed);
    } catch (error) {
      console.error('Error loading feed preferences:', error);
      Alert.alert('Errore', 'Impossibile caricare le preferenze');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadPreferences();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPreferences();
  };

  const toggleFeed = (feedId: string) => {
    setEnabledFeeds(prev => {
      if (prev.includes(feedId)) {
        // Remove feed - but ensure at least one is enabled
        const newEnabled = prev.filter(id => id !== feedId);
        if (newEnabled.length === 0) {
          Alert.alert('Attenzione', 'Devi mantenere almeno un feed attivo');
          return prev;
        }
        // If removing favorite feed, clear it
        if (favoriteFeed === feedId) {
          setFavoriteFeed(null);
        }
        return newEnabled;
      } else {
        // Add feed
        return [...prev, feedId];
      }
    });
  };

  const setAsFavorite = (feedId: string) => {
    if (!enabledFeeds.includes(feedId)) {
      Alert.alert('Attenzione', 'Devi prima attivare questo feed per impostarlo come preferito');
      return;
    }
    setFavoriteFeed(prev => prev === feedId ? null : feedId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFeedPreferences({
        enabled_feeds: enabledFeeds,
        favorite_feed: favoriteFeed
      });
      await refreshUser();
      Alert.alert('Successo', 'Preferenze salvate con successo');
      router.back();
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Errore', 'Impossibile salvare le preferenze');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preferenze Feed</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingSpinner fullScreen message="Caricamento preferenze..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferenze Feed</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <LoadingSpinner />
          ) : (
            <Text style={styles.saveButtonText}>Salva</Text>
          )}
        </TouchableOpacity>
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
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            Attiva i feed che vuoi vedere e scegli il tuo preferito come visualizzazione predefinita.
          </Text>
        </View>

        {/* Favorite Feed Section */}
        {favoriteFeed && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Feed Preferito</Text>
            <View style={styles.favoriteCard}>
              <Ionicons name="star" size={24} color="#F59E0B" />
              <Text style={styles.favoriteName}>
                {allFeeds.find(f => f.feed_id === favoriteFeed)?.name || 'Non impostato'}
              </Text>
              <TouchableOpacity onPress={() => setFavoriteFeed(null)}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Feed List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feed Disponibili</Text>
          {allFeeds.map((feed) => {
            const isEnabled = enabledFeeds.includes(feed.feed_id);
            const isFavorite = favoriteFeed === feed.feed_id;
            
            return (
              <View key={feed.feed_id} style={styles.feedCard}>
                <View style={styles.feedInfo}>
                  <View style={[
                    styles.feedIcon,
                    { backgroundColor: isEnabled ? '#EFF6FF' : '#F3F4F6' }
                  ]}>
                    <Ionicons 
                      name="newspaper" 
                      size={24} 
                      color={isEnabled ? '#3B82F6' : '#9CA3AF'} 
                    />
                  </View>
                  <View style={styles.feedDetails}>
                    <Text style={[
                      styles.feedName,
                      !isEnabled && styles.feedNameDisabled
                    ]}>
                      {feed.name}
                    </Text>
                    <Text style={styles.feedCategory}>{feed.category}</Text>
                  </View>
                </View>
                
                <View style={styles.feedActions}>
                  {/* Favorite Star */}
                  <TouchableOpacity 
                    style={styles.starButton}
                    onPress={() => setAsFavorite(feed.feed_id)}
                  >
                    <Ionicons 
                      name={isFavorite ? "star" : "star-outline"} 
                      size={24} 
                      color={isFavorite ? "#F59E0B" : "#D1D5DB"} 
                    />
                  </TouchableOpacity>
                  
                  {/* Enable/Disable Switch */}
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleFeed(feed.feed_id)}
                    trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                    thumbColor={isEnabled ? '#3B82F6' : '#F3F4F6'}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text style={styles.legendText}>Feed preferito (mostrato per primo)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSwitch} />
            <Text style={styles.legendText}>Attiva/disattiva feed</Text>
          </View>
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
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 8
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  scrollContent: {
    padding: 16
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18
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
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  favoriteName: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E'
  },
  feedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  feedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  feedIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  feedDetails: {
    marginLeft: 12,
    flex: 1
  },
  feedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937'
  },
  feedNameDisabled: {
    color: '#9CA3AF'
  },
  feedCategory: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    textTransform: 'capitalize'
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  starButton: {
    padding: 8,
    marginRight: 8
  },
  legend: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
    marginTop: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  legendSwitch: {
    width: 16,
    height: 10,
    backgroundColor: '#93C5FD',
    borderRadius: 5
  },
  legendText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#6B7280'
  }
});
