/**
 * ============================================
 * AVÈNE GAME PLATFORM - GAME ENGINE
 * Interactive Word Placement Game Module
 * ============================================
 */

class AveneGameEngine {
    constructor(config = {}) {
        // Configuration
        this.apiBaseUrl = config.apiBaseUrl || '/api';
        this.supabaseUrl = config.supabaseUrl || 'https://pyqjgffygesrlfyfagms.supabase.co';
        this.supabaseKey = config.supabaseKey || 'sb_publishable_vltwOvN6j1ThYSos43EV9A_z7la0IFh';
        
        // Game State
        this.currentState = {
            niveau: null,           // Current difficulty level: '75%', '50%', '25%', '1%'
            question: null,         // Current question object
            answerZone: [],         // Array of words in answer zone
            poolZone: [],           // Array of available words
            questionsUsed: [],      // IDs of questions already used in this session
            agentId: null,          // Current agent ID
            pharmacyId: null,       // Current pharmacy ID
            tourneeId: null,        // Current tournee ID
            gameStarted: false,
            gameCompleted: false
        };
        
        // Level progression mapping
        this.levelSequence = ['75%', '50%', '25%', '1%'];
        this.cadeauTypes = {
            '75%': 'type1',
            '50%': 'type2',
            '25%': 'type3',
            '1%': 'superlot'
        };
        
        this.cadeauLabels = {
            'type1': 'Cadeau Type 1',
            'type2': 'Cadeau Type 2',
            'type3': 'Cadeau Type 3',
            'superlot': 'SUPER LOT'
        };
        
        // DOM Elements (to be initialized)
        this.dom = {};
        
        // Bind methods
        this.handleChipClick = this.handleChipClick.bind(this);
        this.handleValidation = this.handleValidation.bind(this);
        this.handleContinue = this.handleContinue.bind(this);
        this.handleTakeGift = this.handleTakeGift.bind(this);
    }
    
    /**
     * Initialize the game engine
     */
    async init(agentId, pharmacyId, tourneeId) {
        try {
            this.currentState.agentId = agentId;
            this.currentState.pharmacyId = pharmacyId;
            this.currentState.tourneeId = tourneeId;
            
            // Initialize DOM elements
            this.initDOM();
            
            // Start first level
            await this.startLevel('75%');
            
            console.log('Game engine initialized successfully');
        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.showError('Échec de l\'initialisation du jeu');
        }
    }
    
    /**
     * Initialize DOM element references
     */
    initDOM() {
        this.dom = {
            gameContainer: document.getElementById('game-container'),
            questionText: document.getElementById('question-text'),
            poolZone: document.getElementById('pool-zone'),
            answerZone: document.getElementById('answer-zone'),
            validateBtn: document.getElementById('validate-btn'),
            niveauIndicator: document.getElementById('niveau-indicator'),
            modalOverlay: document.getElementById('modal-overlay'),
            modalTitle: document.getElementById('modal-title'),
            modalBody: document.getElementById('modal-body'),
            modalFooter: document.getElementById('modal-footer'),
            bubbleContainer: document.getElementById('bubble-container')
        };
        
        // Add event listeners
        if (this.dom.validateBtn) {
            this.dom.validateBtn.addEventListener('click', this.handleValidation);
        }
    }
    
    /**
     * Start a new level with given difficulty
     */
    async startLevel(difficulte) {
        try {
            this.currentState.niveau = difficulte;
            this.currentState.answerZone = [];
            this.currentState.poolZone = [];
            
            // Update UI indicator
            this.updateNiveauIndicator(difficulte);
            
            // Fetch question from API
            const question = await this.fetchQuestion(difficulte);
            
            if (!question) {
                throw new Error('Aucune question disponible pour ce niveau');
            }
            
            this.currentState.question = question;
            this.currentState.questionsUsed.push(question.id);
            
            // Prepare word pools
            this.prepareWordPools(question);
            
            // Render game elements
            this.renderQuestion(question);
            this.renderPoolZone();
            this.renderAnswerZone();
            
            // Enable validation button
            if (this.dom.validateBtn) {
                this.dom.validateBtn.disabled = false;
            }
            
            console.log(`Level ${difficulte} started`);
        } catch (error) {
            console.error('Failed to start level:', error);
            this.showError('Échec du chargement de la question');
        }
    }
    
