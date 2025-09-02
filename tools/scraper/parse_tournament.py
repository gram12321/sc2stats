from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class Player:
    name: str
    race: Optional[str] = None


@dataclass
class Match:
    team1: List[Player]
    team2: List[Player]
    score: str
    date: Optional[str] = None
    best_of: Optional[str] = None
    stage: Optional[str] = None


@dataclass
class TournamentData:
    name: str
    start_date: str
    end_date: str
    prize_pool: int
    maps: List[str]
    matches: List[Match]
    players: List[Player]
    race_counts: Dict[str, int]


def parse_infobox(content: str) -> Dict[str, Any]:
    """Parse the tournament infobox for metadata."""
    # Look for the infobox pattern more flexibly
    infobox_pattern = r'\{\{Infobox league\n([^}]+(?:\n[^}]+)*)\n\}\}'
    match = re.search(infobox_pattern, content, re.MULTILINE | re.DOTALL)
    
    if not match:
        return {}
    
    infobox_content = match.group(1)
    params = {}
    
    for line in infobox_content.split('\n'):
        if '|' in line and '=' in line:
            key, value = line.split('=', 1)
            # Remove leading | character
            clean_key = key.strip().lstrip('|')
            params[clean_key] = value.strip()
    
    return params


def parse_maps(content: str) -> List[str]:
    """Extract map pool from the content."""
    maps = []
    
    # Look for map entries in the infobox
    map_pattern = r'\|map\d+=([^|\n]+)'
    map_matches = re.findall(map_pattern, content)
    
    for map_name in map_matches:
        # Clean up the map name
        clean_map = map_name.strip()
        if clean_map and not clean_map.startswith('{{') and clean_map not in maps:
            maps.append(clean_map)
    
    return maps


