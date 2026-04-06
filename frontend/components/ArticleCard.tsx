import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Article } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { isArticleSaved, saveArticleForOffline, removeOfflineArticle } from '../services/offlineStorage';

interface ArticleCardProps {
  article: Article;
  onPress: () => void;
  showRemove?: boolean;
  onRemove?: () => void;
}

export default function ArticleCard({ article, onPress, showRemove, onRemove }: ArticleCardProps) {
  const { colors } = useTheme();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    checkSaved();
  }, [article.article_id]);

  const checkSaved = async () => {
    const saved = await isArticleSaved(article.article_id);
    setIsSaved(saved);
  };

  const handleToggleSave = async () => {
    if (isSaved) {
      await removeOfflineArticle(article.article_id);
      setIsSaved(false);
      if (onRemove) onRemove();
    } else {
      await saveArticleForOffline(article);
      setIsSaved(true);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm', { locale: it });
    } catch {
      return '';
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: colors.card }]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      {article.image_url && (
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: article.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={[styles.bookmarkButton, isSaved && styles.bookmarkButtonActive]}
            onPress={handleToggleSave}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={isSaved ? '#FFFFFF' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{article.feed_name}</Text>
          </View>
          {!article.image_url && (
            <TouchableOpacity
              style={[styles.bookmarkButtonInline, isSaved && styles.bookmarkButtonInlineActive]}
              onPress={handleToggleSave}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={isSaved ? colors.primary : colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {article.title}
        </Text>
        {article.description && (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {article.description.replace(/<[^>]*>/g, '')}
          </Text>
        )}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            {article.author && (
              <View style={styles.authorContainer}>
                <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
                <Text style={[styles.authorText, { color: colors.textTertiary }]} numberOfLines={1}>{article.author}</Text>
              </View>
            )}
            <View style={styles.dateContainer}>
              <Ionicons name="time-outline" size={14} color={colors.textTertiary} />
              <Text style={[styles.date, { color: colors.textTertiary }]}>{formatDate(article.pub_date)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden'
  },
  imageContainer: {
    position: 'relative'
  },
  image: {
    width: '100%',
    height: 180
  },
  bookmarkButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bookmarkButtonActive: {
    backgroundColor: '#3B82F6'
  },
  content: {
    padding: 16
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  categoryText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600'
  },
  bookmarkButtonInline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bookmarkButtonInlineActive: {
    backgroundColor: '#EFF6FF'
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  footerLeft: {
    flex: 1,
    marginRight: 8
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4
  },
  authorText: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  date: {
    fontSize: 12
  }
});
