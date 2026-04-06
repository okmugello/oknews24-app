import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ArticleCard from '../../components/ArticleCard';
import SubscriptionBanner from '../../components/SubscriptionBanner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getArticles, getFeeds, Article, Feed, refreshArticles, getFeedPreferences } from '../../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const [articles, setArticles] = useState<Article[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [enabledFeeds, setEnabledFeeds] = useState<string[]>([]);
  const [favoriteFeed, setFavoriteFeed] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);

  // Load user preferences
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getFeedPreferences();
      setEnabledFeeds(response.data.enabled_feeds);
      setFavoriteFeed(response.data.favorite_feed);
      // Set favorite feed as default selection if not already selected
      if (!preferencesLoaded && response.data.favorite_feed) {
        setSelectedFeed(response.data.favorite_feed);
      }
      setPreferencesLoaded(true);
    } catch (error) {
      console.log('Could not load feed preferences:', error);
      setPreferencesLoaded(true);
    }
  }, [user, preferencesLoaded]);

  const loadData = useCallback(async () => {
    try {
      const [articlesRes, feedsRes] = await Promise.all([
        getArticles(selectedFeed || undefined),
        getFeeds()
      ]);
      setArticles(articlesRes.data);
      setFeeds(feedsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedFeed]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (user?.role === 'admin') {
      try {
        await refreshArticles();
      } catch (error) {
        console.log('Refresh articles error:', error);
      }
    }
    await loadData();
    await refreshUser();
  };

  const handleArticlePress = (article: Article) => {
    router.push(`/article/${article.article_id}`);
  };

  // Filter feeds based on user preferences
  const visibleFeeds = enabledFeeds.length > 0 
    ? feeds.filter(f => enabledFeeds.includes(f.feed_id))
    : feeds;

  // Sort feeds to put favorite first
  const sortedFeeds = [...visibleFeeds].sort((a, b) => {
    if (a.feed_id === favoriteFeed) return -1;
    if (b.feed_id === favoriteFeed) return 1;
    return 0;
  });

  const renderFeedFilter = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ feed_id: null, name: 'Tutte' }, ...sortedFeeds]}
        keyExtractor={(item) => item.feed_id || 'all'}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              (selectedFeed === item.feed_id || (!selectedFeed && !item.feed_id)) && styles.filterChipActive,
              item.feed_id === favoriteFeed && styles.filterChipFavorite
            ]}
            onPress={() => setSelectedFeed(item.feed_id)}
          >
            {item.feed_id === favoriteFeed && (
              <Ionicons name="star" size={12} color="#F59E0B" style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.filterChipText,
                (selectedFeed === item.feed_id || (!selectedFeed && !item.feed_id)) && styles.filterChipTextActive
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.filterList}
      />
    </View>
  );

  const renderHeader = () => (
    <View>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <Image 
            source={require('../../assets/images/oknews24-logo.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        {user?.role === 'admin' && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
      <SubscriptionBanner />
      {renderFeedFilter()}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader()}
        <LoadingSpinner fullScreen message="Caricamento notizie..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={articles}
        keyExtractor={(item) => item.article_id}
        renderItem={({ item }) => (
          <ArticleCard
            article={item}
            onPress={() => handleArticlePress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Nessuna notizia disponibile</Text>
            {user?.role === 'admin' && (
              <TouchableOpacity style={styles.refreshArticlesButton} onPress={handleRefresh}>
                <Text style={styles.refreshArticlesButtonText}>Aggiorna feed</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={['#3B82F6']}
          />
        }
        contentContainerStyle={articles.length === 0 ? styles.emptyList : undefined}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logo: {
    width: 140,
    height: 40
  },
  refreshButton: {
    padding: 8
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  filterList: {
    paddingHorizontal: 12
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4
  },
  filterChipActive: {
    backgroundColor: '#3B82F6'
  },
  filterChipFavorite: {
    borderWidth: 1,
    borderColor: '#F59E0B'
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563'
  },
  filterChipTextActive: {
    color: '#FFFFFF'
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
    marginTop: 16
  },
  emptyList: {
    flexGrow: 1
  },
  refreshArticlesButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8
  },
  refreshArticlesButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  }
});
