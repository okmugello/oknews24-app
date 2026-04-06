import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Article } from '../../services/api';
import { getSavedArticles, removeOfflineArticle, getCacheSize, clearAllCache } from '../../services/offlineStorage';
import ArticleCard from '../../components/ArticleCard';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function SavedArticlesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cacheSize, setCacheSize] = useState('0 B');

  const loadSavedArticles = useCallback(async () => {
    try {
      const saved = await getSavedArticles();
      setArticles(saved);
      const size = await getCacheSize();
      setCacheSize(size);
    } catch (error) {
      console.error('Error loading saved articles:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSavedArticles();
  }, [loadSavedArticles]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadSavedArticles();
  };

  const handleRemoveArticle = (articleId: string) => {
    Alert.alert(
      'Rimuovi articolo',
      'Vuoi rimuovere questo articolo dai salvati?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            await removeOfflineArticle(articleId);
            loadSavedArticles();
          }
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Svuota cache',
      'Vuoi eliminare tutti gli articoli salvati e la cache?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Svuota',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            loadSavedArticles();
          }
        }
      ]
    );
  };

  const handleArticlePress = (article: Article) => {
    // For saved articles, navigate to a local view
    router.push({
      pathname: '/article/[id]',
      params: { id: article.article_id, offline: 'true' }
    });
  };

  const renderArticle = ({ item }: { item: Article }) => (
    <View style={styles.articleWrapper}>
      <ArticleCard article={item} onPress={() => handleArticlePress(item)} />
      <TouchableOpacity
        style={[styles.removeButton, { backgroundColor: colors.error + '20' }]}
        onPress={() => handleRemoveArticle(item.article_id)}
      >
        <Ionicons name="trash-outline" size={20} color={colors.error} />
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Articoli Salvati</Text>
          <View style={{ width: 44 }} />
        </View>
        <LoadingSpinner fullScreen message="Caricamento..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Articoli Salvati</Text>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearCache}>
          <Ionicons name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Cache Info */}
      <View style={[styles.cacheInfo, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Ionicons name="cloud-download-outline" size={18} color={colors.textTertiary} />
        <Text style={[styles.cacheText, { color: colors.textTertiary }]}>
          {articles.length} articoli salvati • {cacheSize} utilizzati
        </Text>
      </View>

      <FlatList
        data={articles}
        keyExtractor={(item) => item.article_id}
        renderItem={renderArticle}
        contentContainerStyle={articles.length === 0 ? styles.emptyList : styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="bookmark-outline" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Nessun articolo salvato
            </Text>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Salva gli articoli per leggerli offline toccando l'icona segnalibro
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  clearButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  cacheText: {
    marginLeft: 8,
    fontSize: 13
  },
  list: {
    paddingBottom: 20
  },
  articleWrapper: {
    position: 'relative'
  },
  removeButton: {
    position: 'absolute',
    top: 16,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyList: {
    flexGrow: 1
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  }
});
