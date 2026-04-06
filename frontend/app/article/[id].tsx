import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { getArticle, Article } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isArticleSaved, saveArticleForOffline, removeOfflineArticle, getSavedArticles } from '../../services/offlineStorage';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ArticleDetail() {
  const { id, offline } = useLocalSearchParams<{ id: string; offline?: string }>();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    // Check if we should load from offline storage
    if (offline === 'true') {
      try {
        const savedArticles = await getSavedArticles();
        const found = savedArticles.find(a => a.article_id === id);
        if (found) {
          setArticle(found);
          setIsSaved(true);
        } else {
          setError('Articolo offline non trovato');
        }
      } catch (err) {
        setError('Errore nel caricamento offline');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await getArticle(id);
      setArticle(response.data);
      const saved = await isArticleSaved(id);
      setIsSaved(saved);
      await refreshUser();
    } catch (err: any) {
      console.error('Error loading article:', err);
      // Try loading from offline cache as fallback
      try {
        const savedArticles = await getSavedArticles();
        const found = savedArticles.find(a => a.article_id === id);
        if (found) {
          setArticle(found);
          setIsSaved(true);
          return;
        }
      } catch {}
      
      if (err.response?.status === 403) {
        setError(err.response.data.detail);
      } else if (err.response?.status === 401) {
        setError('Accedi per leggere questo articolo');
      } else {
        setError('Impossibile caricare l\'articolo');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!article) return;
    if (isSaved) {
      await removeOfflineArticle(article.article_id);
      setIsSaved(false);
    } else {
      await saveArticleForOffline(article);
      setIsSaved(true);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: it });
    } catch {
      return '';
    }
  };

  const handleOpenLink = () => {
    if (article?.link) {
      Linking.openURL(article.link);
    }
  };

  const removeHtmlTags = (html: string) => {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <LoadingSpinner fullScreen message="Caricamento articolo..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color="#F59E0B" />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Accesso limitato</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          {user?.subscription_status === 'trial' || user?.subscription_status === 'expired' ? (
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={() => router.push('/subscription')}
            >
              <Text style={styles.subscribeButtonText}>Abbonati ora</Text>
            </TouchableOpacity>
          ) : !user ? (
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={() => router.replace('/(auth)/login')}
            >
              <Text style={styles.subscribeButtonText}>Accedi</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (!article) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleToggleSave}>
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={isSaved ? colors.primary : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleOpenLink}>
            <Ionicons name="open-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {article.image_url && (
          <Image
            source={{ uri: article.image_url }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        <View style={styles.articleContent}>
          <View style={styles.meta}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{article.feed_name}</Text>
            </View>
            <Text style={[styles.date, { color: colors.textTertiary }]}>{formatDate(article.pub_date)}</Text>
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{article.title}</Text>

          {offline === 'true' && (
            <View style={styles.offlineBadge}>
              <Ionicons name="cloud-offline-outline" size={14} color="#F59E0B" />
              <Text style={styles.offlineBadgeText}>Lettura offline</Text>
            </View>
          )}

          {article.description && (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {removeHtmlTags(article.description)}
            </Text>
          )}

          {article.content && (
            <Text style={[styles.contentText, { color: colors.text }]}>
              {removeHtmlTags(article.content)}
            </Text>
          )}

          <TouchableOpacity style={styles.readMoreButton} onPress={handleOpenLink}>
            <Text style={styles.readMoreText}>Leggi l'articolo completo</Text>
            <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  scrollContent: {
    paddingBottom: 32
  },
  heroImage: {
    width: '100%',
    height: 250
  },
  articleContent: {
    padding: 20
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  categoryText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600'
  },
  date: {
    fontSize: 13
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    lineHeight: 32
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
    alignSelf: 'flex-start'
  },
  offlineBadgeText: {
    marginLeft: 6,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500'
  },
  description: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: 16,
    fontStyle: 'italic'
  },
  contentText: {
    fontSize: 16,
    lineHeight: 28
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 24
  },
  readMoreText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24
  },
  subscribeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
