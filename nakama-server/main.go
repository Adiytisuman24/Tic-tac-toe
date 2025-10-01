package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"math/rand"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// TTTState represents the game state for Tic-Tac-Toe
type TTTState struct {
	Board  [3][3]int `json:"board"`  // 0 = empty, 1 = P1, 2 = P2
	Turn   int       `json:"turn"`   // whose turn (1 or 2)
	P1     string    `json:"p1"`     // player 1 user ID
	P2     string    `json:"p2"`     // player 2 user ID or "BOT"
	Winner int       `json:"winner"` // 0 = none, 1/2 = player win, 3 = draw
	Mode   string    `json:"mode"`   // "pvp" or "pvc"
}

// InitModule initializes the Nakama runtime module
func InitModule(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, initializer runtime.Initializer) error {
	if err := initializer.RegisterMatch("tictactoe", func(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule) (runtime.Match, error) {
		return &TicTacToeMatch{}, nil
	}); err != nil {
		return err
	}

	logger.Info("Tic-Tac-Toe match handler registered")
	return nil
}

// TicTacToeMatch implements the runtime.Match interface
type TicTacToeMatch struct{}

// MatchInit initializes a new match
func (m *TicTacToeMatch) MatchInit(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, params map[string]interface{}) (interface{}, int, string) {
	mode := "pvp"
	if val, ok := params["mode"]; ok {
		if modeStr, ok := val.(string); ok {
			mode = modeStr
		}
	}

	state := &TTTState{
		Turn: 1,
		Mode: mode,
	}

	logger.Info("Match initialized with mode: %s", mode)
	return state, 1, "" // tick rate = 1 per second
}

// MatchJoinAttempt validates if a player can join
func (m *TicTacToeMatch) MatchJoinAttempt(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presence runtime.Presence, metadata map[string]string) (interface{}, bool, string) {
	s := state.(*TTTState)

	// Count current human players
	humanCount := 0
	if s.P1 != "" && s.P1 != "BOT" {
		humanCount++
	}
	if s.P2 != "" && s.P2 != "BOT" {
		humanCount++
	}

	if s.Mode == "pvc" && humanCount >= 1 {
		return state, false, "PvC mode: only 1 human player allowed"
	}

	if humanCount >= 2 {
		return state, false, "Match is full"
	}

	return state, true, ""
}

// MatchJoin handles successful player joins
func (m *TicTacToeMatch) MatchJoin(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*TTTState)

	for _, p := range presences {
		if s.P1 == "" {
			s.P1 = p.GetUserId()
			logger.Info("Player 1 joined: %s", p.GetUserId())
		} else if s.P2 == "" {
			if s.Mode == "pvp" {
				s.P2 = p.GetUserId()
				logger.Info("Player 2 joined: %s", p.GetUserId())
			}
		}
	}

	// If PvC mode and no P2 assigned yet, assign BOT
	if s.Mode == "pvc" && s.P2 == "" {
		s.P2 = "BOT"
		logger.Info("BOT assigned as Player 2")
	}

	// Broadcast initial state
	data, _ := json.Marshal(s)
	dispatcher.BroadcastMessage(0, data, nil, nil, true)

	return s
}

// MatchLeave handles player disconnections
func (m *TicTacToeMatch) MatchLeave(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, presences []runtime.Presence) interface{} {
	s := state.(*TTTState)

	for _, p := range presences {
		logger.Info("Player left: %s", p.GetUserId())
	}

	// End game if someone leaves
	if s.Winner == 0 {
		s.Winner = 3 // treat as draw/end
	}

	return s
}

// MatchLoop processes game logic each tick
func (m *TicTacToeMatch) MatchLoop(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, messages []runtime.MatchData) interface{} {
	s := state.(*TTTState)

	for _, msg := range messages {
		if msg.GetOpCode() != 1 {
			continue
		}

		var mv struct {
			Row int `json:"row"`
			Col int `json:"col"`
		}

		if err := json.Unmarshal(msg.GetData(), &mv); err != nil {
			logger.Error("Failed to unmarshal move: %v", err)
			continue
		}

		// Validate move bounds
		if mv.Row < 0 || mv.Row > 2 || mv.Col < 0 || mv.Col > 2 {
			logger.Warn("Invalid move coordinates: row=%d, col=%d", mv.Row, mv.Col)
			continue
		}

		// Identify player
		pid := 0
		if msg.GetUserId() == s.P1 {
			pid = 1
		} else if s.Mode == "pvp" && msg.GetUserId() == s.P2 {
			pid = 2
		}

		// Validate and process move
		if pid == s.Turn && s.Board[mv.Row][mv.Col] == 0 && s.Winner == 0 {
			s.Board[mv.Row][mv.Col] = pid
			logger.Info("Player %d played at [%d, %d]", pid, mv.Row, mv.Col)

			s.Winner = checkWin(s.Board)

			if s.Winner == 0 {
				// Switch turns
				if s.Turn == 1 {
					s.Turn = 2
				} else {
					s.Turn = 1
				}
			} else {
				logger.Info("Game ended with winner: %d", s.Winner)
			}
		}

		// If PvC mode and now it's bot's turn
		if s.Mode == "pvc" && s.Turn == 2 && s.Winner == 0 {
			time.Sleep(500 * time.Millisecond) // Small delay for realism
			row, col := botMove(s.Board)
			s.Board[row][col] = 2
			logger.Info("BOT played at [%d, %d]", row, col)

			s.Winner = checkWin(s.Board)

			if s.Winner == 0 {
				s.Turn = 1
			} else {
				logger.Info("Game ended with winner: %d", s.Winner)
			}
		}

		// Broadcast updated state
		data, _ := json.Marshal(s)
		dispatcher.BroadcastMessage(0, data, nil, nil, true)
	}

	return s
}

