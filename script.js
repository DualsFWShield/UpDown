document.addEventListener('DOMContentLoaded', () => {
    // --- États de l'Application ---
    let gameState = {
        players: [], // { name, score, contractsMade, contractsBroken, abandonsUsedAscent, abandonsUsedDescent, totalAbandons, reversalsUsed, bonusPoints, bidsHistory, tricksHistory }
        numPlayers: 0,
        currentRound: 0,
        totalRounds: 0,
        roundCardSequence: [],
        currentDealerIndex: 0,
        currentPhase: 'bidding', // 'bidding' ou 'tricks'
        roundHistory: [], // [{ roundNum, cards, dealer, bids, tricks, scoresChange, reversalInfo }]
        gameOptions: {
            abandons: 0, // 0, 1, 3, ou 5
            bonus: false
        },
        peakRound: 0,
        distributionDirection: 'clockwise', // 'clockwise' ou 'counter-clockwise'
        reversalInfoForRound: null, // {playerId, cost}
    };

    // --- Éléments du DOM ---
    const setupScreen = document.getElementById('setup-screen');
    const gameScreen = document.getElementById('game-screen');
    const endGameScreen = document.getElementById('end-game-screen');
    const numPlayersSelect = document.getElementById('num-players');
    const playerNamesInputsDiv = document.getElementById('player-names-inputs');
    const startGameBtn = document.getElementById('start-game-btn');
    const loadGameBtn = document.getElementById('load-game-btn');
    const errorSetup = document.getElementById('error-setup');
    const optionBonusCheckbox = document.getElementById('option-bonus');
    const undoRoundBtn = document.getElementById('undo-round-btn');
    const roundTitle = document.getElementById('round-title');
    const currentDealerSpan = document.getElementById('current-dealer');
    const distributionDirectionInfoSpan = document.getElementById('distribution-direction-info');
    const biddingPhaseDiv = document.getElementById('bidding-phase');
    const bidsInputsDiv = document.getElementById('bids-inputs');
    const totalBidsSpan = document.getElementById('total-bids');
    const cardsInRoundDisplaySpan = document.getElementById('cards-in-round-display');
    const submitBidsBtn = document.getElementById('submit-bids-btn');
    const errorBids = document.getElementById('error-bids');
    const tricksPhaseDiv = document.getElementById('tricks-phase');
    const tricksInputsDiv = document.getElementById('tricks-inputs');
    const totalTricksMadeSpan = document.getElementById('total-tricks-made');
    const cardsInRoundDisplayTricksSpan = document.getElementById('cards-in-round-display-tricks');
    const submitTricksBtn = document.getElementById('submit-tricks-btn');
    const errorTricks = document.getElementById('error-tricks');
    const scoresTbody = document.getElementById('scores-tbody');
    const cancelGameBtn = document.getElementById('cancel-game-btn');
    const winnerNameSpan = document.getElementById('winner-name');
    const finalScoresTbody = document.getElementById('final-scores-tbody');
    const scoreEvolutionChartCtx = document.getElementById('score-evolution-chart')?.getContext('2d');
    const contractsChartCtx = document.getElementById('contracts-chart')?.getContext('2d');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    const newGameBtn = document.getElementById('new-game-btn');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const createTestGameBtn = document.getElementById('create-test-game-btn');
    const autoFillScoresBtn = document.getElementById('auto-fill-scores-btn');

    let scoreEvolutionChartInstance = null;
    let contractsChartInstance = null;

    // --- Fonctions Utilitaires ---
    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active-screen'));
        document.getElementById(screenId).classList.add('active-screen');
    }

    function saveGameState() {
        localStorage.setItem('escalierGameState', JSON.stringify(gameState));
    }

    function loadGameState() {
        const savedState = localStorage.getItem('escalierGameState');
        if (savedState) {
            gameState = JSON.parse(savedState);
            return true;
        }
        return false;
    }

    function clearGameState() {
        localStorage.removeItem('escalierGameState');
        gameState = {
            players: [], roundHistory: [], gameOptions: { abandons: 0, bonus: false }, distributionDirection: 'clockwise', reversalInfoForRound: null
        };
    }

    // --- Logique de Configuration ---
    numPlayersSelect.addEventListener('change', generatePlayerNameInputs);
    startGameBtn.addEventListener('click', initializeNewGame);
    loadGameBtn.addEventListener('click', resumeGame);
    cancelGameBtn.addEventListener('click', handleCancelGame);
    undoRoundBtn.addEventListener('click', handleUndoRound);
    newGameBtn.addEventListener('click', () => {
        clearGameState();
        showScreen('setup-screen');
        checkExistingGame();
    });

    document.querySelectorAll('input[name="abandon-option"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const isQuintuple = document.getElementById('option-abandon-quintuple').checked;
            optionBonusCheckbox.disabled = !isQuintuple;
            if (!isQuintuple) {
                optionBonusCheckbox.checked = false;
            }
        });
    });

    function generatePlayerNameInputs() {
        const num = parseInt(numPlayersSelect.value);
        playerNamesInputsDiv.innerHTML = '';
        for (let i = 0; i < num; i++) {
            const div = document.createElement('div');
            div.innerHTML = `<label>Nom Joueur ${i + 1}:</label><input type="text" placeholder="Joueur ${i + 1}">`;
            playerNamesInputsDiv.appendChild(div);
        }
    }

    function initializeNewGame() {
        errorSetup.textContent = '';
        const num = parseInt(numPlayersSelect.value);
        gameState.numPlayers = num;
        gameState.players = [];

        gameState.gameOptions.abandons = parseInt(document.querySelector('input[name="abandon-option"]:checked').value);
        gameState.gameOptions.bonus = optionBonusCheckbox.checked && gameState.gameOptions.abandons === 5;

        const nameInputs = playerNamesInputsDiv.querySelectorAll('input[type="text"]');
        let allNamesValid = true;
        nameInputs.forEach((input, index) => {
            if (!input.value.trim()) allNamesValid = false;
            gameState.players.push({
                name: input.value.trim() || `Joueur ${index + 1}`, score: 0, contractsMade: 0, contractsBroken: 0,
                abandonsUsedAscent: 0, abandonsUsedDescent: 0, totalAbandons: 0, reversalsUsed: 0, bonusPoints: 0,
                bidsHistory: [], tricksHistory: []
            });
        });

        if (!allNamesValid) {
            errorSetup.textContent = 'Veuillez entrer un nom pour chaque joueur.';
            return;
        }

        let maxCards = (num <= 5) ? 10 : 8;
        gameState.peakRound = maxCards - 1;

        gameState.roundCardSequence = [];
        for (let i = 1; i <= maxCards; i++) gameState.roundCardSequence.push(i);
        for (let i = maxCards; i >= 1; i--) gameState.roundCardSequence.push(i);

        gameState.totalRounds = gameState.roundCardSequence.length;
        gameState.currentRound = 0;
        gameState.currentDealerIndex = gameState.numPlayers - 1;
        gameState.currentPhase = 'bidding';
        gameState.distributionDirection = 'clockwise';
        gameState.roundHistory = [];

        saveGameState();
        startGameUI();
    }

    function resumeGame() {
        if (loadGameState()) {
            startGameUI(true);
        } else {
            alert("Aucune partie sauvegardée trouvée.");
        }
    }

    function handleUndoRound() {
        if (gameState.currentRound === 0) return;
        if (!confirm("Voulez-vous vraiment annuler les résultats de la dernière manche ?")) return;

        gameState.currentRound--;
        const lastRoundData = gameState.roundHistory.pop();
        const reversalInfo = lastRoundData.reversalInfo;
        const isAscent = gameState.currentRound <= gameState.peakRound;

        if (reversalInfo) {
            gameState.distributionDirection = (gameState.distributionDirection === 'clockwise') ? 'counter-clockwise' : 'clockwise';
        }

        gameState.players.forEach((player, playerId) => {
            player.score -= (lastRoundData.scoresChange[player.name] || 0);
            player.bidsHistory.pop();
            player.tricksHistory.pop();

            const bid = lastRoundData.bids[player.name];

            if (reversalInfo && reversalInfo.playerId === playerId) {
                player.reversalsUsed--;
                player.totalAbandons -= reversalInfo.cost;
                if (isAscent) player.abandonsUsedAscent -= reversalInfo.cost;
                else player.abandonsUsedDescent -= reversalInfo.cost;
            }

            if (bid === 'A') {
                if (!reversalInfo || reversalInfo.playerId !== playerId || reversalInfo.cost !== 3) {
                    player.totalAbandons--;
                    if (isAscent) player.abandonsUsedAscent--;
                    else player.abandonsUsedDescent--;
                }
            } else if (bid !== undefined) {
                const tricksWon = lastRoundData.tricks[player.name];
                if (bid === tricksWon) player.contractsMade--;
                else player.contractsBroken--;
            }
        });

        gameState.currentDealerIndex = (gameState.currentDealerIndex - 1 + gameState.numPlayers) % gameState.numPlayers;
        saveGameState();
        startGameUI();
    }

    function handleCancelGame() {
        if (confirm("Annuler la partie ? Toute la progression sera perdue.")) {
            clearGameState();
            showScreen('setup-screen');
            generatePlayerNameInputs();
            checkExistingGame();
        }
    }

    // --- Logique de Jeu ---
    function startGameUI(isResuming = false) {
        showScreen('game-screen');
        if (isResuming && gameState.currentPhase === 'tricks') {
            setupTricksPhase();
        } else {
            if (gameState.currentRound > 0 && !isResuming) {
                gameState.currentDealerIndex = (gameState.currentDealerIndex + 1) % gameState.numPlayers;
            }
            setupBiddingPhase();
        }
        updateLiveScoreboard();
    }

    function setupBiddingPhase() {
        gameState.currentPhase = 'bidding';
        gameState.reversalInfoForRound = null;
        const currentCards = gameState.roundCardSequence[gameState.currentRound];
        const currentRoundDisplay = gameState.currentRound + 1;
        roundTitle.textContent = `Manche ${currentRoundDisplay} / ${gameState.totalRounds} (${currentCards} carte${currentCards > 1 ? 's' : ''})`;
        currentDealerSpan.textContent = gameState.players[gameState.currentDealerIndex].name;
        distributionDirectionInfoSpan.textContent = (gameState.distributionDirection === 'clockwise') ? "horaire" : "anti-horaire";

        const firstBidderIndex = (gameState.currentDealerIndex + 1) % gameState.numPlayers;
        bidsInputsDiv.innerHTML = '';

        const playerOrder = Array.from({ length: gameState.numPlayers }, (_, i) => {
            if (gameState.distributionDirection === 'clockwise') {
                return (firstBidderIndex + i) % gameState.numPlayers;
            } else {
                return (firstBidderIndex - i + gameState.numPlayers * i) % gameState.numPlayers;
            }
        });

        playerOrder.forEach((playerIndex, orderIndex) => {
            const player = gameState.players[playerIndex];
            const div = document.createElement('div');
            div.className = 'input-group';

            const isAscent = gameState.currentRound <= gameState.peakRound;
            const maxAbandons = gameState.gameOptions.abandons;
            const abandonsUsed = isAscent ? player.abandonsUsedAscent : player.abandonsUsedDescent;
            const abandonsLeft = maxAbandons - abandonsUsed;

            let controlsHTML = `
                <span class="parole-indicator">${orderIndex === 0 ? '♦' : '&nbsp;'}</span>
                <label for="bid-player-${playerIndex}">${player.name}:</label>
                <input type="number" id="bid-player-${playerIndex}" min="0" max="${currentCards}" value="0" data-player-id="${playerIndex}">`;

            if (maxAbandons > 0 && abandonsLeft > 0) {
                controlsHTML += `
                    <div style="margin-left: 15px; display: flex; align-items: center; gap: 5px;">
                        <input type="checkbox" class="abandon-cb" id="abandon-player-${playerIndex}" data-player-id="${playerIndex}">
                        <label for="abandon-player-${playerIndex}" style="font-weight: normal; margin-bottom: 0;">Abandonner (${abandonsLeft} restants)</label>
                    </div>`;
            }

            if (maxAbandons > 0) {
                controlsHTML += `<div id="reverse-controls-${playerIndex}" style="margin-left: 10px; display: flex; flex-direction: column; align-items: flex-start;">`;
                if (abandonsLeft >= 2) {
                    controlsHTML += `<div><input type="checkbox" class="reverse-cb" data-player-id="${playerIndex}" data-cost="2" id="reverse-cost2-${playerIndex}"><label for="reverse-cost2-${playerIndex}" style="font-weight: normal;"> Inverser (coût 2)</label></div>`;
                }
                if (abandonsLeft >= 3) {
                    controlsHTML += `<div><input type="checkbox" class="reverse-cb" data-player-id="${playerIndex}" data-cost="3" id="reverse-cost3-${playerIndex}"><label for="reverse-cost3-${playerIndex}" style="font-weight: normal;"> Inverser + Abandonner (coût 3)</label></div>`;
                }
                controlsHTML += `</div>`;
            }

            div.innerHTML = controlsHTML;
            bidsInputsDiv.appendChild(div);
        });

        bidsInputsDiv.querySelectorAll('input[type="number"]').forEach(i => i.addEventListener('input', updateTotalBids));
        bidsInputsDiv.querySelectorAll('.abandon-cb').forEach(cb => cb.addEventListener('change', handleAbandonChange));
        bidsInputsDiv.querySelectorAll('.reverse-cb').forEach(cb => cb.addEventListener('change', handleReverseChange));

        updateTotalBids();
        enforceRoundPlayerLimits();
        biddingPhaseDiv.style.display = 'block';
        tricksPhaseDiv.style.display = 'none';
        errorBids.textContent = '';
        undoRoundBtn.style.display = gameState.currentRound > 0 ? 'inline-flex' : 'none';
    }

    function handleReverseChange(event) {
        const reverseCheckbox = event.target;
        const playerId = parseInt(reverseCheckbox.dataset.playerId);
        const cost = parseInt(reverseCheckbox.dataset.cost);

        // Uncheck other reverse options for the same player
        bidsInputsDiv.querySelectorAll(`.reverse-cb[data-player-id="${playerId}"]`).forEach(cb => {
            if (cb !== reverseCheckbox) cb.checked = false;
        });

        // If a reversal is checked
        if (reverseCheckbox.checked) {
            gameState.reversalInfoForRound = { playerId, cost };
            // Uncheck and disable all other players' reversal options
            bidsInputsDiv.querySelectorAll('.reverse-cb').forEach(cb => {
                if (parseInt(cb.dataset.playerId) !== playerId) {
                    cb.checked = false;
                    cb.disabled = true;
                }
            });
            // If combo, check the main abandon box and disable it
            const abandonCheckbox = document.getElementById(`abandon-player-${playerId}`);
            if (cost === 3 && abandonCheckbox) {
                abandonCheckbox.checked = true;
                abandonCheckbox.disabled = true; // Lock it in
                handleAbandonChange({ target: abandonCheckbox });
            }
        } else { // If a reversal is unchecked
            gameState.reversalInfoForRound = null;
            // Re-enable all reversal options (based on abandons left)
            bidsInputsDiv.querySelectorAll('.reverse-cb').forEach(cb => cb.disabled = false);
            // If combo, uncheck the main abandon box and re-enable it
            const abandonCheckbox = document.getElementById(`abandon-player-${playerId}`);
            if (cost === 3 && abandonCheckbox) {
                abandonCheckbox.checked = false;
                abandonCheckbox.disabled = false;
                handleAbandonChange({ target: abandonCheckbox });
            }
        }
        enforceRoundPlayerLimits();
    }


    function handleAbandonChange(event) {
        const abandonCheckbox = event.target;
        const playerId = parseInt(abandonCheckbox.dataset.playerId);
        const input = document.getElementById(`bid-player-${playerId}`);
        const group = abandonCheckbox.closest('.input-group');

        if (abandonCheckbox.checked) {
            input.disabled = true;
            input.value = "0";
            group.classList.add('abandoned');
        } else {
            // Prevent unchecking if it's part of a locked-in reversal combo
            if (gameState.reversalInfoForRound?.playerId === playerId && gameState.reversalInfoForRound?.cost === 3) {
                abandonCheckbox.checked = true;
                return;
            }
            input.disabled = false;
            group.classList.remove('abandoned');
        }
        updateTotalBids();
        enforceRoundPlayerLimits();
    }

    function enforceRoundPlayerLimits() {
        let abandonedCount = 0;
        bidsInputsDiv.querySelectorAll('.abandon-cb').forEach(cb => {
            if (cb.checked) abandonedCount++;
        });

        // Rule: At least two players must play.
        if (gameState.numPlayers - abandonedCount <= 2) {
            bidsInputsDiv.querySelectorAll('.abandon-cb:not(:checked)').forEach(cb => cb.disabled = true);
        } else {
            bidsInputsDiv.querySelectorAll('.abandon-cb').forEach(cb => {
                // re-enable unless it's locked by a reversal
                const playerId = parseInt(cb.dataset.playerId);
                if (!gameState.reversalInfoForRound || gameState.reversalInfoForRound.playerId !== playerId || gameState.reversalInfoForRound.cost !== 3) {
                    cb.disabled = false;
                }
            });
        }
    }

    function updateTotalBids() {
        let total = 0;
        bidsInputsDiv.querySelectorAll('input[type="number"]:not(:disabled)').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        totalBidsSpan.textContent = total;
    }

    submitBidsBtn.addEventListener('click', () => {
        errorBids.textContent = '';
        const currentCards = gameState.roundCardSequence[gameState.currentRound];
        const currentBids = {};
        const abandonedPlayerIndexes = new Set();

        bidsInputsDiv.querySelectorAll('.abandon-cb:checked').forEach(cb => abandonedPlayerIndexes.add(parseInt(cb.dataset.playerId)));

        if (gameState.numPlayers > 2 && gameState.players.length - abandonedPlayerIndexes.size < 2) {
            errorBids.textContent = "Au moins deux joueurs doivent participer à la manche.";
            return;
        }

        let allBidsValid = true;
        gameState.players.forEach((player, playerId) => {
            if (abandonedPlayerIndexes.has(playerId)) {
                currentBids[player.name] = 'A';
            } else {
                const input = document.getElementById(`bid-player-${playerId}`);
                const bidValue = parseInt(input.value);
                if (isNaN(bidValue) || bidValue < 0 || bidValue > currentCards) allBidsValid = false;
                currentBids[player.name] = bidValue;
            }
        });

        if (!allBidsValid) {
            errorBids.textContent = `Les annonces doivent être entre 0 et ${currentCards}.`;
            return;
        }

        const isAscent = gameState.currentRound <= gameState.peakRound;

        if (gameState.reversalInfoForRound) {
            const { playerId, cost } = gameState.reversalInfoForRound;
            const player = gameState.players[playerId];
            player.reversalsUsed++;
            player.totalAbandons += cost;
            if (isAscent) player.abandonsUsedAscent += cost;
            else player.abandonsUsedDescent += cost;
            gameState.distributionDirection = (gameState.distributionDirection === 'clockwise') ? 'counter-clockwise' : 'clockwise';
        }

        abandonedPlayerIndexes.forEach(playerId => {
            // Only count abandon cost if it wasn't part of a combo
            if (!gameState.reversalInfoForRound || gameState.reversalInfoForRound.playerId !== playerId || gameState.reversalInfoForRound.cost !== 3) {
                const player = gameState.players[playerId];
                player.totalAbandons++;
                if (isAscent) player.abandonsUsedAscent++;
                else player.abandonsUsedDescent++;
            }
        });

        const roundData = {
            roundNum: gameState.currentRound + 1,
            cards: currentCards,
            dealer: gameState.players[gameState.currentDealerIndex].name,
            bids: currentBids,
            reversalInfo: gameState.reversalInfoForRound
        };
        gameState.roundHistory[gameState.currentRound] = roundData;

        setupTricksPhase();
    });

    function setupTricksPhase() {
        gameState.currentPhase = 'tricks';
        const currentCards = gameState.roundCardSequence[gameState.currentRound];
        const bidsForRound = gameState.roundHistory[gameState.currentRound].bids;

        tricksInputsDiv.innerHTML = '';
        gameState.players.forEach((player, index) => {
            const bid = bidsForRound[player.name];
            const div = document.createElement('div');
            div.className = 'input-group';
            if (bid === 'A') {
                div.innerHTML = `<span class="parole-indicator">&nbsp;</span><label>${player.name}:</label> <em>(A abandonné)</em>`;
            } else {
                div.innerHTML = `
                    <span class="parole-indicator">&nbsp;</span>
                    <label for="trick-player-${index}">${player.name} (Annonce: ${bid}):</label>
                    <input type="number" id="trick-player-${index}" min="0" max="${currentCards}" value="0" data-player-id="${index}">
                `;
            }
            tricksInputsDiv.appendChild(div);
        });

        tricksInputsDiv.querySelectorAll('input[type="number"]').forEach(i => i.addEventListener('input', updateTotalTricksMade));
        cardsInRoundDisplayTricksSpan.textContent = currentCards.toString();
        updateTotalTricksMade();
        biddingPhaseDiv.style.display = 'none';
        tricksPhaseDiv.style.display = 'block';
        errorTricks.textContent = '';
    }

    function updateTotalTricksMade() {
        let total = 0;
        tricksInputsDiv.querySelectorAll('input[type="number"]').forEach(input => {
            total += parseInt(input.value) || 0;
        });
        totalTricksMadeSpan.textContent = total;
    }

    submitTricksBtn.addEventListener('click', () => {
        errorTricks.textContent = '';
        const currentCards = gameState.roundCardSequence[gameState.currentRound];
        let totalTricks = 0;
        const currentTricks = {};
        let allTricksValid = true;

        gameState.players.forEach((player, playerId) => {
            const bid = gameState.roundHistory[gameState.currentRound].bids[player.name];
            if (bid === 'A') {
                currentTricks[player.name] = 0;
            } else {
                const input = document.getElementById(`trick-player-${playerId}`);
                const tricksValue = parseInt(input.value);
                if (isNaN(tricksValue) || tricksValue < 0 || tricksValue > currentCards) allTricksValid = false;
                totalTricks += tricksValue;
                currentTricks[player.name] = tricksValue;
            }
        });

        if (!allTricksValid) {
            errorTricks.textContent = `Les levées doivent être entre 0 et ${currentCards}.`;
            return;
        }

        if (totalTricks !== currentCards) {
            errorTricks.textContent = `Le total des levées (${totalTricks}) doit être égal au nombre de cartes (${currentCards}).`;
            return;
        }

        gameState.roundHistory[gameState.currentRound].tricks = currentTricks;
        calculateRoundScores();
        updateLiveScoreboard();

        gameState.currentRound++;
        if (gameState.currentRound >= gameState.totalRounds) {
            endGame();
        } else {
            startGameUI();
        }
        saveGameState();
    });

    function calculateRoundScores() {
        const roundData = gameState.roundHistory[gameState.currentRound];
        roundData.scoresChange = {};
        gameState.players.forEach(player => {
            const bid = roundData.bids[player.name];
            let scoreChange = 0;
            if (bid === 'A') {
                player.bidsHistory.push(null);
                player.tricksHistory.push(null);
            } else {
                const tricksWon = roundData.tricks[player.name];
                player.bidsHistory.push(bid);
                player.tricksHistory.push(tricksWon);
                if (bid === tricksWon) {
                    scoreChange = 5 + (5 * tricksWon);
                    player.contractsMade++;
                } else {
                    const diff = Math.abs(bid - tricksWon);
                    scoreChange = -(5 + (5 * diff));
                    player.contractsBroken++;
                }
            }
            player.score += scoreChange;
            roundData.scoresChange[player.name] = scoreChange;
        });
    }

    function updateLiveScoreboard() {
        scoresTbody.innerHTML = '';
        gameState.players.forEach(player => {
            const tr = scoresTbody.insertRow();
            tr.insertCell().textContent = player.name;
            tr.insertCell().textContent = player.score;
        });
    }

    // --- Fin de Partie ---
    function endGame() {
        if (gameState.gameOptions.bonus) {
            gameState.players.forEach(player => {
                if (player.totalAbandons === 10) {
                    if (player.contractsBroken === 0) player.bonusPoints = 60;
                    else if (player.contractsBroken === 1) player.bonusPoints = 30;
                    else if (player.contractsBroken === 2) player.bonusPoints = 15;
                    player.score += player.bonusPoints;
                }
            });
        }

        showScreen('end-game-screen');
        const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
        winnerNameSpan.textContent = `${sortedPlayers[0].name} (avec ${sortedPlayers[0].score} points)`;

        finalScoresTbody.innerHTML = '';
        sortedPlayers.forEach(player => {
            const tr = finalScoresTbody.insertRow();
            tr.insertCell().textContent = player.name;
            tr.insertCell().textContent = player.score;
            tr.insertCell().textContent = player.contractsMade;
            tr.insertCell().textContent = player.contractsBroken;
            tr.insertCell().textContent = player.totalAbandons;
            tr.insertCell().textContent = player.reversalsUsed;
            tr.insertCell().textContent = player.bonusPoints > 0 ? `+${player.bonusPoints}` : '0';
        });

        generateCharts();
    }

    function generateCharts() {
        if (scoreEvolutionChartInstance) scoreEvolutionChartInstance.destroy();
        if (contractsChartInstance) contractsChartInstance.destroy();

        const labels = Array.from({ length: gameState.totalRounds }, (_, i) => `Manche ${i + 1}`);
        const datasetsScore = gameState.players.map(player => {
            const scoresOverTime = [];
            let currentScore = 0;
            gameState.roundHistory.forEach(round => {
                currentScore += (round.scoresChange[player.name] || 0);
                scoresOverTime.push(currentScore);
            });
            if (player.bonusPoints > 0) scoresOverTime[scoresOverTime.length - 1] += player.bonusPoints;

            return {
                label: player.name, data: scoresOverTime, borderColor: getRandomColor(), tension: 0.1, fill: false
            };
        });

        if (scoreEvolutionChartCtx) {
            scoreEvolutionChartInstance = new Chart(scoreEvolutionChartCtx, {
                type: 'line', data: { labels, datasets: datasetsScore },
                options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Évolution des Scores' } } }
            });
        }

        const contractsData = {
            labels: gameState.players.map(p => p.name),
            datasets: [
                { label: 'Contrats Réussis', data: gameState.players.map(p => p.contractsMade), backgroundColor: '#10b981' },
                { label: 'Contrats Rompus', data: gameState.players.map(p => p.contractsBroken), backgroundColor: '#ef4444' }
            ]
        };
        if (contractsChartCtx) {
            contractsChartInstance = new Chart(contractsChartCtx, {
                type: 'bar', data: contractsData,
                options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Performance des Contrats' } }, scales: { y: { beginAtZero: true } } }
            });
        }
    }

    function getRandomColor() {
        const colors = [
            '#6366f1', // Indigo 500
            '#8b5cf6', // Violet 500
            '#ec4899', // Pink 500
            '#06b6d4', // Cyan 500
            '#10b981', // Emerald 500
            '#f59e0b', // Amber 500
            '#3b82f6', // Blue 500
            '#f43f5e'  // Rose 500
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    exportPdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const margin = 40;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        let currentY = margin;

        // Titre
        pdf.setFontSize(18);
        pdf.text("Récapitulatif Partie d'Escalier", pageWidth / 2, currentY, { align: 'center' });
        currentY += 28;

        // 1) Tableau des scores finaux
        const finalScoresHeader = [['Joueur', 'Score', 'Réussis', 'Rompus', 'Abandons', 'Inversions', 'Bonus']];
        const finalScoresBody = [...gameState.players].sort((a, b) => b.score - a.score).map(p =>
            [p.name, p.score, p.contractsMade, p.contractsBroken, p.totalAbandons, p.reversalsUsed, p.bonusPoints]
        );
        pdf.autoTable({
            startY: currentY,
            head: finalScoresHeader,
            body: finalScoresBody,
            theme: 'striped',
            headStyles: { fillColor: [0, 123, 255] },
            styles: { fontSize: 10 }
        });
        currentY = (pdf.previousAutoTable && pdf.previousAutoTable.finalY) ? pdf.previousAutoTable.finalY + 18 : currentY + 18;

        // 2) Tableau détaillé manche par manche (une ligne par joueur/par manche)
        const roundsRows = [];
        // Si roundHistory vide, ajouter info
        if (!gameState.roundHistory || gameState.roundHistory.length === 0) {
            roundsRows.push(['-', '-', '-', '-', '-', '-', '-', '-']);
        } else {
            gameState.roundHistory.forEach((round) => {
                const roundNum = round.roundNum ?? '-';
                const cards = round.cards ?? '-';
                const dealer = round.dealer ?? '-';
                const reversalText = (round.reversalInfo && gameState.players[round.reversalInfo.playerId])
                    ? `${gameState.players[round.reversalInfo.playerId].name} (coût ${round.reversalInfo.cost})`
                    : '';
                gameState.players.forEach(player => {
                    const bid = round.bids ? (round.bids[player.name] ?? '') : '';
                    const tricks = round.tricks ? (round.tricks[player.name] ?? '') : '';
                    const scoreChange = round.scoresChange ? (round.scoresChange[player.name] ?? '') : '';
                    roundsRows.push([roundNum, cards, dealer, player.name, bid === 'A' ? 'A' : bid, tricks, scoreChange, reversalText]);
                });
            });
        }

        pdf.autoTable({
            startY: currentY,
            head: [['Manche', 'Cartes', 'Donneur', 'Joueur', 'Annonce', 'Levées', 'Delta', 'Inversion']],
            body: roundsRows,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 4 },
            headStyles: { fillColor: [40, 40, 40] },
            columnStyles: {
                0: { cellWidth: 36 }, // Manche
                1: { cellWidth: 36 }, // Cartes
                2: { cellWidth: 70 }, // Donneur
                3: { cellWidth: 80 }, // Joueur
                4: { cellWidth: 50 }, // Annonce
                5: { cellWidth: 50 }, // Levées
                6: { cellWidth: 50 }, // Delta
                7: { cellWidth: 120 } // Inversion
            }
        });
        currentY = (pdf.previousAutoTable && pdf.previousAutoTable.finalY) ? pdf.previousAutoTable.finalY + 18 : currentY + 18;

        // 3) Graphiques (forcer génération si nécessaire)
        // S'assurer que les charts existent et sont mis à jour
        if (!scoreEvolutionChartInstance || !contractsChartInstance) {
            try { generateCharts(); } catch (e) { /* ignore */ }
        }

        // Helper: ajouter image et respecter page break
        function addImageToPdf(imgData, imgW, imgH) {
            if (currentY + imgH > pageHeight - margin) {
                pdf.addPage();
                currentY = margin;
            }
            pdf.addImage(imgData, 'PNG', margin, currentY, imgW, imgH);
            currentY += imgH + 12;
        }

        // Score evolution chart
        const scoreCanvasEl = document.getElementById('score-evolution-chart');
        if (scoreCanvasEl) {
            try {
                const imgData = scoreCanvasEl.toDataURL('image/png', 1.0);
                const maxImgW = pageWidth - margin * 2;
                const imgH = (scoreCanvasEl.height / scoreCanvasEl.width) * maxImgW;
                addImageToPdf(imgData, maxImgW, imgH);
            } catch (e) {
                // ignore if cannot export image
            }
        }

        // Contracts chart
        const contractsCanvasEl = document.getElementById('contracts-chart');
        if (contractsCanvasEl) {
            try {
                const imgData = contractsCanvasEl.toDataURL('image/png', 1.0);
                const maxImgW = pageWidth - margin * 2;
                const imgH = (contractsCanvasEl.height / contractsCanvasEl.width) * maxImgW;
                addImageToPdf(imgData, maxImgW, imgH);
            } catch (e) {
                // ignore
            }
        }

        // 4) Récapitulatif des options et méta
        const metaLines = [
            [`Date: ${new Date().toLocaleString()}`],
            [`Joueurs: ${gameState.numPlayers}`],
            [`Abandons autorisés: ${gameState.gameOptions.abandons}`],
            [`Bonus activé: ${gameState.gameOptions.bonus ? 'Oui' : 'Non'}`],
            [`Direction distribution actuelle: ${gameState.distributionDirection}`]
        ];
        // Si plus de place, ajouter nouvelle page
        if (currentY + 80 > pageHeight - margin) { pdf.addPage(); currentY = margin; }
        pdf.setFontSize(10);
        metaLines.forEach(line => {
            pdf.text(line[0], margin, currentY);
            currentY += 14;
        });

        // Sauvegarde finale
        const filename = `Escalier_Partie_${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(filename);
    });

    // --- Initialisation et Fonctions de Test ---
    function checkExistingGame() {
        loadGameBtn.style.display = localStorage.getItem('escalierGameState') ? 'inline-block' : 'none';
    }

    generatePlayerNameInputs();
    showScreen('setup-screen');
    checkExistingGame();
    optionBonusCheckbox.disabled = true;

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i> Mode Clair';
        } else {
            document.body.classList.remove('dark-mode');
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i> Mode Sombre';
        }
    }
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    themeToggleBtn.addEventListener('click', () => {
        const isDarkMode = document.body.classList.toggle('dark-mode');
        const newTheme = isDarkMode ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    let setupTitleClicks = 0, mainTitleClicks = 0;
    const setupTitle = document.getElementById('setup-title'), mainTitle = document.getElementById('main-title');
    setupTitle.addEventListener('click', () => { setupTitleClicks++; if (setupTitleClicks >= 3 && mainTitleClicks >= 2) createTestGameBtn.style.display = 'inline-block'; });
    mainTitle.addEventListener('click', () => { mainTitleClicks++; if (setupTitleClicks >= 3 && mainTitleClicks >= 2) createTestGameBtn.style.display = 'inline-block'; });

    // Replace the existing createTestGameBtn click handler with the following to add a configurable test mode
    createTestGameBtn.addEventListener('click', async () => {
        // Ask test parameters
        let abandons = prompt("Nombre d'abandons autorisés pour la partie test ? (0, 1, 3, 5)", "5");
        if (abandons === null) return; // cancel
        abandons = parseInt(abandons, 10);
        if (![0, 1, 3, 5].includes(abandons)) {
            alert("Valeur d'abandons invalide. Utilisez 0, 1, 3 ou 5.");
            return;
        }
        let bonusAnswer = prompt("Activer les bonus pour la partie test ? (oui/non)", "oui");
        if (bonusAnswer === null) return;
        bonusAnswer = /^o/i.test(bonusAnswer.trim());

        // Configure UI options (assumes radio inputs exist with ids option-abandon-0/1/3/5 and #option-bonus)
        const radioId = { 0: 'option-abandon-none', 1: 'option-abandon-single', 3: 'option-abandon-triple', 5: 'option-abandon-quintuple' }[abandons];
        const radioEl = document.getElementById(radioId);
        if (radioEl) radioEl.checked = true;
        optionBonusCheckbox.disabled = !(abandons === 5);
        optionBonusCheckbox.checked = (abandons === 5) ? !!bonusAnswer : false;

        // Setup 5 players with requested names
        document.getElementById('num-players').value = '5';
        generatePlayerNameInputs();
        const names = ["Noah", "Spart", "Alex", "Nao", "Jean"];
        playerNamesInputsDiv.querySelectorAll('input').forEach((input, i) => input.value = names[i]);

        // Start configured game
        startGameBtn.click();

        // Wait a tick to ensure UI created
        await new Promise(r => setTimeout(r, 150));

        gameState.testMode = true;

        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

        function decideBid(playerName, currentCards, playerObj) {
            // Noah: medium stable bid (perfect player will match tricks)
            if (playerName === 'Noah') {
                return Math.min(currentCards, Math.max(0, Math.floor(currentCards / 2)));
            }
            // Alex: prefers to abandon when possible (handled by checking abandon checkbox), otherwise low/random bids
            if (playerName === 'Alex') {
                return Math.floor(Math.random() * Math.min(2, currentCards + 1));
            }
            // Jean: bids randomly but will always end up wrong
            if (playerName === 'Jean') {
                return Math.floor(Math.random() * (currentCards + 1));
            }
            // Spart & Nao: play normally most of the time
            return Math.floor(Math.random() * (currentCards + 1));
        }

        function decideTricks(playerName, bid, currentCards) {
            if (bid === 'A') return 0;
            if (playerName === 'Noah') return bid; // perfect
            if (playerName === 'Jean') {
                // always wrong: pick a different valid value
                for (let d = 1; d <= currentCards; d++) {
                    const val = (bid + d) % (currentCards + 1);
                    if (val !== bid) return val;
                }
                return (bid === 0) ? 1 : 0;
            }
            if (playerName === 'Alex') {
                // if not abandoned, often imperfect
                if (Math.random() < 0.6) {
                    // wrong: choose different value
                    const alt = (bid + 1) % (currentCards + 1);
                    return alt === bid ? Math.max(0, bid - 1) : alt;
                }
                return bid;
            }
            // Spart & Nao: occasionally wrong (20%)
            if (Math.random() < 0.2) {
                const alt = (bid + 1) % (currentCards + 1);
                return alt === bid ? Math.max(0, bid - 1) : alt;
            }
            return bid;
        }

        async function playRemainingRounds() {
            while (gameState.currentRound < gameState.totalRounds) {
                // Ensure bidding UI present
                if (gameState.currentPhase !== 'bidding') {
                    setupBiddingPhase();
                    await sleep(60);
                }

                const currentCards = gameState.roundCardSequence[gameState.currentRound];

                // Decide abandons first, trying to respect allowed abandons & rule "at least 2 players must play"
                // We'll attempt to have Alex abandon most often, then Spart/Nao sometimes.
                const abandonCandidates = ['Alex', 'Spart', 'Nao'];
                // Count abandons already used in this round via checkboxes will be handled via DOM elements
                // First clear any existing selections (defensive)
                bidsInputsDiv.querySelectorAll('.abandon-cb').forEach(cb => { cb.checked = false; cb.disabled = false; });
                bidsInputsDiv.querySelectorAll('.reverse-cb').forEach(cb => { cb.checked = false; cb.disabled = false; });
                gameState.reversalInfoForRound = null;
                await sleep(20);

                // For each player element, set bid or abandon based on strategy and available abandons
                const plannedBids = {}; // name -> bid or 'A'
                let plannedAbandons = 0;
                // Attempt to apply abandons in preferred order
                for (const player of gameState.players) {
                    const pid = gameState.players.indexOf(player);
                    const abandonCb = document.getElementById(`abandon-player-${pid}`);
                    const input = document.getElementById(`bid-player-${pid}`);
                    // default not abandon
                    let willAbandon = false;
                    if (player.name === 'Alex') {
                        // Alex abandons with high probability if allowed
                        if (abandonCb && !abandonCb.disabled && Math.random() < 0.8) willAbandon = true;
                    } else if (player.name === 'Spart' || player.name === 'Nao') {
                        if (abandonCb && !abandonCb.disabled && Math.random() < 0.15) willAbandon = true;
                    } else {
                        willAbandon = false;
                    }

                    // enforce at least two players playing
                    const remainingPlayers = gameState.numPlayers - plannedAbandons;
                    if (willAbandon && (remainingPlayers - 1) <= 2) {
                        willAbandon = false;
                    }

                    if (willAbandon && abandonCb && !abandonCb.disabled) {
                        abandonCb.checked = true;
                        if (input) { input.value = "0"; input.disabled = true; }
                        plannedBids[player.name] = 'A';
                        plannedAbandons++;
                    } else {
                        if (abandonCb) { abandonCb.checked = false; if (input) input.disabled = false; }
                        const bidVal = decideBid(player.name, currentCards, player);
                        if (input) input.value = String(Math.max(0, Math.min(currentCards, bidVal)));
                        plannedBids[player.name] = Math.max(0, Math.min(currentCards, bidVal));
                    }
                }

                // update totals & enforce limits UI
                updateTotalBids();
                enforceRoundPlayerLimits();

                // Submit bids (call the button handler via click)
                await sleep(80);
                submitBidsBtn.click();

                // Wait a bit to let tricks UI render
                await sleep(80);

                // Now fill tricks according to strategy while ensuring sum equals currentCards.
                const bidsForRound = gameState.roundHistory[gameState.currentRound].bids;
                const desiredTricks = {};
                let sumPlanned = 0;
                let lastPlayablePlayer = null;

                // 1. Collect planned tricks for each player (except abandon)
                gameState.players.forEach((player, idx) => {
                    const bid = bidsForRound[player.name];
                    if (bid === 'A') {
                        desiredTricks[player.name] = 0;
                    } else {
                        const planned = decideTricks(player.name, bid, currentCards);
                        desiredTricks[player.name] = Math.max(0, Math.min(currentCards, planned));
                        sumPlanned += desiredTricks[player.name];
                        lastPlayablePlayer = player.name;
                    }
                });

                // 2. Correction pour que la somme soit exactement currentCards
                const nonAbandonPlayers = gameState.players.filter(p => bidsForRound[p.name] !== 'A');
                let diff = currentCards - sumPlanned;
                if (nonAbandonPlayers.length > 0 && diff !== 0) {
                    // Répartir l'écart sur les joueurs non-abandon (en priorité le dernier)
                    let idx = nonAbandonPlayers.length - 1;
                    while (diff !== 0 && idx >= 0) {
                        const p = nonAbandonPlayers[idx];
                        const old = desiredTricks[p.name];
                        let newVal = old + diff;
                        if (newVal < 0) newVal = 0;
                        if (newVal > currentCards) newVal = currentCards;
                        diff -= (newVal - old);
                        desiredTricks[p.name] = newVal;
                        idx--;
                    }
                }

                // 3. Appliquer dans le DOM
                gameState.players.forEach((player, idx) => {
                    const bid = bidsForRound[player.name];
                    if (bid === 'A') return;
                    const inp = document.getElementById(`trick-player-${idx}`);
                    if (inp) inp.value = String(desiredTricks[player.name]);
                });

                updateTotalTricksMade();
                await sleep(60);

                // Submit tricks
                submitTricksBtn.click();

                // Small pause between rounds
                await sleep(150);
            }

            gameState.testMode = false;
            alert("Partie test terminée.");
        }

        // Start playing automatically
        playRemainingRounds();
    });

    // --- Initialisation de la Partie ---
    generatePlayerNameInputs();
    showScreen('setup-screen');
    checkExistingGame();
    optionBonusCheckbox.disabled = true;
});