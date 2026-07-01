// Connect & Reconnection setup
  useEffect(() => {
    // Connect to the backend server (monolith origin or split environment)
    let serverUrl = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_URL;
    if (!serverUrl) {
      if (window.location.hostname.includes('skyfallcustom.vercel.app')) {
        serverUrl = 'https://skyfallcustom.onrender.com';
      } else {
        serverUrl = window.location.origin;
      }
    }

    socket = io(serverUrl, {
      transports: ['polling', 'websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Try to sync/reconnect if we have cached details
      const savedRoomId = localStorage.getItem('spyfall_roomId');
      const savedPlayerId = localStorage.getItem('spyfall_playerId');
      const savedName = localStorage.getItem('spyfall_playerName');

      if (savedRoomId && savedPlayerId) {
        setRoomId(savedRoomId);
        setPlayerId(savedPlayerId);
        if (savedName) setPlayerName(savedName);
        socket.emit('request_sync', { roomId: savedRoomId, playerId: savedPlayerId });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room_created', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerId', playerId);
      if (playerName) localStorage.setItem('spyfall_playerName', playerName);
    });

    socket.on('joined_room', ({ roomId, playerId }: { roomId: string, playerId: string }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      localStorage.setItem('spyfall_roomId', roomId);
      localStorage.setItem('spyfall_playerId', playerId);
      if (playerName) localStorage.setItem('spyfall_playerName', playerName);
    });

    socket.on('game_state_update', (updatedState: GameState) => {
      setGameState(updatedState);
      
      // Auto-trigger confetti on overall End Game
      if (updatedState.phase === 'END_GAME') {
        triggerEndGameConfetti();
      }

      if (updatedState.phase !== 'REVEAL') {
        setCardFlipped(false);
      }
    });

    socket.on('trigger_sfx', ({ type }: { type: string }) => {
      switch (type) {
        case 'click': soundManager.playClick(); break;
        case 'join': soundManager.playJoin(); break;
        case 'countdown': soundManager.playCountdown(); break;
        case 'card_flip': soundManager.playCardFlip(); break;
        case 'warning': soundManager.playWarning(); break;
        case 'spy_reveal': soundManager.playSpyReveal(); break;
        case 'vote_reveal': soundManager.playVoteReveal(); break;
        case 'victory': soundManager.playVictory(); break;
        case 'defeat': soundManager.playDefeat(); break;
      }
    });

    socket.on('error', ({ message }: { message: string }) => {
      setErrorMessage(message);
      soundManager.playWarning();
      setTimeout(() => setErrorMessage(''), 5000);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_created');
      socket.off('joined_room');
      socket.off('game_state_update');
      socket.off('trigger_sfx');
      socket.off('error');
    };
  }, [playerName]);
