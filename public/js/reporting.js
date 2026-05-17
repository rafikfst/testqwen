/**
 * ============================================
 * AVÈNE GAME PLATFORM - REPORTING MODULE
 * Dashboard & Excel Export Functionality
 * ============================================
 */

class AveneReporting {
    constructor(config = {}) {
        this.apiBaseUrl = config.apiBaseUrl || '/api';
        this.supabaseKey = config.supabaseKey || 'sb_publishable_vltwOvN6j1ThYSos43EV9A_z7la0IFh';
        
        // Table columns configuration
        this.columns = [
            { key: 'id', label: 'ID', width: 60 },
            { key: 'nom_pharmacie', label: 'Pharmacie', width: 200 },
            { key: 'nom_agent', label: 'Agent', width: 150 },
            { key: 'q1', label: 'Question 1', width: 300 },
            { key: 'r1', label: 'Réponse 1', width: 200 },
            { key: 'q2', label: 'Question 2', width: 300 },
            { key: 'r2', label: 'Réponse 2', width: 200 },
            { key: 'q3', label: 'Question 3', width: 300 },
            { key: 'r3', label: 'Réponse 3', width: 200 },
            { key: 'q4', label: 'Question 4', width: 300 },
            { key: 'r4', label: 'Réponse 4', width: 200 },
            { key: 'niveau_atteint', label: 'Niveau', width: 100 },
            { key: 'resultat', label: 'Résultat', width: 150 },
            { key: 'cadeau_assigne', label: 'Cadeau', width: 100 },
            { key: 'cadeau_description', label: 'Description Cadeau', width: 200 },
            { key: 'created_at', label: 'Date', width: 150 },
            { key: 'region', label: 'Région', width: 150 }
        ];
        
        this.data = [];
        this.dom = {};
    }
    
    /**
     * Initialize reporting dashboard
     */
    async init(containerId) {
        try {
            this.dom.container = document.getElementById(containerId);
            
            if (!this.dom.container) {
                throw new Error('Container element not found');
            }
            
            // Render UI
            this.renderUI();
            
            // Load data
            await this.loadData();
            
            console.log('Reporting module initialized');
        } catch (error) {
            console.error('Failed to initialize reporting:', error);
        }
    }
    
