import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
  Platform,
  useWindowDimensions,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { getArticle, Article, getArticleGallery } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { isArticleSaved, saveOfflineArticle, removeOfflineArticle, getSavedArticles } from '../../services/offlineStorage';
import LoadingSpinner from '../../components/LoadingSpinner';

let WebView: any = null;
try {
  if (Platform.OS !== 'web') {
    WebView = require('react-native-webview').default;
  }
} catch {}

interface ParsedLink {
  href: string;
  text: string;
}

interface ParsedEmbed {
  type: string;
  url: string;
  html: string;
}

function extractLinks(html: string): ParsedLink[] {
  if (!html) return [];
  const links: ParsedLink[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (href && text && href.startsWith('http')) {
      links.push({ href, text });
    }
  }
  return links;
}

function extractEmbeds(html: string): { cleanText: string; embeds: ParsedEmbed[] } {
  const embeds: ParsedEmbed[] = [];
  if (!html) return { cleanText: '', embeds };

  const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*(?:\/>|>[^<]*<\/iframe>)/gi;
  let match;
  while ((match = iframeRegex.exec(html)) !== null) {
    const src = match[1];
    let type = 'embed';
    if (src.includes('youtube') || src.includes('youtu.be')) type = 'youtube';
    else if (src.includes('vimeo')) type = 'vimeo';
    else if (src.includes('spotify')) type = 'spotify';
    else if (src.includes('soundcloud')) type = 'soundcloud';
    embeds.push({ type, url: src, html: match[0] });
  }

  const videoRegex = /<video[^>]*>[\s\S]*?<\/video>/gi;
  while ((match = videoRegex.exec(html)) !== null) {
    const srcMatch = match[0].match(/src=["']([^"']+)["']/);
    if (srcMatch) {
      embeds.push({ type: 'video', url: srcMatch[1], html: match[0] });
    }
  }

  const audioRegex = /<audio[^>]*>[\s\S]*?<\/audio>/gi;
  while ((match = audioRegex.exec(html)) !== null) {
    const srcMatch = match[0].match(/src=["']([^"']+)["']/);
    if (srcMatch) {
      embeds.push({ type: 'audio', url: srcMatch[1], html: match[0] });
    }
  }

  const cleanText = html
    .replace(/<iframe[^>]*(?:\/>|>[\s\S]*?<\/iframe>)/gi, '')
    .replace(/<video[^>]*>[\s\S]*?<\/video>/gi, '')
    .replace(/<audio[^>]*>[\s\S]*?<\/audio>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '…')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanText, embeds };
}

function extractInlineImages(html: string, heroImageUrl?: string): string[] {
  if (!html) return [];
  const imgs: string[] = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const src = match[1];
    if (
      src.startsWith('http') &&
      !src.toLowerCase().includes('placeholder') &&
      !src.toLowerCase().includes('pixel') &&
      !src.toLowerCase().includes('gravatar') &&
      src !== heroImageUrl
    ) {
      imgs.push(src);
    }
  }
  return imgs;
}

