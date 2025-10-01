import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LeaderboardEntry {
  id: string;
  username: string;
  wins: number;
  losses: number;
  draws: number;
}

const LEADERBOARD_KEY = 'leaderboard';

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const data = await AsyncStorage.getItem(LEADERBOARD_KEY);
    if (data) {
      const leaderboard = JSON.parse(data);
      return leaderboard.sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.wins - a.wins);
    }
    return [];
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    return [];
  }
}

export async function updateLeaderboard(
  userId: string,
  username: string,
  result: 'win' | 'loss' | 'draw'
): Promise<void> {
  try {
    const leaderboard = await getLeaderboard();
    const existingIndex = leaderboard.findIndex((entry) => entry.id === userId);

    if (existingIndex >= 0) {
      if (result === 'win') leaderboard[existingIndex].wins++;
      else if (result === 'loss') leaderboard[existingIndex].losses++;
      else leaderboard[existingIndex].draws++;
    } else {
      leaderboard.push({
        id: userId,
        username,
        wins: result === 'win' ? 1 : 0,
        losses: result === 'loss' ? 1 : 0,
        draws: result === 'draw' ? 1 : 0,
      });
    }

    await AsyncStorage.setItem(LEADERBOARD_KEY, JSON.stringify(leaderboard));
  } catch (error) {
    console.error('Error updating leaderboard:', error);
  }
}