    /**
     * Render the reporting UI
     */
    renderUI() {
        this.dom.container.innerHTML = `
            <div class="card mb-4">
                <div class="flex-between flex-wrap gap-2 mb-3">
                    <h2 class="card-title">📊 Tableau de Bord - Bilan des Tournées</h2>
                    <div class="flex gap-2">
                        <button id="refresh-btn" class="btn btn-outline">
                            🔄 Actualiser
                        </button>
                        <button id="export-btn" class="btn btn-primary">
                            📥 Exporter Excel
                        </button>
                    </div>
                </div>
                
                <div id="stats-container" class="grid grid-4 mb-4"></div>
                
                <div class="table-responsive">
                    <table id="bilan-table" class="table">
                        <thead>
                            <tr id="table-header"></tr>
                        </thead>
                        <tbody id="table-body">
                            <tr>
                                <td colspan="${this.columns.length}" class="text-center">
                                    <div class="spinner"></div>
                                    <p class="mt-2 text-muted">Chargement des données...</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        // Bind event listeners
        const refreshBtn = document.getElementById('refresh-btn');
        const exportBtn = document.getElementById('export-btn');
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToExcel());
        }
        
        // Render table headers
        this.renderTableHeaders();
    }
    
    /**
     * Render table headers
     */
    renderTableHeaders() {
        const headerRow = document.getElementById('table-header');
        if (!headerRow) return;
        
        headerRow.innerHTML = this.columns.map(col => 
            `<th style="min-width: ${col.width}px">${col.label}</th>`
        ).join('');
    }
    
    /**
     * Load data from API
     */
    async loadData() {
        try {
            const tbody = document.getElementById('table-body');
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="${this.columns.length}" class="text-center">
                            <div class="spinner"></div>
                            <p class="mt-2 text-muted">Chargement des données...</p>
                        </td>
                    </tr>
                `;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/reporting`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch reporting data');
            }
            
            this.data = await response.json();
            
            // Update stats
            this.updateStats();
            
            // Render table
            this.renderTableBody();
            
        } catch (error) {
            console.error('Failed to load data:', error);
            this.showError('Échec du chargement des données');
        }
    }
    
    /**
     * Render table body with data
     */
    renderTableBody() {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;
        
        if (this.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${this.columns.length}" class="text-center">
                        <p class="text-muted">Aucune donnée disponible</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = this.data.map((row, index) => `
            <tr class="fade-in" style="animation-delay: ${index * 0.05}s">
                ${this.columns.map(col => {
                    let value = row[col.key];
                    
                    // Format values
                    if (value === null || value === undefined) {
                        value = '-';
                    } else if (col.key === 'cadeau_assigne') {
                        value = value ? '✅' : '❌';
                    } else if (col.key === 'created_at') {
                        value = this.formatDate(value);
                    } else if (['q1', 'q2', 'q3', 'q4'].includes(col.key) && value && value.length > 50) {
                        value = value.substring(0, 50) + '...';
                    }
                    
                    return `<td>${value}</td>`;
                }).join('')}
            </tr>
        `).join('');
    }
    
    /**
     * Update statistics cards
     */
    updateStats() {
        const statsContainer = document.getElementById('stats-container');
        if (!statsContainer) return;
        
        // Calculate stats
        const total = this.data.length;
        const won = this.data.filter(r => r.cadeau_assigne).length;
        const lost = this.data.filter(r => r.resultat === 'Perdu').length;
        const superLot = this.data.filter(r => r.resultat && r.resultat.includes('Super Lot')).length;
        
        const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
        
        const stats = [
            { label: 'Total Participants', value: total, icon: '👥', color: 'var(--avene-salmon)' },
            { label: 'Cadeaux Remportés', value: won, icon: '🎁', color: 'var(--success-green)' },
            { label: 'Taux de Réussite', value: `${winRate}%`, icon: '📈', color: 'var(--aqua-thermal)' },
            { label: 'Super Lots Gagnés', value: superLot, icon: '🏆', color: 'var(--warning-orange)' }
        ];
        
        statsContainer.innerHTML = stats.map(stat => `
            <div class="card text-center fade-in">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${stat.icon}</div>
                <div style="font-size: 2rem; font-weight: 700; color: ${stat.color}">${stat.value}</div>
                <div class="text-muted mt-1">${stat.label}</div>
            </div>
        `).join('');
    }
    
    /**
     * Export data to Excel
     */
    async exportToExcel() {
        try {
            // Check if XLSX library is loaded
            if (typeof XLSX === 'undefined') {
                // Dynamically load XLSX library
                await this.loadXLSXLibrary();
            }
            
            // Prepare data for export
            const exportData = this.prepareExportData();
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);
            
            // Set column widths
            ws['!cols'] = this.columns.map(col => ({ wpx: col.width }));
            
            // Style header row
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const address = XLSX.utils.encode_col(C) + "1";
                if (!ws[address]) continue;
                ws[address].s = {
                    fill: { fgColor: { rgb: "E37A5A" } },
                    font: { bold: true, color: { rgb: "FFFFFF" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, 'Bilan Avène');
            
            // Generate filename with region and date
            const region = this.getRegionFromData();
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `bilan_avene_${region}_${dateStr}.xlsx`;
            
            // Download file
            XLSX.writeFile(wb, filename);
            
            console.log('Excel exported successfully');
        } catch (error) {
            console.error('Failed to export Excel:', error);
            this.showError('Échec de l\'export Excel');
        }
    }
    
    /**
     * Load XLSX library dynamically
     */
    loadXLSXLibrary() {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="xlsx"]')) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Prepare data for Excel export
     */
    prepareExportData() {
        return this.data.map(row => {
            const exportRow = {};
            this.columns.forEach(col => {
                let value = row[col.key];
                
                if (value === null || value === undefined) {
                    value = '-';
                } else if (col.key === 'cadeau_assigne') {
                    value = value ? 'Oui' : 'Non';
                } else if (col.key === 'created_at') {
                    value = new Date(value).toLocaleString('fr-FR');
                }
                
                exportRow[col.label] = value;
            });
            return exportRow;
        });
    }
    
    /**
     * Get region from data for filename
     */
    getRegionFromData() {
        if (this.data.length === 0) return 'general';
        
        const region = this.data[0].region;
        if (!region) return 'general';
        
        return region.toLowerCase().replace(/\s+/g, '_');
    }
    
    /**
     * Format date string
     */
    formatDate(dateString) {
        if (!dateString) return '-';
        
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    /**
     * Show error message
     */
    showError(message) {
        const alertHtml = `
            <div class="alert alert-error fade-in">
                ${message}
            </div>
        `;
        
        if (this.dom.container) {
            this.dom.container.insertAdjacentHTML('afterbegin', alertHtml);
            
            setTimeout(() => {
                const alertEl = this.dom.container.querySelector('.alert');
                if (alertEl) {
                    alertEl.remove();
                }
            }, 5000);
        }
    }
    
    /**
     * Filter data by region
     */
    filterByRegion(region) {
        if (!region) {
            this.renderTableBody();
            return;
        }
        
        const filtered = this.data.filter(row => row.region === region);
        this.data = filtered;
        this.renderTableBody();
        this.updateStats();
    }
    
    /**
     * Filter data by date range
     */
    filterByDateRange(startDate, endDate) {
        if (!startDate && !endDate) {
            this.loadData();
            return;
        }
        
        const filtered = this.data.filter(row => {
            const rowDate = new Date(row.created_at);
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            
            if (start && rowDate < start) return false;
            if (end && rowDate > end) return false;
            
            return true;
        });
        
        this.data = filtered;
        this.renderTableBody();
        this.updateStats();
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AveneReporting;
}
