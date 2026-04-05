import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import ArticleCard from '../../components/ArticleCard';
import SubscriptionBanner from '../../components/SubscriptionBanner';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getArticles, getFeeds, Article, Feed, refreshArticles } from '../../services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const renderFeedFilter = () => (
    <View style={styles.filterContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ feed_id: null, name: 'Tutte' }, ...feeds]}
        keyExtractor={(item) => item.feed_id || 'all'}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              (selectedFeed === item.feed_id || (!selectedFeed && !item.feed_id)) && styles.filterChipActive
            ]}
            onPress={() => setSelectedFeed(item.feed_id)}
          >
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
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoSmall}>
            <Text style={styles.logoSmallText}>OK</Text>
          </View>
          <Text style={styles.headerTitle}>OKNews24</Text>
        </View>
        {user?.role === 'admin' && (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefresh}
          >
            <Ionicons name="refresh" size={24} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>
      <SubscriptionBanner />
      {renderFeedFilter()}
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <LoadingSpinner fullScreen message="Caricamento notizie..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
  logoSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  logoSmallText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF'
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937'
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4
  },
  filterChipActive: {
    backgroundColor: '#3B82F6'
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
