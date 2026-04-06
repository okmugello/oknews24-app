import AsyncStorage from '@react-native-async-storage/async-storage';
import { Article, Feed } from './api';

const CACHE_KEYS = {
  ARTICLES: 'cached_articles',
  FEEDS: 'cached_feeds',
  SAVED_ARTICLES: 'saved_articles',
  LAST_SYNC: 'last_sync_time'
};

const CACHE_EXPIRY = 1000 * 60 * 30; // 30 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

// Generic cache functions
async function getCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(key);
    if (!cached) return null;
    
    const parsed: CachedData<T> = JSON.parse(cached);
    const isExpired = Date.now() - parsed.timestamp > CACHE_EXPIRY;
    
    if (isExpired) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now()
    };
    await AsyncStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

// Articles caching
export async function getCachedArticles(): Promise<Article[] | null> {
  return getCache<Article[]>(CACHE_KEYS.ARTICLES);
}

export async function cacheArticles(articles: Article[]): Promise<void> {
  return setCache(CACHE_KEYS.ARTICLES, articles);
}

// Feeds caching
export async function getCachedFeeds(): Promise<Feed[] | null> {
  return getCache<Feed[]>(CACHE_KEYS.FEEDS);
}

export async function cacheFeeds(feeds: Feed[]): Promise<void> {
  return setCache(CACHE_KEYS.FEEDS, feeds);
}

// Saved articles for offline reading (no expiry)
export async function getSavedArticles(): Promise<Article[]> {
  try {
    const saved = await AsyncStorage.getItem(CACHE_KEYS.SAVED_ARTICLES);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch (error) {
    console.error('Error getting saved articles:', error);
    return [];
  }
}

export async function saveArticleForOffline(article: Article): Promise<void> {
  try {
    const saved = await getSavedArticles();
    
    // Check if already saved
    if (saved.some(a => a.article_id === article.article_id)) {
      return;
    }
    
    // Add to saved list (max 50 articles)
    const updated = [article, ...saved].slice(0, 50);
    await AsyncStorage.setItem(CACHE_KEYS.SAVED_ARTICLES, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving article:', error);
  }
}

export async function removeOfflineArticle(articleId: string): Promise<void> {
  try {
    const saved = await getSavedArticles();
    const updated = saved.filter(a => a.article_id !== articleId);
    await AsyncStorage.setItem(CACHE_KEYS.SAVED_ARTICLES, JSON.stringify(updated));
  } catch (error) {
    console.error('Error removing article:', error);
  }
}

export async function isArticleSaved(articleId: string): Promise<boolean> {
  const saved = await getSavedArticles();
  return saved.some(a => a.article_id === articleId);
}

// Clear all cache
export async function clearAllCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.ARTICLES,
      CACHE_KEYS.FEEDS,
      CACHE_KEYS.LAST_SYNC
    ]);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

// Get last sync time
export async function getLastSyncTime(): Promise<Date | null> {
  try {
    const time = await AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC);
    return time ? new Date(parseInt(time)) : null;
  } catch {
    return null;
  }
}

export async function setLastSyncTime(): Promise<void> {
  await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
}

// Get cache size (approximate)
export async function getCacheSize(): Promise<string> {
  try {
    const articles = await AsyncStorage.getItem(CACHE_KEYS.ARTICLES);
    const feeds = await AsyncStorage.getItem(CACHE_KEYS.FEEDS);
    const saved = await AsyncStorage.getItem(CACHE_KEYS.SAVED_ARTICLES);
    
    const totalBytes = (articles?.length || 0) + (feeds?.length || 0) + (saved?.length || 0);
    
    if (totalBytes < 1024) return `${totalBytes} B`;
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
  } catch {
    return '0 B';
  }
}