// MatchTerminate handles match cleanup
func (m *TicTacToeMatch) MatchTerminate(ctx context.Context, logger runtime.Logger, db *sql.DB, nk runtime.NakamaModule, dispatcher runtime.MatchDispatcher, tick int64, state interface{}, graceSeconds int) interface{} {
	logger.Info("Match terminated")
	return state
}

// botMove uses minimax algorithm to find the best move
func botMove(board [3][3]int) (int, int) {
	bestScore := -1000
	bestMove := [2]int{-1, -1}

	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			if board[i][j] == 0 {
				board[i][j] = 2 // bot is always player 2
				score := minimax(board, 0, false)
				board[i][j] = 0

				if score > bestScore {
					bestScore = score
					bestMove = [2]int{i, j}
				}
			}
		}
	}

	// Fallback to random if no move found
	if bestMove[0] == -1 {
		return randomMove(board)
	}

	return bestMove[0], bestMove[1]
}

// randomMove picks a random empty cell (fallback)
func randomMove(board [3][3]int) (int, int) {
	choices := [][2]int{}
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			if board[i][j] == 0 {
				choices = append(choices, [2]int{i, j})
			}
		}
	}

	if len(choices) == 0 {
		return 0, 0 // shouldn't happen
	}

	rand.Seed(time.Now().UnixNano())
	move := choices[rand.Intn(len(choices))]
	return move[0], move[1]
}

// minimax algorithm for optimal bot play
func minimax(board [3][3]int, depth int, isMaximizing bool) int {
	result := checkWin(board)
	if result != 0 {
		if result == 2 {
			return 10 - depth // bot wins (prefer faster wins)
		} else if result == 1 {
			return depth - 10 // human wins (delay loss)
		} else if result == 3 {
			return 0 // draw
		}
	}

	if isMaximizing {
		bestScore := -1000
		for i := 0; i < 3; i++ {
			for j := 0; j < 3; j++ {
				if board[i][j] == 0 {
					board[i][j] = 2
					score := minimax(board, depth+1, false)
					board[i][j] = 0
					if score > bestScore {
						bestScore = score
					}
				}
			}
		}
		return bestScore
	} else {
		bestScore := 1000
		for i := 0; i < 3; i++ {
			for j := 0; j < 3; j++ {
				if board[i][j] == 0 {
					board[i][j] = 1
					score := minimax(board, depth+1, true)
					board[i][j] = 0
					if score < bestScore {
						bestScore = score
					}
				}
			}
		}
		return bestScore
	}
}

// checkWin checks if there's a winner or draw
func checkWin(b [3][3]int) int {
	lines := [8][3][2]int{
		{{0, 0}, {0, 1}, {0, 2}}, // row 0
		{{1, 0}, {1, 1}, {1, 2}}, // row 1
		{{2, 0}, {2, 1}, {2, 2}}, // row 2
		{{0, 0}, {1, 0}, {2, 0}}, // col 0
		{{0, 1}, {1, 1}, {2, 1}}, // col 1
		{{0, 2}, {1, 2}, {2, 2}}, // col 2
		{{0, 0}, {1, 1}, {2, 2}}, // diagonal \
		{{0, 2}, {1, 1}, {2, 0}}, // diagonal /
	}

	for _, l := range lines {
		a, b, c := l[0], l[1], l[2]
		v := b[a[0]][a[1]]
		if v != 0 && v == b[b[0]][b[1]] && v == b[c[0]][c[1]] {
			return v
		}
	}

	// Check for draw (board full)
	for i := 0; i < 3; i++ {
		for j := 0; j < 3; j++ {
			if b[i][j] == 0 {
				return 0 // game still ongoing
			}
		}
	}

	return 3 // draw
}
