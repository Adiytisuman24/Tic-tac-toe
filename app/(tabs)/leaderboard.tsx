import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Medal, Award, LogOut } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { getLeaderboard, LeaderboardEntry } from '@/utils/leaderboard';
import { useFocusEffect } from 'expo-router';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, logout } = useAuth();

  const loadLeaderboard = async () => {
    setIsLoading(true);
    const data = await getLeaderboard();
    setLeaderboard(data);
    setIsLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadLeaderboard();
    }, [])
  );

  const handleLogout = async () => {
    await logout();
  };
  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy size={24} color="#fbbf24" />;
      case 1:
        return <Medal size={24} color="#94a3b8" />;
      case 2:
        return <Award size={24} color="#cd7f32" />;
      default:
        return <Text style={styles.rankNumber}>{index + 1}</Text>;
    }
  };

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const isCurrentUser = user?.id === item.id;
    return (
      <View style={[styles.itemContainer, isCurrentUser && styles.currentUserItem]}>
        <View style={styles.rankContainer}>{getRankIcon(index)}</View>
        <View style={styles.nameContainer}>
          <Text style={styles.playerName}>
            {item.username} {isCurrentUser && '(You)'}
          </Text>
        </View>
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.wins}</Text>
          <Text style={styles.statLabel}>W</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.losses}</Text>
          <Text style={styles.statLabel}>L</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{item.draws}</Text>
          <Text style={styles.statLabel}>D</Text>
        </View>
      </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Trophy size={32} color="#2563eb" />
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {user && (
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Welcome, {user.username}!</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No stats yet. Play some games!</Text>
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  logoutText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  userInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
  },
  listContainer: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  currentUserItem: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
  },
  nameContainer: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
