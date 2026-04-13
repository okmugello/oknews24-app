import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isAuthenticated = !isLoading && !!user;

  usePushNotifications(isAuthenticated);
  const isAdmin = user?.role === 'admin';

  // If not authenticated (and not still loading), redirect to login
  if (!isLoading && !user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8 + insets.bottom,
          height: 60 + insets.bottom
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500'
        },
        headerShown: false
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Notizie',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="saved-articles"
        options={{
          title: 'Salvati',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          )
        }}
      />
      <Tabs.Screen
        name="feed-preferences"
        options={{
          href: null
        }}
      />
      {isAdmin ? (
        <Tabs.Screen
          name="admin"
          options={{
            title: 'Admin',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            )
          }}
        />
      ) : (
        <Tabs.Screen
          name="admin"
          options={{
            href: null
          }}
        />
      )}
    </Tabs>
  );
}
