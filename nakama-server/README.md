# Tic-Tac-Toe Nakama Server Module

A server-authoritative Tic-Tac-Toe implementation for Nakama with both PvP (Player vs Player) and PvC (Player vs Computer) modes.

## Features

### Game Modes

- **PvP (Player vs Player)**: Two human players compete via Nakama matchmaking
- **PvC (Player vs Computer)**: Single player vs an AI bot with minimax algorithm

### Server-Authoritative Logic

- All moves validated server-side
- Turn enforcement
- Board state management
- Winner/draw detection

### Bot AI

The bot uses a **minimax algorithm** for optimal play:
- Never loses (best case: draws against perfect play)
- Always wins against imperfect play
- Evaluates all possible game states recursively
- Prefers faster wins and slower losses (depth-aware scoring)

## Installation

1. Copy `main.go` to your Nakama server's Go runtime directory
2. Ensure you have the Nakama Common module:
   ```bash
   go get github.com/heroiclabs/nakama-common
   ```

3. Build your Nakama server with the module included

## Usage

### Creating a Match

**PvP Mode:**
```javascript
const match = await socket.createMatch({
  mode: "pvp"
});
```

**PvC Mode (with bot):**
```javascript
const match = await socket.createMatch({
  mode: "pvc"
});
```

### Joining a Match

```javascript
await socket.joinMatch(matchId);
```

### Sending Moves

Send moves with OpCode 1:
```javascript
const move = {
  row: 1,  // 0-2
  col: 1   // 0-2
};

await socket.sendMatchState(matchId, 1, JSON.stringify(move));
```

### Receiving State Updates

```javascript
socket.onmatchdata = (matchData) => {
  const state = JSON.parse(matchData.data);

  console.log("Board:", state.board);
  console.log("Turn:", state.turn);  // 1 or 2
  console.log("Winner:", state.winner); // 0=ongoing, 1/2=winner, 3=draw
  console.log("Mode:", state.mode);  // "pvp" or "pvc"
};
```

## State Structure

```typescript
{
  board: number[][];  // 3x3 array: 0=empty, 1=P1, 2=P2
  turn: number;       // 1 or 2
  p1: string;         // player 1 user ID
  p2: string;         // player 2 user ID or "BOT"
  winner: number;     // 0=none, 1/2=player win, 3=draw
  mode: string;       // "pvp" or "pvc"
}
```

## Game Flow

1. **Match Init**: Create match with mode parameter
2. **Join**: Players join (1 for PvC, 2 for PvP)
3. **Play**: Players send moves alternately
4. **Bot Response** (PvC only): Server automatically generates bot move after player
5. **Win/Draw**: Game ends when someone wins or board is full
6. **Terminate**: Match cleanup

## Algorithm Details

### Minimax Implementation

The bot evaluates positions using recursive minimax:

- **Maximizing player (Bot)**: Tries to maximize score
- **Minimizing player (Human)**: Tries to minimize score
- **Scores**:
  - Bot wins: `10 - depth` (prefer faster wins)
  - Human wins: `depth - 10` (delay losses)
  - Draw: `0`

The depth-aware scoring ensures the bot:
- Wins as quickly as possible
- Delays losses as long as possible
- Chooses draws over losses

### Performance

Tic-Tac-Toe has a small state space (~5,000 positions), making minimax efficient:
- Average move calculation: <1ms
- No pruning needed
- Complete game tree search every move

## Security

- All move validation server-side
- Turn enforcement prevents cheating
- Cell occupancy checked before placement
- No client-side game logic trusted

## License

This is example code for Nakama game server integration.
