export type GamePhase = 'LOBBY' | 'REVEAL' | 'DISCUSSION' | 'VOTING' | 'SPY_GUESS' | 'SCOREBOARD' | 'END_GAME';

export interface RoomSettings {
  winningScore: number;
  discussionTimer: number; // in seconds
  votingTimer: number; // in seconds
  spyGuessTimer: number; // in seconds
  numSpies: number;
  maxPlayers: number;
  isPrivate: boolean;
  roomName: string;
  readyCheck: boolean;
  randomQuestionOrder: boolean;
  autoNextRound: boolean;
  hideVotesUntilReveal: boolean;
  allowSpectators: boolean;
  manualStart: boolean;
  activePacks: string[]; // ids of packs being used
  multiplePacksEnabled?: boolean;
}

export interface WordPack {
  id: string;
  name: string;
  words: string[];
  isCustom?: boolean;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
  wins: number;
  role?: 'spy' | 'civilian' | 'spectator';
  votedFor?: string | null;
  isConnected: boolean;
  // Stats inside this room session
  votesReceived: number;
  correctVotes: number;
  totalVotesCast: number;
  isDev?: boolean;
  invisible?: boolean;
}

export interface RoomStats {
  gamesPlayed: number;
  spyWins: number;
  civilianWins: number;
  mostCorrectVotes: string[]; // names of players
  highestAccuracy: number;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  settings: RoomSettings;
  currentRound: number;
  timerValue: number; // current phase countdown
  secretWord: string; // ONLY sent to non-spies in reveal phase!
  spies: string[]; // IDs of spies (server-only or revealed at end)
  revealedSpies?: string[]; // IDs of spies shown at the end
  votedOutPlayerId?: string | null; // Player who got voted out
  spyGuessWord?: string; // what the spy typed
  spyGuessSuccess?: boolean; // did the spy guess correct?
  roundWinner?: 'spies' | 'civilians' | null;
  customPacks: WordPack[];
  stats: RoomStats;
  currentPackId?: string;
}
