import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true
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

export const refreshArticles = () => api.post('/articles/refresh');

export const getFeeds = () => api.get<Feed[]>('/feeds');

export const createFeed = (data: { name: string; url: string; category?: string }) =>
  api.post<Feed>('/feeds', data);

export const updateFeed = (feedId: string, data: { name: string; url: string; category?: string }) =>
  api.put<Feed>(`/feeds/${feedId}`, data);

export const deleteFeed = (feedId: string) => api.delete(`/feeds/${feedId}`);

export const getPlans = () => api.get<{ plans: Plan[] }>('/subscriptions/plans');

export const subscribe = (planType: string) => 
  api.post('/subscriptions/subscribe', { plan_type: planType });

export const getMySubscription = () => api.get('/subscriptions/my');

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

export const getAdminStats = () => api.get('/admin/stats');

export default api;
