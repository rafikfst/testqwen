/**
 * ============================================
 * AVÈNE GAME PLATFORM - EXPRESS SERVER
 * Backend API with Supabase Integration
 * ============================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const bcrypt = require('bcryptjs');
const ws = require('ws');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pyqjgffygesrlfyfagms.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'sb_publishable_vltwOvN6j1ThYSos43EV9A_z7la0IFh';

// Initialize Supabase client (no realtime needed for this app)
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Verify token with Supabase Auth
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({ error: 'Token invalide' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Erreur d\'authentification' });
    }
};

const adminMiddleware = async (req, res, next) => {
    try {
        // Check if user has admin role in auth_users table
        const { data: userData } = await supabase
            .from('auth_users')
            .select('role')
            .eq('email', req.user.email)
            .single();
        
        if (!userData || userData.role !== 'admin') {
            return res.status(403).json({ error: 'Accès admin requis' });
        }
        
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        res.status(500).json({ error: 'Erreur de vérification des permissions' });
    }
};

// ============================================
// AUTH ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role = 'trainer' } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        
        // Insert into auth_users table
        const { data, error } = await supabase
            .from('auth_users')
            .insert([{
                email,
                password_hash: passwordHash,
                role: ['admin', 'trainer', 'agent'].includes(role) ? role : 'trainer'
            }])
            .select()
            .single();
        
        if (error) {
            if (error.code === '23505') { // Unique violation
                return res.status(409).json({ error: 'Cet email est déjà utilisé' });
            }
            throw error;
        }
        
        res.status(201).json({ 
            message: 'Utilisateur créé avec succès',
            user: { id: data.id, email: data.email, role: data.role }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Échec de l\'inscription' });
    }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }
        
        // Find user in auth_users table
        const { data: user, error } = await supabase
            .from('auth_users')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error || !user) {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }
        
        // Update last login
        await supabase
            .from('auth_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);
        
        // Generate JWT token using Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (authError) {
            // Fallback: create a simple token
            const token = Buffer.from(JSON.stringify({ 
                id: user.id, 
                email: user.email, 
                role: user.role 
            })).toString('base64');
            
            return res.json({
                message: 'Connexion réussie',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role
                }
            });
        }
        
        res.json({
            message: 'Connexion réussie',
            token: authData.session.access_token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Échec de la connexion' });
    }
});

// Get current user profile
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const { data: user } = await supabase
            .from('auth_users')
            .select('id, email, role, created_at, last_login')
            .eq('email', req.user.email)
            .single();
        
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        res.json({ user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
    }
});

// ============================================
// QUESTIONS API
// ============================================

// Get random question by difficulty
app.get('/api/questions', async (req, res) => {
    try {
        const { difficulte, exclude } = req.query;
        
        if (!difficulte) {
            return res.status(400).json({ error: 'Paramètre difficulte requis' });
        }
        
        let query = supabase
            .from('questions')
            .select('*')
            .eq('difficulte', difficulte)
            .eq('is_active', true);
        
        // Exclude already used questions
        if (exclude) {
            const excludeIds = exclude.split(',').map(id => parseInt(id)).filter(id => !isNaN(id));
            if (excludeIds.length > 0) {
                query = query.not('id', 'in', `(${excludeIds.join(',')})`);
            }
        }
        
        // Get random question
        const { data, error } = await query.limit(1);
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            return res.status(404).json({ error: 'Aucune question disponible' });
        }
        
        res.json(data[0]);
    } catch (error) {
        console.error('Questions API error:', error);
        res.status(500).json({ error: 'Échec de la récupération de la question' });
    }
});

// Create new question (admin only)
app.post('/api/questions', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { difficulte, enonce, blocs_corrects, blocs_pieges } = req.body;
        
        if (!difficulte || !enonce || !blocs_corrects || !blocs_pieges) {
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }
        
        const { data, error } = await supabase
            .from('questions')
            .insert([{
                difficulte,
                enonce,
                blocs_corrects,
                blocs_pieges
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Create question error:', error);
        res.status(500).json({ error: 'Échec de la création de la question' });
    }
});

// Update question (admin only)
app.patch('/api/questions/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const { data, error } = await supabase
            .from('questions')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Update question error:', error);
        res.status(500).json({ error: 'Échec de la mise à jour de la question' });
    }
});

// Delete question (admin only)
app.delete('/api/questions/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { error } = await supabase
            .from('questions')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ message: 'Question supprimée avec succès' });
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ error: 'Échec de la suppression de la question' });
    }
});

// ============================================
// GAME SUBMISSION API
// ============================================

app.post('/api/game/submit', async (req, res) => {
    try {
        const {
            tournee_id,
            pharmacy_id,
            agent_id,
            nom_pharmacie,
            nom_agent,
            q1, r1,
            q2, r2,
            q3, r3,
            q4, r4,
            niveau_atteint,
            resultat,
            cadeau_assigne,
            cadeau_description
        } = req.body;
        
        // Get pharmacy name if not provided
        let finalNomPharmacie = nom_pharmacie;
        if (!finalNomPharmacie && pharmacy_id) {
            const { data: pharmacy } = await supabase
                .from('pharmacies')
                .select('nom')
                .eq('id', pharmacy_id)
                .single();
            
            if (pharmacy) {
                finalNomPharmacie = pharmacy.nom;
            }
        }
        
        // Get agent name if not provided
        let finalNomAgent = nom_agent;
        if (!finalNomAgent && agent_id) {
            const { data: agent } = await supabase
                .from('agents')
                .select('nom')
                .eq('id', agent_id)
                .single();
            
            if (agent) {
                finalNomAgent = agent.nom;
            }
        }
        
        // Insert bilan record
        const { data, error } = await supabase
            .from('bilans')
            .insert([{
                tournee_id,
                pharmacy_id,
                agent_id,
                nom_pharmacie: finalNomPharmacie || 'Inconnu',
                nom_agent: finalNomAgent || 'Inconnu',
                q1, r1,
                q2, r2,
                q3, r3,
                q4, r4,
                niveau_atteint,
                resultat,
                cadeau_assigne: cadeau_assigne || false,
                cadeau_description: cadeau_description || 'Aucun'
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({ 
            message: 'Résultat enregistré avec succès',
            bilan: data
        });
    } catch (error) {
        console.error('Game submit error:', error);
        res.status(500).json({ error: 'Échec de l\'enregistrement du résultat' });
    }
});

// ============================================
// AGENT API
// ============================================

// Update agent status
app.patch('/api/agents/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { statut_jeu } = req.body;
        
        if (!statut_jeu) {
            return res.status(400).json({ error: 'statut_jeu requis' });
        }
        
        const { data, error } = await supabase
            .from('agents')
            .update({ statut_jeu })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Update agent status error:', error);
        res.status(500).json({ error: 'Échec de la mise à jour du statut' });
    }
});

// Get all agents
app.get('/api/agents', async (req, res) => {
    try {
        const { pharmacy_id, tournee_id } = req.query;
        
        let query = supabase.from('agents').select(`
            *,
            pharmacies (
                nom,
                type,
                tournees (
                    region
                )
            )
        `);
        
        if (pharmacy_id) {
            query = query.eq('pharmacy_id', pharmacy_id);
        }
        
        if (tournee_id) {
            query = query.in('pharmacy_id', 
                supabase.from('pharmacies').select('id').eq('tournee_id', tournee_id)
            );
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Get agents error:', error);
        res.status(500).json({ error: 'Échec de la récupération des agents' });
    }
});

// Create new agent
app.post('/api/agents', authMiddleware, async (req, res) => {
    try {
        const { pharmacy_id, nom, email, telephone } = req.body;
        
        if (!pharmacy_id || !nom) {
            return res.status(400).json({ error: 'pharmacy_id et nom requis' });
        }
        
        const { data, error } = await supabase
            .from('agents')
            .insert([{
                pharmacy_id,
                nom,
                email,
                telephone
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Create agent error:', error);
        res.status(500).json({ error: 'Échec de la création de l\'agent' });
    }
});

// ============================================
// TOURNÉES API
// ============================================

// Get tournee stock
app.get('/api/tournees/:id/stock', async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('tournees')
            .select('stock_actuel, stock_initial')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        console.error('Get stock error:', error);
        res.status(500).json({ error: 'Échec de la récupération du stock' });
    }
});

// Decrement stock
app.post('/api/tournees/:id/stock/decrement', async (req, res) => {
    try {
        const { id } = req.params;
        const { cadeau_type } = req.body;
        
        if (!cadeau_type) {
            return res.status(400).json({ error: 'cadeau_type requis' });
        }
        
        // Get current stock
        const { data: tournee, error: fetchError } = await supabase
            .from('tournees')
            .select('stock_actuel')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;
        
        const currentStock = tournee.stock_actuel || {};
        const currentValue = currentStock[cadeau_type] || 0;
        
        if (currentValue <= 0) {
            return res.json({ 
                success: false, 
                message: 'Stock épuisé',
                stock: currentStock
            });
        }
        
        // Update stock
        const newStock = {
            ...currentStock,
            [cadeau_type]: currentValue - 1
        };
        
        const { data, error } = await supabase
            .from('tournees')
            .update({ stock_actuel: newStock })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            stock: data.stock_actuel,
            message: 'Stock décrémenté avec succès'
        });
    } catch (error) {
        console.error('Decrement stock error:', error);
        res.status(500).json({ error: 'Échec de la décrémentation du stock' });
    }
});

// Create new tournee
app.post('/api/tournees', authMiddleware, async (req, res) => {
    try {
        const { region, date_debut, date_fin, stock_initial } = req.body;
        
        if (!region || !date_debut || !date_fin || !stock_initial) {
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }
        
        const { data, error } = await supabase
            .from('tournees')
            .insert([{
                region,
                date_debut,
                date_fin,
                stock_initial,
                stock_actuel: stock_initial
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Create tournee error:', error);
        res.status(500).json({ error: 'Échec de la création de la tournée' });
    }
});

// Get all tournees
app.get('/api/tournees', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('tournees')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Get tournees error:', error);
        res.status(500).json({ error: 'Échec de la récupération des tournées' });
    }
});

// ============================================
// PHARMACIES API
// ============================================

// Create new pharmacy
app.post('/api/pharmacies', authMiddleware, async (req, res) => {
    try {
        const { tournee_id, nom, type, telephone, latitude, longitude } = req.body;
        
        if (!tournee_id || !nom || !type) {
            return res.status(400).json({ error: 'tournee_id, nom et type requis' });
        }
        
        const { data, error } = await supabase
            .from('pharmacies')
            .insert([{
                tournee_id,
                nom,
                type,
                telephone,
                latitude,
                longitude
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Create pharmacy error:', error);
        res.status(500).json({ error: 'Échec de la création de la pharmacie' });
    }
});

// Get pharmacies by tournee
app.get('/api/pharmacies', async (req, res) => {
    try {
        const { tournee_id } = req.query;
        
        let query = supabase.from('pharmacies').select('*');
        
        if (tournee_id) {
            query = query.eq('tournee_id', tournee_id);
        }
        
        const { data, error } = await query.order('nom');
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Get pharmacies error:', error);
        res.status(500).json({ error: 'Échec de la récupération des pharmacies' });
    }
});

// ============================================
// REPORTING API
// ============================================

app.get('/api/reporting', async (req, res) => {
    try {
        const { tournee_id, pharmacy_id, date_from, date_to } = req.query;
        
        let query = supabase
            .from('v_bilan_complet')
            .select('*');
        
        if (tournee_id) {
            query = query.eq('tournee_id', tournee_id);
        }
        
        if (pharmacy_id) {
            query = query.eq('pharmacy_id', pharmacy_id);
        }
        
        if (date_from) {
            query = query.gte('created_at', date_from);
        }
        
        if (date_to) {
            query = query.lte('created_at', date_to);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Reporting API error:', error);
        res.status(500).json({ error: 'Échec de la récupération du reporting' });
    }
});

// ============================================
// CRUD GENERIC ENDPOINTS FOR ADMIN DASHBOARD
// ============================================

// Generic GET endpoint for any table
app.get('/api/admin/:table', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { table } = req.params;
        const validTables = ['auth_users', 'tournees', 'pharmacies', 'agents', 'questions', 'bilans'];
        
        if (!validTables.includes(table)) {
            return res.status(400).json({ error: 'Table non valide' });
        }
        
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        console.error('Admin GET error:', error);
        res.status(500).json({ error: 'Échec de la récupération des données' });
    }
});

// Generic DELETE endpoint for any table
app.delete('/api/admin/:table/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { table, id } = req.params;
        const validTables = ['auth_users', 'tournees', 'pharmacies', 'agents', 'questions', 'bilans'];
        
        if (!validTables.includes(table)) {
            return res.status(400).json({ error: 'Table non valide' });
        }
        
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        res.json({ message: 'Élément supprimé avec succès' });
    } catch (error) {
        console.error('Admin DELETE error:', error);
        res.status(500).json({ error: 'Échec de la suppression' });
    }
});

// ============================================
// SERVE FRONTEND
// ============================================

// Serve index.html for all other routes (SPA support) - Express 5 compatible
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Erreur serveur interne',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🌊 AVÈNE GAME PLATFORM SERVER                        ║
║                                                        ║
║   Server running on port ${PORT}                          ║
║   Environment: ${process.env.NODE_ENV || 'development'}                            ║
║   Supabase URL: ${SUPABASE_URL.substring(0, 30)}...              ║
║                                                        ║
║   Ready to serve luxury medical gaming experience!     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
