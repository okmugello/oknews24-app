import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  // Prova ad aggiungere /api alla fine se il 404 persiste
  baseURL: "https://oknews24-backend.onrender.com/api",
  timeout: 40000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add auth header to all requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface Article {
  article_id: string;
  feed_id: string;
  feed_name: string;
  title: string;
  description?: string;
  content?: string;
  link: string;
  image_url?: string;
  author?: string;
  pub_date?: string;
  created_at: string;
}

export interface Feed {
  feed_id: string;
  name: string;
  url: string;
  category: string;
  active: boolean;
  created_at: string;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  role: string;
  articles_read: number;
  subscription_status: string;
  subscription_end_date?: string;
  created_at: string;
}

export interface Plan {
  plan_id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  description: string;
  stripe_price_id?: string;
}

export interface PlansResponse {
  plans: Plan[];
  stripe_publishable_key: string;
}

// API Functions
export const initializeApp = () => api.post('/init/setup');

export const getArticles = (feedId?: string, limit?: number, skip?: number) => {
  const params: any = {};
  if (feedId) params.feed_id = feedId;
  if (limit) params.limit = limit;
  if (skip) params.skip = skip;
  return api.get<Article[]>('/articles', { params });
};

export const getArticle = (articleId: string) => 
  api.get<Article>(`/articles/${articleId}`);

// Saved Articles (Private)
export const getSavedArticlesApi = () =>
  api.get<Article[]>('/articles/saved');

export const saveArticleApi = (articleId: string) =>
  api.post(`/articles/save/${articleId}`);

export const unsaveArticleApi = (articleId: string) =>
  api.delete(`/articles/save/${articleId}`);

export const forgotPasswordApi = (email: string) =>
  api.post('/auth/forgot-password', { email });

export const resetPasswordApi = (token: string, newPassword: string) =>
  api.post('/auth/reset-password', { token, new_password: newPassword });

export const refreshArticles = () => api.post('/articles/refresh');

export const getFeeds = () => api.get<Feed[]>('/feeds');

export const createFeed = (data: { name: string; url: string; category?: string }) =>
  api.post<Feed>('/feeds', data);

export const updateFeed = (feedId: string, data: { name: string; url: string; category?: string }) =>
  api.put<Feed>(`/feeds/${feedId}`, data);

export const deleteFeed = (feedId: string) => api.delete(`/feeds/${feedId}`);

export const getPlans = () => api.get<PlansResponse>('/subscriptions/plans');

export const createCheckoutSession = (planType: string) => 
  api.post<{ checkout_url: string; session_id: string }>('/subscriptions/create-checkout-session', { plan_type: planType });

export const verifyCheckoutSession = (sessionId: string) =>
  api.get<{ success: boolean; plan_type?: string; status?: string; message?: string }>(`/subscriptions/verify-session/${sessionId}`);

export const cancelSubscription = () => api.post('/subscriptions/cancel');

export const getMySubscription = () => api.get('/subscriptions/my');

// Feed Preferences
export interface FeedPreferences {
  all_feeds: Feed[];
  enabled_feeds: string[];
  favorite_feed: string | null;
}

export const getFeedPreferences = () => api.get<FeedPreferences>('/user/feed-preferences');

export const updateFeedPreferences = (data: { enabled_feeds: string[]; favorite_feed?: string | null }) =>
  api.put('/user/feed-preferences', data);

export const getAdminUsers = (search?: string, limit?: number, skip?: number) => {
  const params: any = {};
  if (search) params.search = search;
  if (limit) params.limit = limit;
  if (skip) params.skip = skip;
  return api.get<{ users: User[]; total: number }>('/admin/users', { params });
};

export const updateUser = (userId: string, data: Partial<User>) =>
  api.put<User>(`/admin/users/${userId}`, data);

export const deleteUser = (userId: string) => api.delete(`/admin/users/${userId}`);

export const adminCreateUser = (data: { email: string; name: string; password: string; subscription_plan: string }) =>
  api.post('/admin/users/create', data);

export const deduplicateArticles = () => api.post('/admin/articles/deduplicate');

export const getAdminStats = () => api.get('/admin/stats');

export default api;
