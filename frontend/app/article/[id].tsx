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
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ArticleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    try {
      const response = await getArticle(id);
      setArticle(response.data);
      await refreshUser(); // Update user's article count
    } catch (err: any) {
      console.error('Error loading article:', err);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
        <LoadingSpinner fullScreen message="Caricamento articolo..." />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color="#F59E0B" />
          <Text style={styles.errorTitle}>Accesso limitato</Text>
          <Text style={styles.errorText}>{error}</Text>
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} onPress={handleOpenLink}>
          <Ionicons name="open-outline" size={24} color="#3B82F6" />
        </TouchableOpacity>
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
            <Text style={styles.date}>{formatDate(article.pub_date)}</Text>
          </View>

          <Text style={styles.title}>{article.title}</Text>

          {article.description && (
            <Text style={styles.description}>
              {removeHtmlTags(article.description)}
            </Text>
          )}

          {article.content && (
            <Text style={styles.content}>
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
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  shareButton: {
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
    fontSize: 13,
    color: '#6B7280'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    lineHeight: 32
  },
  description: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 26,
    marginBottom: 16,
    fontStyle: 'italic'
  },
  content: {
    fontSize: 16,
    color: '#374151',
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
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
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
