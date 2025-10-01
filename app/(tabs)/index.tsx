import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { updateLeaderboard } from '@/utils/leaderboard';

type Player = 'X' | 'O' | null;
type Board = Player[];

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export default function GameScreen() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [playerXName, setPlayerXName] = useState('');
  const [playerOName, setPlayerOName] = useState('');
  const [gameStarted, setGameStarted] = useState(false);
  const { user } = useAuth();

  const checkWinner = (currentBoard: Board): Player | 'draw' | null => {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (
        currentBoard[a] &&
        currentBoard[a] === currentBoard[b] &&
        currentBoard[a] === currentBoard[c]
      ) {
        return currentBoard[a];
      }
    }

    if (currentBoard.every((cell) => cell !== null)) {
      return 'draw';
    }

    return null;
  };

  useEffect(() => {
    if (winner) {
      saveGameResult();
    }
  }, [winner]);

  const saveGameResult = async () => {
    if (!winner || !user) return;

    if (winner === 'X') {
      await updateLeaderboard(user.id, user.username, 'win');
      Alert.alert('Game Over', `${playerXName} (X) wins!`);
    } else if (winner === 'O') {
      await updateLeaderboard(user.id, user.username, 'loss');
      Alert.alert('Game Over', `${playerOName} (O) wins!`);
    } else if (winner === 'draw') {
      await updateLeaderboard(user.id, user.username, 'draw');
      Alert.alert('Game Over', "It's a draw!");
    }
  };

  const evaluateBoard = (currentBoard: Board): number => {
    let score = 0;

    // Center control is key
    if (currentBoard[4] === 'O') score += 3;
    if (currentBoard[4] === 'X') score -= 3;

    // Corners are valuable
    const corners = [0, 2, 6, 8];
    corners.forEach((corner) => {
      if (currentBoard[corner] === 'O') score += 2;
      if (currentBoard[corner] === 'X') score -= 2;
    });

    return score;
  };

  const minimax = (
    currentBoard: Board,
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number
  ): number => {
    const result = checkWinner(currentBoard);

    if (result === 'O') return 100 - depth;
    if (result === 'X') return depth - 100;
    if (result === 'draw') return 0;

    if (isMaximizing) {
      let bestScore = -1000;
      for (let i = 0; i < 9; i++) {
        if (currentBoard[i] === null) {
          currentBoard[i] = 'O';
          let score = minimax(currentBoard, depth + 1, false, alpha, beta);
          if (score === 0) {
            score = evaluateBoard(currentBoard);
          }
          currentBoard[i] = null;
          bestScore = Math.max(score, bestScore);
          alpha = Math.max(alpha, bestScore);
          if (beta <= alpha) break;
        }
      }
      return bestScore;
    } else {
      let bestScore = 1000;
      for (let i = 0; i < 9; i++) {
        if (currentBoard[i] === null) {
          currentBoard[i] = 'X';
          let score = minimax(currentBoard, depth + 1, true, alpha, beta);
          if (score === 0) {
            score = evaluateBoard(currentBoard);
          }
          currentBoard[i] = null;
          bestScore = Math.min(score, bestScore);
          beta = Math.min(beta, bestScore);
          if (beta <= alpha) break;
        }
      }
      return bestScore;
    }
  };

  const openingBook = (currentBoard: Board): number => {
    const emptyCount = currentBoard.filter((cell) => cell === null).length;

    // If board is empty, take center
    if (emptyCount === 9) {
      return 4;
    }

    // If opponent starts and center is free, take it
    if (emptyCount === 8 && currentBoard[4] === null) {
      return 4;
    }

    return -1;
  };

  const makeComputerMove = (currentBoard: Board) => {
    const emptyCells = currentBoard
      .map((cell, index) => (cell === null ? index : null))
      .filter((val) => val !== null) as number[];

    if (emptyCells.length === 0) return;

    // Check opening book first
    const openingMove = openingBook(currentBoard);
    if (openingMove !== -1) {
      setTimeout(() => {
        const newBoard = [...currentBoard];
        newBoard[openingMove] = 'O';
        setBoard(newBoard);

        const gameWinner = checkWinner(newBoard);
        if (gameWinner) {
          setWinner(gameWinner);
        } else {
          setCurrentPlayer('X');
        }
      }, 500);
      return;
    }

    // Use minimax for optimal play
    let bestScore = -1000;
    const bestMoves: number[] = [];

    for (const index of emptyCells) {
      const testBoard = [...currentBoard];
      testBoard[index] = 'O';
      const score = minimax(testBoard, 0, false, -1000, 1000);

      if (score > bestScore) {
        bestScore = score;
        bestMoves.length = 0;
        bestMoves.push(index);
      } else if (score === bestScore) {
        bestMoves.push(index);
      }
    }

    // Randomize among equally optimal moves
    const bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];

    setTimeout(() => {
      const newBoard = [...currentBoard];
      newBoard[bestMove] = 'O';
      setBoard(newBoard);

      const gameWinner = checkWinner(newBoard);
      if (gameWinner) {
        setWinner(gameWinner);
      } else {
        setCurrentPlayer('X');
      }
    }, 500);
  };

  const handleCellPress = (index: number) => {
    if (board[index] || winner || currentPlayer === 'O') return;

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
    } else {
      setCurrentPlayer('O');
      makeComputerMove(newBoard);
    }
  };

  const startGame = () => {
    if (user) {
      setPlayerXName(user.username);
      setPlayerOName('Computer');
      setGameStarted(true);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
  };

  const renderCell = (index: number) => {
    const value = board[index];
    return (
      <TouchableOpacity
        key={index}
        style={styles.cell}
        onPress={() => handleCellPress(index)}
        activeOpacity={0.7}>
        <Text style={[styles.cellText, value === 'X' ? styles.xText : styles.oText]}>
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!gameStarted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Ready to Play?</Text>
          <Text style={styles.welcomeSubtitle}>You'll be playing as X against the Computer</Text>
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>Start Game</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tic Tac Toe</Text>
      </View>

      <View style={styles.playersContainer}>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerText, currentPlayer === 'X' && styles.activePlayer]}>
            {playerXName} (X)
          </Text>
        </View>
        <Text style={styles.vsText}>VS</Text>
        <View style={styles.playerInfo}>
          <Text style={[styles.playerText, currentPlayer === 'O' && styles.activePlayer]}>
            {playerOName} (O)
          </Text>
        </View>
      </View>

      <View style={styles.statusContainer}>
        {winner ? (
          <Text style={styles.statusText}>
            {winner === 'draw' ? "It's a Draw!" : `Player ${winner} Wins!`}
          </Text>
        ) : (
          <Text style={styles.statusText}>Player {currentPlayer}'s Turn</Text>
        )}
      </View>

      <View style={styles.boardContainer}>
        <View style={styles.board}>
          {Array.from({ length: 9 }).map((_, index) => renderCell(index))}
        </View>
      </View>

      <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
        <RotateCcw size={24} color="#fff" />
        <Text style={styles.resetButtonText}>New Game</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const boardSize = Math.min(width - 48, 380);
const cellSize = (boardSize - 32) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1e293b',
  },
  playersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  playerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  playerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  activePlayer: {
    color: '#2563eb',
    fontSize: 18,
  },
  vsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    marginHorizontal: 16,
  },
  statusContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#475569',
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  board: {
    width: boardSize,
    height: boardSize,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#cbd5e1',
    borderRadius: 16,
    padding: 8,
    gap: 8,
  },
  cell: {
    width: cellSize,
    height: cellSize,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  cellText: {
    fontSize: 48,
    fontWeight: '700',
  },
  xText: {
    color: '#2563eb',
  },
  oText: {
    color: '#dc2626',
  },
  resetButton: {
    flexDirection: 'row',
    backgroundColor: '#2563eb',
    margin: 24,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
