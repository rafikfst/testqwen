-- ============================================
-- AVÈNE GAME PLATFORM - SUPABASE SQL SCHEMA
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. AUTH USERS TABLE (Extended Auth)
-- ============================================
CREATE TABLE IF NOT EXISTS auth_users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'trainer' CHECK (role IN ('admin', 'trainer', 'agent')),
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

-- ============================================
-- 2. Table Tournées (Stock Management)
-- ============================================
CREATE TABLE IF NOT EXISTS tournees (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    stock_initial JSONB NOT NULL, -- {"type1": 50, "type2": 30, "type3": 10, "superlot": 2}
    stock_actuel JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 3. Table Pharmacies
-- ============================================
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    tournee_id INT REFERENCES tournees(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('pharmacie', 'para', 'fournisseur')),
    telephone VARCHAR(50),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    est_visitee BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. Table Agents
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(50),
    statut_jeu VARCHAR(50) DEFAULT 'Non Joué', -- 'Perdu', 'Gagné Type 1', etc.
    user_id INT REFERENCES auth_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. Table Questions
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    difficulte VARCHAR(10) CHECK (difficulte IN ('75%', '50%', '25%', '1%')),
    enonce TEXT NOT NULL,
    blocs_corrects TEXT[] NOT NULL, -- Array of strings in the exact order
    blocs_pieges TEXT[] NOT NULL,    -- Array of distractor strings
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 6. Table Bilan (Reporting)
-- ============================================
CREATE TABLE IF NOT EXISTS bilans (
    id SERIAL PRIMARY KEY,
    tournee_id INT REFERENCES tournees(id) ON DELETE SET NULL,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE SET NULL,
    agent_id INT REFERENCES agents(id) ON DELETE SET NULL,
    nom_pharmacie VARCHAR(255),
    nom_agent VARCHAR(255),
    q1 TEXT, r1 TEXT,
    q2 TEXT, r2 TEXT,
    q3 TEXT, r3 TEXT,
    q4 TEXT, r4 TEXT,
    niveau_atteint VARCHAR(10),
    resultat VARCHAR(50),
    cadeau_assigne BOOLEAN DEFAULT FALSE,
    cadeau_description TEXT DEFAULT 'Aucun',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 7. Table Game Sessions (Track active games)
-- ============================================
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    agent_id INT REFERENCES agents(id) ON DELETE CASCADE,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE CASCADE,
    current_niveau VARCHAR(10),
    questions_used INT[] DEFAULT '{}',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_tournees_region ON tournees(region);
CREATE INDEX IF NOT EXISTS idx_pharmacies_tournee ON pharmacies(tournee_id);
CREATE INDEX IF NOT EXISTS idx_agents_pharmacy ON agents(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulte ON questions(difficulte);
CREATE INDEX IF NOT EXISTS idx_bilans_created ON bilans(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);

-- ============================================
-- SAMPLE DATA INSERTION
-- ============================================

-- Insert a sample tournee
INSERT INTO tournees (region, date_debut, date_fin, stock_initial, stock_actuel)
VALUES 
('Île-de-France', '2025-01-01', '2025-12-31', 
 '{"type1": 50, "type2": 30, "type3": 10, "superlot": 2}'::jsonb,
 '{"type1": 50, "type2": 30, "type3": 10, "superlot": 2}'::jsonb);

-- Insert sample pharmacies
INSERT INTO pharmacies (tournee_id, nom, type, telephone, latitude, longitude)
VALUES 
(1, 'Pharmacie Centrale', 'pharmacie', '0123456789', 48.8566, 2.3522),
(1, 'Para Beauty Shop', 'para', '0198765432', 48.8606, 2.3376),
(1, 'Laboratoire Dermance', 'fournisseur', '0156789012', 48.8530, 2.3499);

-- Insert sample agents
INSERT INTO agents (pharmacy_id, nom, email, telephone, statut_jeu)
VALUES 
(1, 'Marie Dupont', 'marie@pharmacie-centrale.fr', '0612345678', 'Non Joué'),
(2, 'Sophie Martin', 'sophie@parabeauty.fr', '0698765432', 'Non Joué'),
(3, 'Pierre Leroy', 'pierre@dermance.fr', '0656789012', 'Non Joué');

-- Insert sample questions for each difficulty level
INSERT INTO questions (difficulte, enonce, blocs_corrects, blocs_pieges)
VALUES 
('75%', 'L''Eau Thermale Avène est puisée depuis :', 
 ARRAY['une', 'source', 'unique', 'en', 'France'],
 ARRAY['plusieurs', 'sources', 'Europe', 'monde', 'rivière']),

('75%', 'Le centre de recherche Avène se trouve à :', 
 ARRAY['Paris', 'laboratoire', 'Pierre', 'Fabre'],
 ARRAY['Lyon', 'Marseille', 'Nice', 'université', 'hôpital']),

('50%', 'La tolérance cutanée est testée sur :', 
 ARRAY['peaux', 'sensibles', 'réelles', 'conditions'],
 ARRAY['normales', 'sèches', 'artificielles', 'laboratoire', 'souris']),

('50%', 'Les produits Avène sont formulés avec :', 
 ARRAY['minimum', 'ingrédients', 'maximum', 'tolérance'],
 ARRAY['parfums', 'colorants', 'alcool', 'conservateurs', 'additifs']),

('25%', 'Le Brevage Thermal Avène contient :', 
 ARRAY['silicium', 'oligo-éléments', 'propriétés', 'apaisantes'],
 ARRAY['calcium', 'magnésium', 'sodium', 'potassium', 'fer']),

('25%', 'La stérilité cosmétique garantit :', 
 ARRAY['zéro', 'conservateur', 'formule', 'inerte'],
 ARRAY['parfum', 'colorant', 'alcool', 'actif', 'stable']),

('1%', 'Le nombre de bactéries dans l''eau Avène est :', 
 ARRAY['inférieur', 'à', '1', 'par', 'millilitre'],
 ARRAY['supérieur', 'égal', 'cent', 'mille', 'million']);

-- Insert sample admin user (password: admin123 - hashed in production!)
INSERT INTO auth_users (email, password_hash, role)
VALUES 
('admin@avene.com', '$2b$10$rQZ8vXJxK9L2mN3oP4qR5uWxYzAbCdEfGhIjKlMnOpQrStUvWxYz', 'admin'),
('trainer@avene.com', '$2b$10$sRa9wYKyL0M3nO4pQ5rS6vXyZaBcDeFgHiJkLmNoPqRsTuVwXyZ', 'trainer');

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tournees table
CREATE TRIGGER update_tournees_updated_at
    BEFORE UPDATE ON tournees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to decrement stock
CREATE OR REPLACE FUNCTION decrement_stock(p_tournee_id INT, p_cadeau_type VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    current_stock JSONB;
    new_stock JSONB;
    stock_value INT;
BEGIN
    SELECT stock_actuel INTO current_stock FROM tournees WHERE id = p_tournee_id;
    
    IF current_stock IS NULL THEN
        RETURN FALSE;
    END IF;
    
    stock_value := COALESCE((current_stock ->> p_cadeau_type)::INT, 0);
    
    IF stock_value <= 0 THEN
        RETURN FALSE;
    END IF;
    
    new_stock := jsonb_set(current_stock, ARRAY[p_cadeau_type], to_jsonb(stock_value - 1));
    
    UPDATE tournees SET stock_actuel = new_stock WHERE id = p_tournee_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

CREATE OR REPLACE VIEW v_bilan_complet AS
SELECT 
    b.id,
    b.nom_pharmacie,
    b.nom_agent,
    b.q1, b.r1,
    b.q2, b.r2,
    b.q3, b.r3,
    b.q4, b.r4,
    b.niveau_atteint,
    b.resultat,
    b.cadeau_assigne,
    b.cadeau_description,
    b.created_at,
    t.region,
    p.type as pharmacy_type
FROM bilans b
LEFT JOIN tournees t ON b.tournee_id = t.id
LEFT JOIN pharmacies p ON b.pharmacy_id = p.id
ORDER BY b.created_at DESC;

-- ============================================
-- GRANT PERMISSIONS (for Supabase RLS if needed)
-- ============================================
-- Note: In Supabase, you would enable RLS and create policies here
-- ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE tournees ENABLE ROW LEVEL SECURITY;
-- etc.
