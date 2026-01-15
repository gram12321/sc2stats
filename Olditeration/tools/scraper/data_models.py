"""
Unified data models for SC2 Stats scraper.
Defines all data structures used throughout the scraping process.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set
from enum import Enum


class MatchStatus(Enum):
    """Match status enumeration."""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TournamentStatus(Enum):
    """Tournament status enumeration."""
    UPCOMING = "upcoming"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class Player:
    """Represents a StarCraft 2 player."""
    name: str
    liquipedia_slug: str
    race: Optional[str] = None
    nationality: Optional[str] = None
    db_id: Optional[str] = None  # Database UUID
    
    def __hash__(self) -> int:
        return hash(self.liquipedia_slug)
    
    def __eq__(self, other) -> bool:
        if not isinstance(other, Player):
            return False
        return self.liquipedia_slug == other.liquipedia_slug
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion."""
        return {
            "name": self.name,
            "liquipedia_slug": self.liquipedia_slug,
            "nationality": self.nationality,
            "preferred_race": self.race
        }


@dataclass 
class Team:
    """Represents a 2v2 team."""
    name: str
    player1: Player
    player2: Player
    db_id: Optional[str] = None  # Database UUID
    
    def __hash__(self) -> int:
        # Sort players for consistent hashing regardless of order
        players = sorted([self.player1.liquipedia_slug, self.player2.liquipedia_slug])
        return hash(tuple(players))
    
    def __eq__(self, other) -> bool:
        if not isinstance(other, Team):
            return False
        # Teams are equal if they have the same players
        self_players = {self.player1.liquipedia_slug, self.player2.liquipedia_slug}
        other_players = {other.player1.liquipedia_slug, other.player2.liquipedia_slug}
        return self_players == other_players
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion."""
        return {
            "name": self.name,
            "player1_id": self.player1.db_id,
            "player2_id": self.player2.db_id
        }


@dataclass
class Game:
    """Represents a single game (map) within a match."""
    game_number: int
    map_name: str
    winner: Optional[Team] = None
    duration_seconds: Optional[int] = None


@dataclass
class Match:
    """Represents a match between two teams."""
    match_id: str  # Unique identifier from Liquipedia
    team1: Team
    team2: Team
    winner: Optional[Team] = None
    best_of: int = 1
    status: MatchStatus = MatchStatus.SCHEDULED
    match_date: Optional[datetime] = None
    games: List[Game] = field(default_factory=list)
    stage: Optional[str] = None  # Bracket stage (e.g., "Finals", "Semifinals")
    team1_score: int = 0  # Direct score from Liquipedia
    team2_score: int = 0  # Direct score from Liquipedia
    
    def add_game(self, game: Game):
        """Add a game to this match."""
        self.games.append(game)
    
    @property
    def score(self) -> str:
        """Get the current score as a string (e.g., "2-1")."""
        # Use direct scores if available (from summary format), otherwise calculate from games
        if self.team1_score > 0 or self.team2_score > 0:
            return f"{self.team1_score}-{self.team2_score}"
        
        if not self.games:
            return "0-0"
        
        team1_wins = sum(1 for game in self.games if game.winner == self.team1)
        team2_wins = sum(1 for game in self.games if game.winner == self.team2)
        
        # Update the score fields based on games if they weren't set
        self.team1_score = team1_wins
        self.team2_score = team2_wins
        
        return f"{team1_wins}-{team2_wins}"


@dataclass
class Tournament:
    """Represents a tournament."""
    name: str
    liquipedia_slug: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    prize_pool: Optional[int] = None
    location: Optional[str] = None
    status: TournamentStatus = TournamentStatus.UPCOMING
    maps: List[str] = field(default_factory=list)
    matches: List[Match] = field(default_factory=list)
    players: Set[Player] = field(default_factory=set)
    teams: Set[Team] = field(default_factory=set)
    db_id: Optional[str] = None  # Database UUID
    
    def add_match(self, match: Match):
        """Add a match to this tournament."""
        self.matches.append(match)
        # Automatically add teams and players
        self.teams.add(match.team1)
        self.teams.add(match.team2)
        self.players.add(match.team1.player1)
        self.players.add(match.team1.player2)
        self.players.add(match.team2.player1)
        self.players.add(match.team2.player2)
    
    @property
    def race_counts(self) -> Dict[str, int]:
        """Get count of players by race."""
        counts = {}
        for player in self.players:
            if player.race:
                counts[player.race] = counts.get(player.race, 0) + 1
        return counts
    
    def to_db_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for database insertion."""
        return {
            "name": self.name,
            "liquipedia_slug": self.liquipedia_slug,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "prize_pool": self.prize_pool,
            "location": self.location,
            "status": self.status.value
        }


@dataclass
class ScrapingTask:
    """Represents a scraping task."""
    tournament_slug: str
    priority: int = 1
    retry_count: int = 0
    max_retries: int = 3
    created_at: datetime = field(default_factory=datetime.now)
    
    def should_retry(self) -> bool:
        """Check if task should be retried."""
        return self.retry_count < self.max_retries
    
    def increment_retry(self):
        """Increment retry count."""
        self.retry_count += 1


@dataclass
class ScrapingResult:
    """Represents the result of a scraping operation."""
    tournament_slug: str
    success: bool
    tournament: Optional[Tournament] = None
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    processing_time: float = 0.0
    cache_hit: bool = False
    
    @property
    def matches_count(self) -> int:
        """Get the number of matches scraped."""
        return len(self.tournament.matches) if self.tournament else 0
    
    @property 
    def players_count(self) -> int:
        """Get the number of unique players scraped."""
        return len(self.tournament.players) if self.tournament else 0
