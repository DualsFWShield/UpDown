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
                if(isAscent) player.abandonsUsedAscent -= reversalInfo.cost;
                else player.abandonsUsedDescent -= reversalInfo.cost;
            }
             
            if (bid === 'A') {
                if(!reversalInfo || reversalInfo.playerId !== playerId || reversalInfo.cost !== 3){
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
                handleAbandonChange({target: abandonCheckbox});
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
                handleAbandonChange({target: abandonCheckbox});
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
            if(gameState.reversalInfoForRound?.playerId === playerId && gameState.reversalInfoForRound?.cost === 3){
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
            if(cb.checked) abandonedCount++;
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

        if(gameState.reversalInfoForRound) {
            const { playerId, cost } = gameState.reversalInfoForRound;
            const player = gameState.players[playerId];
            player.reversalsUsed++;
            player.totalAbandons += cost;
            if(isAscent) player.abandonsUsedAscent += cost;
            else player.abandonsUsedDescent += cost;
            gameState.distributionDirection = (gameState.distributionDirection === 'clockwise') ? 'counter-clockwise' : 'clockwise';
        }

        abandonedPlayerIndexes.forEach(playerId => {
            // Only count abandon cost if it wasn't part of a combo
            if(!gameState.reversalInfoForRound || gameState.reversalInfoForRound.playerId !== playerId || gameState.reversalInfoForRound.cost !== 3){
                const player = gameState.players[playerId];
                player.totalAbandons++;
                if(isAscent) player.abandonsUsedAscent++;
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
            if(player.bonusPoints > 0) scoresOverTime[scoresOverTime.length - 1] += player.bonusPoints;

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
                { label: 'Contrats Réussis', data: gameState.players.map(p => p.contractsMade), backgroundColor: 'rgba(75, 192, 192, 0.6)' },
                { label: 'Contrats Rompus', data: gameState.players.map(p => p.contractsBroken), backgroundColor: 'rgba(255, 99, 132, 0.6)' }
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
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);
        return `rgb(${r},${g},${b})`;
    }

    exportPdfBtn.addEventListener('click', () => {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'pt', 'a4');
        const margin = 40;
        let currentY = margin;

        pdf.setFontSize(20);
        pdf.text("Récapitulatif Partie d'Escalier", pdf.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
        currentY += 30;

        const finalScoresHeader = [['Joueur', 'Score', 'Réussis', 'Rompus', 'Abandons', 'Inversions', 'Bonus']];
        const finalScoresBody = [...gameState.players].sort((a,b) => b.score - a.score).map(p => 
            [p.name, p.score, p.contractsMade, p.contractsBroken, p.totalAbandons, p.reversalsUsed, p.bonusPoints]
        );
        pdf.autoTable({
            startY: currentY, head: finalScoresHeader, body: finalScoresBody,
            theme: 'striped', headStyles: { fillColor: [0, 123, 255] },
        });
        currentY = pdf.previousAutoTable.finalY + 30;
        
        pdf.save(`Escalier_Partie_${new Date().toISOString().slice(0,10)}.pdf`);
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
    
    createTestGameBtn.addEventListener('click', () => {
        document.getElementById('num-players').value = '4';
        generatePlayerNameInputs();
        const names = ["Alice", "Bob", "Charlie", "Diana"];
        playerNamesInputsDiv.querySelectorAll('input').forEach((input, i) => input.value = names[i]);
        document.getElementById('option-abandon-quintuple').checked = true;
        document.getElementById('option-bonus').disabled = false;
        document.getElementById('option-bonus').checked = true;
        startGameBtn.click();
        autoFillScoresBtn.style.display = 'inline-block';
    });

    autoFillScoresBtn.addEventListener('click', () => {
        if(gameState.currentPhase === 'bidding') {
             bidsInputsDiv.querySelectorAll('input[type="number"]:not(:disabled)').forEach(input => {
                input.value = Math.floor(Math.random() * 2);
             });
            updateTotalBids();
            setTimeout(() => submitBidsBtn.click(), 100);
        } else if (gameState.currentPhase === 'tricks') {
            const trickInputs = document.querySelectorAll('#tricks-inputs input[type="number"]');
            let currentCards = gameState.roundCardSequence[gameState.currentRound];
            let tricksAssigned = 0;
            trickInputs.forEach((input, index) => {
                if (index < trickInputs.length - 1) {
                    const maxPossible = currentCards - tricksAssigned;
                    const randomTricks = Math.floor(Math.random() * (maxPossible + 1));
                    input.value = randomTricks;
                    tricksAssigned += randomTricks;
                } else {
                    input.value = currentCards - tricksAssigned;
                }
            });
            updateTotalTricksMade();
            setTimeout(() => submitTricksBtn.click(), 100);
        }
    });
});