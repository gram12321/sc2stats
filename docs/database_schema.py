"""
Database schema definitions for SC2 2v2 Stats.
This file contains the SQL DDL statements to create the basic database structure.
"""

# Basic database schema for SC2 2v2 statistics
SC2_STATS_SCHEMA = """
-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquipedia_slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    prize_pool DECIMAL(12,2),
    location VARCHAR(255),
    status VARCHAR(50) DEFAULT 'upcoming',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    liquipedia_slug VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    nationality VARCHAR(100),
    preferred_race VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Teams table (for 2v2 partnerships)
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    player1_id UUID REFERENCES players(id),
    player2_id UUID REFERENCES players(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player1_id, player2_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID REFERENCES tournaments(id),
    match_id VARCHAR(255) UNIQUE NOT NULL, -- Liquipedia match ID
    team1_id UUID REFERENCES teams(id),
    team2_id UUID REFERENCES teams(id),
    winner_id UUID REFERENCES teams(id),
    best_of INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'scheduled',
    match_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games table (individual maps)
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id),
    game_number INTEGER NOT NULL,
    map_name VARCHAR(255) NOT NULL,
    winner_id UUID REFERENCES teams(id),
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(match_id, game_number)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(liquipedia_slug);
CREATE INDEX IF NOT EXISTS idx_players_slug ON players(liquipedia_slug);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_liquipedia_id ON matches(match_id);
CREATE INDEX IF NOT EXISTS idx_games_match ON games(match_id);
CREATE INDEX IF NOT EXISTS idx_teams_players ON teams(player1_id, player2_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
"""

# Sample data insertion queries
SAMPLE_DATA_QUERIES = """
-- Insert sample tournament
INSERT INTO tournaments (liquipedia_slug, name, start_date, end_date, status) 
VALUES ('UThermal_2v2_Circuit/Main_Event', 'UThermal 2v2 Circuit Main Event', '2024-01-01', '2024-01-15', 'completed')
ON CONFLICT (liquipedia_slug) DO NOTHING;

-- Insert sample players
INSERT INTO players (liquipedia_slug, name, preferred_race) VALUES
('UThermal', 'UThermal', 'Terran'),
('Serral', 'Serral', 'Zerg'),
('Maru', 'Maru', 'Terran'),
('Reynor', 'Reynor', 'Zerg')
ON CONFLICT (liquipedia_slug) DO NOTHING;

-- Insert sample teams
INSERT INTO teams (name, player1_id, player2_id) 
SELECT 'UThermal + Serral', p1.id, p2.id
FROM players p1, players p2 
WHERE p1.liquipedia_slug = 'UThermal' AND p2.liquipedia_slug = 'Serral'
ON CONFLICT (player1_id, player2_id) DO NOTHING;
"""

# Schema validation queries
SCHEMA_VALIDATION_QUERIES = """
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tournaments', 'players', 'teams', 'matches', 'games')
ORDER BY table_name;

-- Check table row counts
SELECT 
    'tournaments' as table_name, COUNT(*) as row_count FROM tournaments
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'games', COUNT(*) FROM games;
"""


def get_schema_sql() -> str:
    """Get the complete schema creation SQL."""
    return SC2_STATS_SCHEMA


def get_sample_data_sql() -> str:
    """Get the sample data insertion SQL."""
    return SAMPLE_DATA_QUERIES


def get_validation_sql() -> str:
    """Get the schema validation SQL."""
    return SCHEMA_VALIDATION_QUERIES


if __name__ == "__main__":
    print("SC2 2v2 Stats Database Schema")
    print("=" * 40)
    print("\nSchema creation SQL:")
    print(get_schema_sql())
    print("\nSample data SQL:")
    print(get_sample_data_sql())
    print("\nValidation SQL:")
    print(get_validation_sql())