    /**
     * Fetch a random question from the API
     */
    async fetchQuestion(difficulte) {
        const url = `${this.apiBaseUrl}/questions?difficulte=${encodeURIComponent(difficulte)}&exclude=${this.currentState.questionsUsed.join(',')}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.supabaseKey
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch question');
        }
        
        return await response.json();
    }
    
    /**
     * Prepare word pools from question data
     */
    prepareWordPools(question) {
        const correctBlocks = question.blocs_corrects || [];
        const piegeBlocks = question.blocs_pieges || [];
        
        // Combine and shuffle all words
        const allWords = [...correctBlocks, ...piegeBlocks];
        this.currentState.poolZone = this.shuffleArray(allWords);
    }
    
    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    /**
     * Render the question text
     */
    renderQuestion(question) {
        if (this.dom.questionText) {
            this.dom.questionText.textContent = question.enonce;
            this.dom.questionText.classList.add('fade-in');
        }
    }
    
    /**
     * Render the pool zone with floating chips
     */
    renderPoolZone() {
        if (!this.dom.poolZone) return;
        
        this.dom.poolZone.innerHTML = '';
        
        this.currentState.poolZone.forEach((word, index) => {
            const chip = this.createChip(word, 'pool');
            chip.dataset.index = index;
            chip.style.animationDelay = `${index * 0.05}s`;
            this.dom.poolZone.appendChild(chip);
        });
    }
    
    /**
     * Render the answer zone with placed chips
     */
    renderAnswerZone() {
        if (!this.dom.answerZone) return;
        
        this.dom.answerZone.innerHTML = '';
        
        this.currentState.answerZone.forEach((word, index) => {
            const chip = this.createChip(word, 'answer');
            chip.dataset.index = index;
            this.dom.answerZone.appendChild(chip);
        });
    }
    
    /**
     * Create a word chip element
     */
    createChip(word, zone) {
        const chip = document.createElement('div');
        chip.className = 'chip thermal-float chip-pop';
        chip.textContent = word;
        chip.dataset.word = word;
        chip.dataset.zone = zone;
        
        chip.addEventListener('click', () => this.handleChipClick(word, zone));
        
        return chip;
    }
    
    /**
     * Handle chip click - move between zones
     */
    handleChipClick(word, fromZone) {
        // Remove chip from current zone
        if (fromZone === 'pool') {
            const index = this.currentState.poolZone.indexOf(word);
            if (index > -1) {
                this.currentState.poolZone.splice(index, 1);
                this.currentState.answerZone.push(word);
            }
        } else if (fromZone === 'answer') {
            const index = this.currentState.answerZone.indexOf(word);
            if (index > -1) {
                this.currentState.answerZone.splice(index, 1);
                this.currentState.poolZone.push(word);
            }
        }
        
        // Re-render zones with animations
        this.renderPoolZone();
        this.renderAnswerZone();
    }
    
    /**
     * Handle validation button click
     */
    async handleValidation() {
        if (!this.currentState.question) return;
        
        const userAnswer = this.currentState.answerZone;
        const correctAnswer = this.currentState.question.blocs_corrects;
        
        // Validate answer
        const isCorrect = this.validateAnswer(userAnswer, correctAnswer);
        
        if (isCorrect) {
            await this.handleCorrectAnswer();
        } else {
            await this.handleWrongAnswer();
        }
    }
    
    /**
     * Validate user answer against correct answer
     */
    validateAnswer(userAnswer, correctAnswer) {
        if (userAnswer.length !== correctAnswer.length) {
            return false;
        }
        
        for (let i = 0; i < userAnswer.length; i++) {
            if (userAnswer[i] !== correctAnswer[i]) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Handle correct answer
     */
    async handleCorrectAnswer() {
        // Show success animation
        this.showSuccessBubbles();
        
        // Check if this is the final level
        if (this.currentState.niveau === '1%') {
            // Auto-award super lot
            await this.awardGift('superlot', true);
        } else {
            // Show choice modal
            this.showChoiceModal();
        }
    }
    
    /**
     * Handle wrong answer
     */
    async handleWrongAnswer() {
        // Show shake animation
        if (this.dom.answerZone) {
            this.dom.answerZone.classList.add('wrong-answer-shake');
            setTimeout(() => {
                this.dom.answerZone.classList.remove('wrong-answer-shake');
            }, 800);
        }
        
        // Mark agent as lost
        await this.submitGameResult('Perdu', null, false);
        
        // Show game over modal
        setTimeout(() => {
            this.showModal(
                'À la prochaine !',
                '<p class="text-center">Ce n\'est pas la bonne réponse. Merci de votre participation !</p>',
                [{ text: 'Fermer', class: 'btn-primary', action: () => this.closeModal() }]
            );
        }, 1000);
    }
    
    /**
     * Show choice modal after correct answer
     */
    showChoiceModal() {
        const currentNiveau = this.currentState.niveau;
        const currentIndex = this.levelSequence.indexOf(currentNiveau);
        const nextNiveau = this.levelSequence[currentIndex + 1];
        
        const cadeauType = this.cadeauTypes[currentNiveau];
        const cadeauLabel = this.cadeauLabels[cadeauType];
        
        const buttons = [
            {
                text: `Prendre ${cadeauLabel}`,
                class: 'btn-primary button-pulse',
                action: () => this.handleTakeGift(cadeauType)
            }
        ];
        
        if (nextNiveau) {
            buttons.push({
                text: `Tenter le Niveau Supérieur (${nextNiveau})`,
                class: 'btn-secondary button-pulse-aqua',
                action: () => this.handleContinue(nextNiveau)
            });
        }
        
        this.showModal(
            'Félicitations !',
            `<p class="text-center mb-3">Vous avez réussi le niveau ${currentNiveau} !</p>
             <p class="text-center text-muted">Souhaitez-vous prendre votre cadeau ou tenter le niveau supérieur ?</p>`,
            buttons
        );
    }
    
    /**
     * Handle continue to next level
     */
    async handleContinue(nextNiveau) {
        this.closeModal();
        await this.startLevel(nextNiveau);
    }
    
    /**
     * Handle taking gift and ending game
     */
    async handleTakeGift(cadeauType) {
        this.closeModal();
        await this.awardGift(cadeauType, false);
    }
    
    /**
     * Award gift to agent
     */
    async awardGift(cadeauType, isSuperLot) {
        try {
            // Check stock availability
            const stockAvailable = await this.checkStock(cadeauType);
            
            if (!stockAvailable && !isSuperLot) {
                this.showWarning(`Attention: Le ${this.cadeauLabels[cadeauType]} est en rupture de stock.`);
            }
            
            // Determine result label
            const resultat = isSuperLot ? 'Gagné Super Lot' : `Gagné ${this.cadeauLabels[cadeauType]}`;
            
            // Submit game result
            await this.submitGameResult(resultat, cadeauType, true);
            
            // Decrement stock if available
            if (stockAvailable) {
                await this.decrementStock(cadeauType);
            }
            
            // Show success modal
            this.showModal(
                isSuperLot ? '🎉 SUPER LOT DÉBLOQUÉ ! 🎉' : 'Cadeau Remporté !',
                `<p class="text-center">Vous avez remporté : <strong>${this.cadeauLabels[cadeauType]}</strong></p>
                 ${!stockAvailable && !isSuperLot ? '<p class="alert alert-warning">Note: Ce cadeau sera livré ultérieurement (rupture de stock actuelle)</p>' : ''}`,
                [{ text: 'Terminer', class: 'btn-primary', action: () => this.closeModal() }]
            );
            
            this.currentState.gameCompleted = true;
        } catch (error) {
            console.error('Failed to award gift:', error);
            this.showError('Erreur lors de l\'attribution du cadeau');
        }
    }
    
    /**
     * Check stock availability
     */
    async checkStock(cadeauType) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/tournees/${this.currentState.tourneeId}/stock`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                }
            });
            
            if (!response.ok) return false;
            
            const data = await response.json();
            const stock = data.stock_actuel || {};
            
            return (stock[cadeauType] || 0) > 0;
        } catch (error) {
            console.error('Failed to check stock:', error);
            return false;
        }
    }
    
    /**
     * Decrement stock for awarded gift
     */
    async decrementStock(cadeauType) {
        try {
            await fetch(`${this.apiBaseUrl}/tournees/${this.currentState.tourneeId}/stock/decrement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify({ cadeau_type: cadeauType })
            });
        } catch (error) {
            console.error('Failed to decrement stock:', error);
        }
    }
    
    /**
     * Submit game result to backend
     */
    async submitGameResult(resultat, cadeauDescription, cadeauAssigne) {
        try {
            const question = this.currentState.question;
            
            const bilanData = {
                tournee_id: this.currentState.tourneeId,
                pharmacy_id: this.currentState.pharmacyId,
                agent_id: this.currentState.agentId,
                nom_pharmacie: '', // Will be filled by backend
                nom_agent: '',     // Will be filled by backend
                q1: question ? question.enonce : null,
                r1: this.currentState.answerZone.join(' '),
                q2: null, r2: null,
                q3: null, r3: null,
                q4: null, r4: null,
                niveau_atteint: this.currentState.niveau,
                resultat: resultat,
                cadeau_assigne: cadeauAssigne,
                cadeau_description: cadeauDescription || 'Aucun'
            };
            
            await fetch(`${this.apiBaseUrl}/game/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify(bilanData)
            });
            
            // Update agent status
            await this.updateAgentStatus(resultat);
        } catch (error) {
            console.error('Failed to submit game result:', error);
        }
    }
    
    /**
     * Update agent status in database
     */
    async updateAgentStatus(statut) {
        try {
            await fetch(`${this.apiBaseUrl}/agents/${this.currentState.agentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                },
                body: JSON.stringify({ statut_jeu: statut })
            });
        } catch (error) {
            console.error('Failed to update agent status:', error);
        }
    }
    
    /**
     * Show success bubble animation
     */
    showSuccessBubbles() {
        if (!this.dom.bubbleContainer) return;
        
        this.dom.bubbleContainer.innerHTML = '';
        
        // Create multiple bubbles
        for (let i = 0; i < 7; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'success-bubble';
            this.dom.bubbleContainer.appendChild(bubble);
        }
        
        // Remove container after animation
        setTimeout(() => {
            if (this.dom.bubbleContainer) {
                this.dom.bubbleContainer.innerHTML = '';
            }
        }, 5000);
    }
    
    /**
     * Show modal dialog
     */
    showModal(title, bodyHtml, buttons) {
        if (!this.dom.modalOverlay) return;
        
        // Set content
        if (this.dom.modalTitle) {
            this.dom.modalTitle.textContent = title;
        }
        
        if (this.dom.modalBody) {
            this.dom.modalBody.innerHTML = bodyHtml;
        }
        
        // Clear and create buttons
        if (this.dom.modalFooter) {
            this.dom.modalFooter.innerHTML = '';
            
            buttons.forEach(btnConfig => {
                const btn = document.createElement('button');
                btn.className = `btn ${btnConfig.class}`;
                btn.textContent = btnConfig.text;
                btn.addEventListener('click', () => {
                    if (typeof btnConfig.action === 'function') {
                        btnConfig.action();
                    }
                });
                this.dom.modalFooter.appendChild(btn);
            });
        }
        
        // Show modal
        this.dom.modalOverlay.classList.add('active');
    }
    
    /**
     * Close modal dialog
     */
    closeModal() {
        if (this.dom.modalOverlay) {
            this.dom.modalOverlay.classList.remove('active');
        }
    }
    
    /**
     * Update niveau indicator UI
     */
    updateNiveauIndicator(niveau) {
        if (!this.dom.niveauIndicator) return;
        
        const badges = {
            '75%': 'badge-info',
            '50%': 'badge-warning',
            '25%': 'badge-error',
            '1%': 'badge-success pulse-glow'
        };
        
        this.dom.niveauIndicator.innerHTML = `
            <span class="badge ${badges[niveau] || 'badge-info'}">
                Niveau ${niveau}
            </span>
        `;
    }
    
    /**
     * Show error message
     */
    showError(message) {
        this.showAlert(message, 'error');
    }
    
    /**
     * Show warning message
     */
    showWarning(message) {
        this.showAlert(message, 'warning');
    }
    
    /**
     * Show alert message
     */
    showAlert(message, type = 'error') {
        const alertClass = type === 'error' ? 'alert-error' : 
                          type === 'warning' ? 'alert-warning' : 'alert-success';
        
        const alertHtml = `
            <div class="alert ${alertClass} fade-in">
                ${message}
            </div>
        `;
        
        if (this.dom.gameContainer) {
            const existingAlert = this.dom.gameContainer.querySelector('.alert');
            if (existingAlert) {
                existingAlert.remove();
            }
            
            this.dom.gameContainer.insertAdjacentHTML('afterbegin', alertHtml);
            
            setTimeout(() => {
                const alertEl = this.dom.gameContainer.querySelector('.alert');
                if (alertEl) {
                    alertEl.remove();
                }
            }, 5000);
        }
    }
    
    /**
     * Reset game state
     */
    reset() {
        this.currentState = {
            niveau: null,
            question: null,
            answerZone: [],
            poolZone: [],
            questionsUsed: [],
            agentId: null,
            pharmacyId: null,
            tourneeId: null,
            gameStarted: false,
            gameCompleted: false
        };
        
        // Clear UI
        if (this.dom.questionText) this.dom.questionText.textContent = '';
        if (this.dom.poolZone) this.dom.poolZone.innerHTML = '';
        if (this.dom.answerZone) this.dom.answerZone.innerHTML = '';
        if (this.dom.niveauIndicator) this.dom.niveauIndicator.innerHTML = '';
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AveneGameEngine;
}
