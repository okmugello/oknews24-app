import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { getFeeds, createFeed, updateFeed, deleteFeed, refreshArticles, Feed } from '../../services/api';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function FeedsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [feedForm, setFeedForm] = useState({ name: '', url: '', category: '' });
  const [isSaving, setIsSaving] = useState(false);

  const loadFeeds = useCallback(async () => {
    try {
      const response = await getFeeds();
      setFeeds(response.data);
    } catch (error) {
      console.error('Error loading feeds:', error);
      Alert.alert('Errore', 'Impossibile caricare i feed');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFeeds();
  }, [loadFeeds]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFeeds();
  };

  const handleRefreshArticles = async () => {
    try {
      const response = await refreshArticles();
      Alert.alert('Successo', response.data.message);
    } catch (error) {
      Alert.alert('Errore', 'Impossibile aggiornare gli articoli');
    }
  };

  const handleOpenModal = (feed?: Feed) => {
    if (feed) {
      setEditingFeed(feed);
      setFeedForm({ name: feed.name, url: feed.url, category: feed.category });
    } else {
      setEditingFeed(null);
      setFeedForm({ name: '', url: '', category: '' });
    }
    setIsModalVisible(true);
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingFeed(null);
    setFeedForm({ name: '', url: '', category: '' });
  };

  const handleSaveFeed = async () => {
    if (!feedForm.name || !feedForm.url) {
      Alert.alert('Errore', 'Nome e URL sono obbligatori');
      return;
    }

    setIsSaving(true);
    try {
      if (editingFeed) {
        await updateFeed(editingFeed.feed_id, feedForm);
      } else {
        await createFeed(feedForm);
      }
      handleCloseModal();
      loadFeeds();
    } catch (error: any) {
      Alert.alert('Errore', error.response?.data?.detail || 'Impossibile salvare il feed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFeed = async (feed: Feed) => {
    Alert.alert(
      'Elimina feed',
      `Sei sicuro di voler eliminare "${feed.name}"? Questo eliminerà anche tutti gli articoli associati.`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFeed(feed.feed_id);
              loadFeeds();
            } catch (error) {
              Alert.alert('Errore', 'Impossibile eliminare il feed');
            }
          }
        }
      ]
    );
  };

  const renderFeedItem = ({ item }: { item: Feed }) => (
    <View style={styles.feedCard}>
      <View style={styles.feedInfo}>
        <View style={styles.feedIconContainer}>
          <Ionicons name="newspaper" size={24} color="#3B82F6" />
        </View>
        <View style={styles.feedDetails}>
          <Text style={styles.feedName}>{item.name}</Text>
          <Text style={styles.feedUrl} numberOfLines={1}>{item.url}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleOpenModal(item)}
        >
          <Ionicons name="pencil" size={20} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteFeed(item)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (user?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed" size={48} color="#9CA3AF" />
          <Text style={styles.noAccessText}>Accesso non autorizzato</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feed RSS</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleOpenModal()}
        >
          <Ionicons name="add" size={24} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.refreshBar} onPress={handleRefreshArticles}>
        <Ionicons name="refresh" size={20} color="#3B82F6" />
        <Text style={styles.refreshText}>Aggiorna articoli da tutti i feed</Text>
      </TouchableOpacity>

      {isLoading ? (
        <LoadingSpinner fullScreen message="Caricamento feed..." />
      ) : (
        <FlatList
          data={feeds}
          keyExtractor={(item) => item.feed_id}
          renderItem={renderFeedItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#3B82F6']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="list-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Nessun feed configurato</Text>
              <TouchableOpacity
                style={styles.addFirstButton}
                onPress={() => handleOpenModal()}
              >
                <Text style={styles.addFirstButtonText}>Aggiungi il primo feed</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingFeed ? 'Modifica Feed' : 'Nuovo Feed'}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                style={styles.input}
                value={feedForm.name}
                onChangeText={(text) => setFeedForm({ ...feedForm, name: text })}
                placeholder="Es. OK Mugello"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>URL Feed RSS</Text>
              <TextInput
                style={styles.input}
                value={feedForm.url}
                onChangeText={(text) => setFeedForm({ ...feedForm, url: text })}
                placeholder="https://example.com/feed"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Categoria</Text>
              <TextInput
                style={styles.input}
                value={feedForm.category}
                onChangeText={(text) => setFeedForm({ ...feedForm, category: text })}
                placeholder="Es. sport, news, magazine"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveFeed}
              disabled={isSaving}
            >
              {isSaving ? (
                <LoadingSpinner />
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingFeed ? 'Salva modifiche' : 'Aggiungi feed'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937'
  },
  addButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  refreshBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    margin: 16,
    borderRadius: 12
  },
  refreshText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6'
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  feedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2
  },
  feedInfo: {
    flexDirection: 'row',
    marginBottom: 12
  },
  feedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center'
  },
  feedDetails: {
    flex: 1,
    marginLeft: 12
  },
  feedName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937'
  },
  feedUrl: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  categoryBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 8
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563'
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12
  },
  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8
  },
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  noAccessText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12
  },
  addFirstButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 8
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937'
  },
  formGroup: {
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937'
  },
  saveButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  }
});