def parse_prize_pool_section(content: str) -> List[Match]:
    """Parse the prize pool section to extract match results."""
    matches = []
    
    # Look for 2Opponent templates in the prize pool section
    # The actual pattern is more complex due to nested templates
    # Pattern: {{2Opponent|p1=Player1|p2=Player2|lastvs={{2Opponent|...}}|lastvsscore=Score|date=Date}}
    
    # First, find the prize pool section
    prize_pool_pattern = r'==Prize Pool==\n(.*?)(?===|\n==)'
    prize_match = re.search(prize_pool_pattern, content, re.DOTALL)
    
    if not prize_match:
        return matches
    
    prize_content = prize_match.group(1)
    
    # Instead of trying to use complex regex, let's manually parse the structure
    # Look for the start of each 2Opponent template
    template_starts = []
    pos = 0
    while True:
        pos = prize_content.find('{{2Opponent|', pos)
        if pos == -1:
            break
        template_starts.append(pos)
        pos += 1
    
    print(f"Found {len(template_starts)} 2Opponent template starts in prize pool")
    
    for start_pos in template_starts:
        # Find the matching closing brace by counting braces
        brace_count = 0
        pos = start_pos
        template_end = -1
        
        while pos < len(prize_content):
            if prize_content[pos] == '{':
                brace_count += 1
            elif prize_content[pos] == '}':
                brace_count -= 1
                if brace_count == 0:
                    template_end = pos + 1
                    break
            pos += 1
        
        if template_end == -1:
            continue
            
        # Extract the complete template
        template_text = prize_content[start_pos:template_end]
        
        # Parse the template parameters
        params = {}
        # Remove the outer {{2Opponent| and }}
        inner_content = template_text[13:-2]  # Remove "{{2Opponent|" and "}}"
        
        # Split by | but be careful about nested templates
        param_parts = []
        current_part = ""
        brace_level = 0
        
        for char in inner_content:
            if char == '{':
                brace_level += 1
            elif char == '}':
                brace_level -= 1
            
            if char == '|' and brace_level == 0:
                param_parts.append(current_part)
                current_part = ""
            else:
                current_part += char
        
        # Add the last part
        if current_part:
            param_parts.append(current_part)
        
        # Parse each parameter
        for part in param_parts:
            if '=' in part:
                key, value = part.split('=', 1)
                params[key.strip()] = value.strip()
        
        # Extract team information
        team1_players = []
        team2_players = []
        
        if 'p1' in params:
            team1_players.append(Player(name=params['p1']))
        if 'p2' in params:
            team1_players.append(Player(name=params['p2']))
        
        # Look for nested 2Opponent (the opponents)
        # The nested template should be in the lastvs parameter
        nested_match = re.search(r'lastvs=\{\{2Opponent\|([^}]+)\}\}', template_text)
        if nested_match:
            nested_params = {}
            for param in nested_match.group(1).split('|'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    nested_params[key.strip()] = value.strip()
            
            if 'p1' in nested_params:
                team2_players.append(Player(name=nested_params['p1']))
            if 'p2' in nested_params:
                team2_players.append(Player(name=nested_params['p2']))
        
        # Extract score and date
        score = params.get('lastvsscore', '')
        date = params.get('date', '')
        
        # Debug output
        print(f"  Template: {template_text[:100]}...")
        print(f"  Team1: {[p.name for p in team1_players]}")
        print(f"  Team2: {[p.name for p in team2_players]}")
        print(f"  Score: {score}, Date: {date}")
        
        if team1_players and team2_players:
            match = Match(
                team1=team1_players,
                team2=team2_players,
                score=score,
                date=date
            )
            matches.append(match)
            print(f"  -> Added match: {len(matches)}")
        else:
            print(f"  -> Skipped (incomplete teams)")
    
    return matches


def extract_race_counts(content: str) -> Dict[str, int]:
    """Extract race counts from the infobox."""
    race_counts = {}
    
    # Look for race number entries
    race_pattern = r'\|(\w+)_number=(\d+)'
    race_matches = re.findall(race_pattern, content)
    
    for race, count in race_matches:
        try:
            race_counts[race] = int(count)
        except ValueError:
            pass
    
    return race_counts


def parse_tournament_content(content: str) -> TournamentData:
    """Parse the complete tournament content."""
    # Parse infobox for metadata
    infobox = parse_infobox(content)
    
    # Extract basic tournament info
    name = infobox.get('name', 'Unknown Tournament')
    start_date = infobox.get('sdate', '')
    end_date = infobox.get('edate', '')
    prize_pool = int(infobox.get('prizepool', '0'))
    
    # Extract maps
    maps = parse_maps(content)
    
    # Extract matches from prize pool
    matches = parse_prize_pool_section(content)
    
    # Extract race counts
    race_counts = extract_race_counts(content)
    
    # Collect all unique players
    all_players = set()
    for match in matches:
        for player in match.team1 + match.team2:
            all_players.add(player.name)
    
    players = [Player(name=name) for name in sorted(all_players)]
    
    return TournamentData(
        name=name,
        start_date=start_date,
        end_date=end_date,
        prize_pool=prize_pool,
        maps=maps,
        matches=matches,
        players=players,
        race_counts=race_counts
    )


def write_parsed_data(tournament_data: TournamentData, output_dir: str = "output/processed/") -> None:
    """Write parsed tournament data to structured files."""
    from pathlib import Path
    import json
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # Convert to dict for JSON serialization
    data_dict = {
        "name": tournament_data.name,
        "start_date": tournament_data.start_date,
        "end_date": tournament_data.end_date,
        "prize_pool": tournament_data.prize_pool,
        "maps": tournament_data.maps,
        "matches": [
            {
                "team1": [{"name": p.name, "race": p.race} for p in match.team1],
                "team2": [{"name": p.name, "race": p.race} for p in match.team2],
                "score": match.score,
                "date": match.date,
                "best_of": match.best_of,
                "stage": match.stage
            }
            for match in tournament_data.matches
        ],
        "players": [{"name": p.name, "race": p.race} for p in tournament_data.players],
        "race_counts": tournament_data.race_counts
    }
    
    # Write structured data
    with (output_path / "tournament_parsed.json").open("w", encoding="utf-8") as f:
        json.dump(data_dict, f, ensure_ascii=False, indent=2)
    
    # Write CSV-friendly data
    with (output_path / "matches.csv").open("w", encoding="utf-8") as f:
        f.write("team1_player1,team1_player2,team2_player1,team2_player2,score,date\n")
        for match in tournament_data.matches:
            team1_p1 = match.team1[0].name if len(match.team1) > 0 else ""
            team1_p2 = match.team1[1].name if len(match.team1) > 1 else ""
            team2_p1 = match.team2[0].name if len(match.team2) > 0 else ""
            team2_p2 = match.team2[1].name if len(match.team2) > 1 else ""
            
            f.write(f"{team1_p1},{team1_p2},{team2_p1},{team2_p2},{match.score},{match.date}\n")
    
    print(f"Parsed data written to {output_path}")

