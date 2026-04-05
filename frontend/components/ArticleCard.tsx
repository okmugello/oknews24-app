import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Article } from '../services/api';

interface ArticleCardProps {
  article: Article;
  onPress: () => void;
}

export default function ArticleCard({ article, onPress }: ArticleCardProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd MMM yyyy, HH:mm', { locale: it });
    } catch {
      return '';
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {article.image_url && (
        <Image
          source={{ uri: article.image_url }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{article.feed_name}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        {article.description && (
          <Text style={styles.description} numberOfLines={2}>
            {article.description.replace(/<[^>]*>/g, '')}
          </Text>
        )}
        <View style={styles.footer}>
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.date}>{formatDate(article.pub_date)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#3B82F6" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
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
  image: {
    width: '100%',
    height: 180
  },
  content: {
    padding: 16
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8
  },
  categoryText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600'
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 24
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 20
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  date: {
    fontSize: 12,
    color: '#6B7280'
  }
});
