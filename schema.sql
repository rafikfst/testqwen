-- ============================================
-- AVÈNE GAME PLATFORM - SUPABASE DATABASE SCHEMA
-- ============================================

-- 1. Table Users (Authentication & Management)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) CHECK (role IN ('admin', 'trainer', 'agent')) DEFAULT 'agent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table Tournées (Stock Management)
CREATE TABLE IF NOT EXISTS tournees (
    id SERIAL PRIMARY KEY,
    region VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    stock_initial JSONB NOT NULL,
    stock_actuel JSONB NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table Pharmacies
CREATE TABLE IF NOT EXISTS pharmacies (
    id SERIAL PRIMARY KEY,
    tournee_id INT REFERENCES tournees(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('pharmacie', 'para', 'fournisseur')),
    telephone VARCHAR(50),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    est_visitee BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Table Agents
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    pharmacy_id INT REFERENCES pharmacies(id) ON DELETE CASCADE,
    nom VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    telephone VARCHAR(50),
    statut_jeu VARCHAR(50) DEFAULT 'Non Joué',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Table Questions
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    difficulte VARCHAR(10) CHECK (difficulte IN ('75%', '50%', '25%', '1%')),
    enonce TEXT NOT NULL,
    blocs_corrects TEXT[] NOT NULL,
    blocs_pieges TEXT[] NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Table Bilan (Reporting)
CREATE TABLE IF NOT EXISTS bilans (
    id SERIAL PRIMARY KEY,
    nom_pharmacie VARCHAR(255),
    nom_agent VARCHAR(255),
    q1 TEXT,
    r1 TEXT,
    q2 TEXT,
    r2 TEXT,
    q3 TEXT,
    r3 TEXT,
    q4 TEXT,
    r4 TEXT,
    cadeau_assigne BOOLEAN DEFAULT FALSE,
    cadeau_description TEXT DEFAULT 'Aucun',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tournees_region ON tournees(region);
CREATE INDEX IF NOT EXISTS idx_pharmacies_tournee ON pharmacies(tournee_id);
CREATE INDEX IF NOT EXISTS idx_agents_pharmacy ON agents(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulte);
CREATE INDEX IF NOT EXISTS idx_bilans_created_at ON bilans(created_at DESC);

-- Insert sample data for testing (optional)
-- Uncomment to add sample questions

INSERT INTO questions (difficulte, enonce, blocs_corrects, blocs_pieges) VALUES
('75%', 'Complétez la phrase : L''Eau Thermale Avène est reconnue pour ses propriétés...', ARRAY['apaisantes', 'anti-irritantes', 'adoucissantes'], ARRAY['exfoliantes', 'colorantes', 'parfumées']),
('50%', 'Classez ces produits Avène par ordre de lancement : Cleanance, Tolérance Control, Ystheal', ARRAY['Tolérance', 'Control', 'Cleanance', 'Ystheal'], ARRAY['Ystheal', 'Cleanance', 'Tolérance', 'Control']),
('25%', 'Laquelle de ces affirmations sur Avène est correcte ?', ARRAY['Source', 'unique', 'en', 'France'], ARRAY['Multiple', 'sources', 'internationales', 'Europe']),
('1%', 'Quel est le pourcentage d''Eau Thermale dans les produits Avène ?', ARRAY['100', 'pourcent', 'purete', 'maximale'], ARRAY['50', 'pourcent', 'dilution', 'standard']);

-- Sample tournée (optional)
-- INSERT INTO tournees (region, date_debut, date_fin, stock_initial, stock_actuel) VALUES
-- ('Île-de-France', '2024-01-01', '2024-12-31', '{"Type 1": 50, "Type 2": 30, "Type 3": 10, "SUPER LOT": 2}'::jsonb, '{"Type 1": 50, "Type 2": 30, "Type 3": 10, "SUPER LOT": 2}'::jsonb);