export default function ArticleDetail() {
  const { id, offline } = useLocalSearchParams<{ id: string; offline?: string }>();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [embedHeights, setEmbedHeights] = useState<{ [key: number]: number }>({});
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);

  useEffect(() => {
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
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
      loadGallery(id);
    } catch (err: any) {
      console.error('Error loading article:', err);
      try {
        const savedArticles = await getSavedArticles();
        const found = savedArticles.find(a => a.article_id === id);
        if (found) {
          setArticle(found);
          setIsSaved(true);
          return;
        }
      } catch {}

      if (err.response?.status === 403 || err.response?.status === 402) {
        setError(err.response.data.detail);
      } else if (err.response?.status === 401) {
        setError('Accedi per leggere questo articolo');
      } else {
        setError("Impossibile caricare l'articolo");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadGallery = async (articleId: string) => {
    try {
      setGalleryLoading(true);
      const res = await getArticleGallery(articleId);
      if (res.data.images && res.data.images.length > 0) {
        setGalleryImages(res.data.images);
      }
    } catch {
    } finally {
      setGalleryLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!article) return;
    if (isSaved) {
      await removeOfflineArticle(article.article_id);
      setIsSaved(false);
    } else {
      await saveOfflineArticle(article);
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

  const handleOpenLink = (url?: string) => {
    const target = url || article?.link;
    if (target) {
      Linking.openURL(target).catch(() => {
        Alert.alert('Errore', 'Impossibile aprire il link');
      });
    }
  };

  const renderEmbed = (embed: ParsedEmbed, index: number) => {
    const embedWidth = width - 40;
    const embedHeight = embedHeights[index] || (embed.type === 'youtube' || embed.type === 'vimeo' ? Math.round(embedWidth * 9 / 16) : 200);

    if (Platform.OS === 'web') {
      const iframeSrc = embed.url.startsWith('//') ? `https:${embed.url}` : embed.url;
      return (
        <View key={index} style={[styles.embedContainer, { backgroundColor: colors.background }]}>
          <View style={styles.embedLabel}>
            <Ionicons
              name={embed.type === 'youtube' ? 'logo-youtube' : embed.type === 'spotify' ? 'musical-notes' : 'play-circle'}
              size={16}
              color="#EF4444"
            />
            <Text style={[styles.embedLabelText, { color: colors.textSecondary }]}>
              {embed.type === 'youtube' ? 'Video YouTube' : embed.type === 'spotify' ? 'Podcast Spotify' : 'Media'}
            </Text>
          </View>
          <TouchableOpacity style={styles.embedPlayButton} onPress={() => handleOpenLink(iframeSrc)}>
            <Ionicons name="open-outline" size={20} color="#3B82F6" />
            <Text style={styles.embedPlayText}>Apri nel browser</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (WebView) {
      const htmlContent = `
        <!DOCTYPE html>
        <html><head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <style>
            body { margin: 0; padding: 0; background: transparent; }
            iframe, video, audio { width: 100% !important; max-width: 100%; border: none; }
            iframe { height: ${embedHeight}px; }
          </style>
        </head><body>${embed.html}</body></html>
      `;
      return (
        <View key={index} style={[styles.embedContainer, { backgroundColor: colors.background }]}>
          <View style={styles.embedLabel}>
            <Ionicons
              name={embed.type === 'youtube' ? 'logo-youtube' : embed.type === 'spotify' ? 'musical-notes' : 'play-circle'}
              size={16}
              color="#EF4444"
            />
            <Text style={[styles.embedLabelText, { color: colors.textSecondary }]}>
              {embed.type === 'youtube' ? 'Video YouTube' : embed.type === 'spotify' ? 'Podcast Spotify' : 'Media'}
            </Text>
          </View>
          <WebView
            source={{ html: htmlContent }}
            style={{ width: embedWidth, height: embedHeight, backgroundColor: 'transparent' }}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled={true}
            scrollEnabled={false}
          />
        </View>
      );
    }

    return null;
  };

  const renderGallery = (images: string[]) => {
    if (!images || images.length === 0) return null;
    const thumbSize = Math.min(width - 40, 280);

    return (
      <View style={styles.gallerySection}>
        <View style={styles.gallerySectionHeader}>
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={[styles.gallerySectionTitle, { color: colors.text }]}>
            Galleria foto ({images.length})
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.galleryScroll}
        >
          {images.map((src, i) => (
            <TouchableOpacity key={i} onPress={() => handleOpenLink(src)} activeOpacity={0.85}>
              <Image
                source={{ uri: src }}
                style={[styles.galleryThumb, { width: thumbSize, height: Math.round(thumbSize * 0.65) }]}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderLinks = (links: ParsedLink[]) => {
    if (!links || links.length === 0) return null;
    return (
      <View style={[styles.linksSection, { borderTopColor: colors.border }]}>
        <View style={styles.linksSectionHeader}>
          <Ionicons name="link-outline" size={18} color={colors.primary} />
          <Text style={[styles.linksSectionTitle, { color: colors.text }]}>
            Link correlati
          </Text>
        </View>
        {links.map((link, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.linkItem, { borderBottomColor: colors.border }]}
            onPress={() => handleOpenLink(link.href)}
            activeOpacity={0.7}
          >
            <Ionicons name="open-outline" size={16} color="#3B82F6" style={{ marginRight: 8, flexShrink: 0 }} />
            <Text style={styles.linkText} numberOfLines={2}>
              {link.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
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
            <TouchableOpacity style={styles.subscribeButton} onPress={() => router.push('/subscription')}>
              <Text style={styles.subscribeButtonText}>Abbonati ora</Text>
            </TouchableOpacity>
          ) : !user ? (
            <TouchableOpacity style={styles.subscribeButton} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.subscribeButtonText}>Accedi</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (!article) return null;

  const { cleanText: descCleanText } = extractEmbeds(article.description || '');
  const { cleanText: contentCleanText, embeds } = extractEmbeds(article.content || '');
  const contentLinks = extractLinks(article.content || '');
  const inlineImages = extractInlineImages(article.content || '', article.image_url);
  const allGalleryImages = galleryImages.length > 0 ? galleryImages : inlineImages;

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
          <TouchableOpacity style={styles.actionButton} onPress={() => handleOpenLink()}>
            <Ionicons name="open-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {article.image_url && (
          <Image source={{ uri: article.image_url }} style={styles.heroImage} resizeMode="cover" />
        )}

        <View style={styles.articleContent}>
          {article.author && (
            <View style={[styles.authorBar, { borderBottomColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.authorName, { color: colors.text }]}>{article.author}</Text>
            </View>
          )}

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

          {descCleanText ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {descCleanText}
            </Text>
          ) : null}

          {contentCleanText ? (
            <Text style={[styles.contentText, { color: colors.text }]}>
              {contentCleanText}
            </Text>
          ) : null}

          {embeds.map((embed, i) => renderEmbed(embed, i))}

          {/* Galleria immagini */}
          {galleryLoading ? (
            <View style={styles.galleryLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.galleryLoadingText, { color: colors.textSecondary }]}>
                Caricamento galleria...
              </Text>
            </View>
          ) : allGalleryImages.length > 0 ? (
            renderGallery(allGalleryImages)
          ) : null}

          {/* Link correlati */}
          {contentLinks.length > 0 && renderLinks(contentLinks)}

          <TouchableOpacity style={styles.readMoreButton} onPress={() => handleOpenLink()}>
            <Text style={styles.readMoreText}>Leggi l'articolo completo</Text>
            <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 40 },
  heroImage: { width: '100%', height: 250 },
  articleContent: { padding: 20 },
  authorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1
  },
  authorName: { fontSize: 15, fontWeight: '600', marginLeft: 8 },
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
  categoryText: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },
  date: { fontSize: 13 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16, lineHeight: 32 },
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
  offlineBadgeText: { marginLeft: 6, fontSize: 13, color: '#92400E', fontWeight: '500' },
  description: { fontSize: 16, lineHeight: 26, marginBottom: 16, fontStyle: 'italic' },
  contentText: { fontSize: 16, lineHeight: 28, marginBottom: 16 },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 24
  },
  readMoreText: { color: '#3B82F6', fontSize: 16, fontWeight: '600', marginRight: 8 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  errorText: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  subscribeButton: { backgroundColor: '#3B82F6', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  subscribeButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  embedContainer: { marginVertical: 12, borderRadius: 12, padding: 12, overflow: 'hidden' },
  embedLabel: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  embedLabelText: { fontSize: 13, fontWeight: '500', marginLeft: 6 },
  embedPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderRadius: 10
  },
  embedPlayText: { color: '#3B82F6', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  gallerySection: { marginTop: 24, marginBottom: 8 },
  gallerySectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  gallerySectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  galleryScroll: { paddingRight: 8 },
  galleryThumb: {
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden'
  },
  galleryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20
  },
  galleryLoadingText: { fontSize: 14, marginLeft: 8 },
  linksSection: { marginTop: 24, paddingTop: 16, borderTopWidth: 1 },
  linksSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  linksSectionTitle: { fontSize: 16, fontWeight: '700', marginLeft: 8 },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  linkText: { color: '#3B82F6', fontSize: 14, flex: 1, lineHeight: 20 }
});
