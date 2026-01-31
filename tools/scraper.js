#!/usr/bin/env node
/**
 * Simple SC2 2v2 Tournament Scraper
 * Extracts match data from Liquipedia using MediaWiki API
 * Focus: Matches, rounds, scores, and players (races can be added manually in UI)
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');

const API_URL = 'https://liquipedia.net/starcraft2/api.php';
const USER_AGENT = 'sc2stats/1.0 (sc2stats@example.com)';

/**
 * Extract page title from Liquipedia URL
 */
function extractPageTitle(url) {
  const match = url.match(/liquipedia\.net\/starcraft2\/(.+)$/);
  if (!match) {
    throw new Error('Invalid Liquipedia URL');
  }
  return decodeURIComponent(match[1]).replace(/\//g, '/');
}

/**
 * Fetch wikitext from MediaWiki API
 */
async function fetchWikitext(pageTitle) {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    rvslots: 'main',
    titles: pageTitle,
    format: 'json',
    formatversion: '2'
  });

  const response = await fetch(`${API_URL}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const page = data.query?.pages?.[0];

  if (!page || page.missing) {
    throw new Error(`Page not found: ${pageTitle}`);
  }

  return page.revisions?.[0]?.slots?.main?.content || '';
}

/**
 * Parse tournament metadata from Infobox
 */
function parseTournament(wikitext, pageTitle) {
  const infoboxStart = wikitext.indexOf('{{Infobox league');
  if (infoboxStart === -1) return null;

  const infoboxText = extractNestedTemplate(wikitext, infoboxStart);
  if (!infoboxText) return null;

  const infobox = infoboxText.replace(/^\{\{Infobox league\s*/i, '').replace(/\}\}$/, '');

  const getValue = (key) => {
    const regex = new RegExp(`(?:^|\\n)\\|\\|?${key}\\s*=\\s*([^|\\n}]+)`, 'im');
    const match = infobox.match(regex);
    if (!match) return null;
    return match[1].replace(/\{\{[^}]+\}\}/g, '').replace(/<br\s*\/?>/gi, ' ').trim();
  };

  const maps = [];
  for (let i = 1; i <= 20; i++) {
    const map = getValue(`map${i}`);
    if (map) maps.push(map.replace(/<br\s*\/?>/gi, ' ').trim());
    else break;
  }

  return {
    name: getValue('name') || pageTitle,
    liquipedia_slug: pageTitle,
    date: getValue('date') || null,
    prize_pool: getValue('prizepool') ? parseInt(getValue('prizepool')) : null,
    format: getValue('format')?.replace(/<br\s*\/?>/gi, ' ') || null,
    maps: maps.filter(m => m)
  };
}

/**
 * Parse team from 2Opponent template (players only, no races)
 */
function parseTeam(opponentText) {
  const getParam = (key) => {
    const regex = new RegExp(`\\|${key}\\s*=\\s*([^|\\}]+)`, 'i');
    const match = opponentText.match(regex);
    return match ? match[1].trim() : null;
  };

  const p1 = getParam('p1');
  const p2 = getParam('p2');

  if (!p1 || !p2) return null;

  // Normalize: alphabetical order
  const players = [p1, p2].sort();

  return {
    player1: {
      name: players[0]
    },
    player2: {
      name: players[1]
    }
  };
}

/**
 * Extract score from 2Opponent template
 */
function extractScore(opponentText) {
  const scoreMatch = opponentText.match(/\|score\s*=\s*(\d+)/i);
  return scoreMatch ? parseInt(scoreMatch[1]) : null;
}

/**
 * Extract nested template (handles nested braces)
 */
function extractNestedTemplate(text, startPos) {
  let braceCount = 0;
  let start = -1;
  let end = -1;

  for (let i = startPos; i < text.length; i++) {
    const twoChars = text.substring(i, i + 2);
    if (twoChars === '{{') {
      if (start === -1) start = i;
      braceCount++;
    } else if (twoChars === '}}') {
      braceCount--;
      if (braceCount === 0 && start !== -1) {
        end = i + 2;
        break;
      }
    }
  }

  return start !== -1 && end !== -1 ? text.substring(start, end) : null;
}

/**
 * Parse match from Match template
 */
function parseMatch(matchText, round, matchId) {
  // Extract bestof
  const bestofMatch = matchText.match(/\{\{Match\s*\|\s*bestof\s*=\s*(\d+)/i) ||
    matchText.match(/\{\{Match\s*\|\s*bestof\s*=\s*{{abbr\/Bo(\d+)/i);
  const bestOf = bestofMatch ? parseInt(bestofMatch[1]) : 3;

  // Extract opponents
  const opponent1Pos = matchText.indexOf('|opponent1=');
  const opponent2Pos = matchText.indexOf('|opponent2=');

  if (opponent1Pos === -1 || opponent2Pos === -1) return null;

  const opponent1Text = extractNestedTemplate(matchText, opponent1Pos + '|opponent1='.length);
  const opponent2Text = extractNestedTemplate(matchText, opponent2Pos + '|opponent2='.length);

  if (!opponent1Text || !opponent2Text) return null;

  const team1 = parseTeam(opponent1Text);
  const team2 = parseTeam(opponent2Text);

  if (!team1 || !team2) return null;

  const team1Score = extractScore(opponent1Text);
  const team2Score = extractScore(opponent2Text);

  // Extract date
  const dateMatch = matchText.match(/\|date\s*=\s*([^|\n]+)/i);
  const date = dateMatch
    ? dateMatch[1].trim().replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim()
    : null;

  // Extract games/maps
  const games = [];
  for (let i = 1; i <= 10; i++) {
    const mapPattern = new RegExp(`\\|map${i}\\s*=\\s*\\{\\{Map\\|map=([^|]+)\\|winner=(\\d+)\\}\\}`, 'i');
    const mapMatch = matchText.match(mapPattern);
    if (mapMatch) {
      games.push({
        map: mapMatch[1].trim(),
        winner: parseInt(mapMatch[2])
      });
    } else {
      break;
    }
  }

  // Calculate scores from games if not directly available
  let finalTeam1Score = team1Score;
  let finalTeam2Score = team2Score;

  if ((team1Score === null || team2Score === null) && games.length > 0) {
    finalTeam1Score = games.filter(g => g.winner === 1).length;
    finalTeam2Score = games.filter(g => g.winner === 2).length;
  }

  return {
    match_id: matchId,
    round: round,
    team1: team1,
    team2: team2,
    team1_score: finalTeam1Score,
    team2_score: finalTeam2Score,
    best_of: bestOf,
    date: date,
    games: games
  };
}

/**
 * Parse group stage/round robin matches from Matchlist templates
 */
function parseGroupStage(wikitext, tournamentSlug) {
  const matches = [];

  // Find all Matchlist templates
  let matchlistStart = -1;
  let matchlistIndex = 0;

  while ((matchlistStart = wikitext.indexOf('{{Matchlist', matchlistStart + 1)) !== -1) {
    matchlistIndex++;

    // Extract the Matchlist template content
    const matchlistContent = extractNestedTemplate(wikitext, matchlistStart);
    if (!matchlistContent) continue;

    // Try to find group name from context (look backwards for "Group A", "Group B", etc.)
    let groupName = null;
    const beforeMatchlist = wikitext.substring(Math.max(0, matchlistStart - 1000), matchlistStart);

    // Look for various group name patterns
    // Pattern 1: "Group A", "Group B", etc.
    let groupMatch = beforeMatchlist.match(/Group\s+([A-Z])\b/i);
    if (groupMatch) {
      groupName = `Group ${groupMatch[1]}`;
    } else {
      // Pattern 2: "=====Group A=====" or similar headers
      groupMatch = beforeMatchlist.match(/={3,}\s*Group\s+([A-Z])\s*={3,}/i);
      if (groupMatch) {
        groupName = `Group ${groupMatch[1]}`;
      } else {
        // Pattern 3: Look for GroupTableLeague title
        const groupTableMatch = beforeMatchlist.match(/\{\{GroupTableLeague[^}]*\|title\s*=\s*([^|\n}]+)/i);
        if (groupTableMatch) {
          groupName = groupTableMatch[1].trim().replace(/\{\{[^}]+\}\}/g, '').trim();
        } else {
          // Fallback: use Matchlist title if available
          const titleMatch = matchlistContent.match(/\|title\s*=\s*([^|\n}]+)/i);
          if (titleMatch) {
            groupName = titleMatch[1].trim().replace(/\{\{[^}]+\}\}/g, '').trim();
          } else {
            groupName = `Group Stage ${matchlistIndex}`;
          }
        }
      }
    }

    // Extract matches from Matchlist (M1, M2, M3, etc.)
    for (let i = 1; i <= 100; i++) {
      const matchPattern = new RegExp(`\\|M${i}\\s*=\\s*\\{\\{Match`, 'i');
      const matchPos = matchlistContent.search(matchPattern);

      if (matchPos === -1) break;

      // Find the start of the Match template
      const matchStartPos = matchlistContent.indexOf('{{Match', matchPos);
      if (matchStartPos === -1) break;

      const matchText = extractNestedTemplate(matchlistContent, matchStartPos);
      if (matchText) {
        const matchId = `GS_M${i}_${matchlistIndex}`;
        const parsedMatch = parseMatch(matchText, groupName, matchId);
        if (parsedMatch) {
          parsedMatch.tournament_slug = tournamentSlug;
          matches.push(parsedMatch);
        }
      }
    }
  }

  return matches;
}

/**
 * Parse bracket and extract all matches
 */
function parseBracket(wikitext, tournamentSlug) {
  const matches = [];

  // Find bracket section
  const bracketStart = wikitext.indexOf('{{Bracket');
  if (bracketStart === -1) return matches;

  // Extract bracket content
  let bracketContent = '';
  let braceCount = 0;
  let inBracket = false;

  for (let i = bracketStart; i < wikitext.length; i++) {
    const nextTwo = wikitext.substring(i, i + 2);

    if (nextTwo === '{{') {
      braceCount++;
      inBracket = true;
    } else if (nextTwo === '}}' && inBracket) {
      braceCount--;
      if (braceCount === 0) {
        bracketContent = wikitext.substring(bracketStart, i + 2);
        break;
      }
    }
  }

  if (!bracketContent) return matches;

  // Round definitions
  // First, scan for all matches to determine the structure (max round)
  const allMatchRegex = /\|R(\d+)M(\d+)\s*=\s*\{\{Match/g;
  let maxRound = 0;
  let matchMatch;
  const validMatches = [];

  while ((matchMatch = allMatchRegex.exec(bracketContent)) !== null) {
    const roundNum = parseInt(matchMatch[1]);
    const matchNum = matchMatch[2];

    if (roundNum > maxRound) maxRound = roundNum;

    const startPos = matchMatch.index + matchMatch[0].length - '{{Match'.length;
    validMatches.push({
      roundNum,
      matchNum,
      startPos
    });
  }

  // Round naming helper
  const getRoundName = (rNum) => {
    const depth = maxRound - rNum;
    switch (depth) {
      case 0: return 'Grand Final';
      case 1: return 'Semifinals';
      case 2: return 'Quarterfinals';
      default: return `Round of ${Math.pow(2, depth + 1)}`;
    }
  };

  // Process and parse matches
  validMatches.forEach(({ roundNum, matchNum, startPos }) => {
    const matchText = extractNestedTemplate(bracketContent, startPos);
    if (matchText) {
      const roundName = getRoundName(roundNum);
      const matchId = `R${roundNum}M${matchNum}`;

      const parsedMatch = parseMatch(matchText, roundName, matchId);
      if (parsedMatch) {
        parsedMatch.tournament_slug = tournamentSlug;
        matches.push(parsedMatch);
      }
    }
  });

  return matches;
}

/**
 * Parse show matches (SingleMatch) with per-map player definitions
 */
function parseShowMatches(wikitext, tournamentSlug) {
  const matches = [];

  // Find all SingleMatch templates
  const singleMatchRegex = /\{\{SingleMatch/g;
  let match;
  let index = 0;

  while ((match = singleMatchRegex.exec(wikitext)) !== null) {
    index++;
    const startPos = match.index;
    const content = extractNestedTemplate(wikitext, startPos);

    if (!content) continue;

    // Find the inner Match template
    const matchStart = content.indexOf('{{Match');
    if (matchStart === -1) continue;

    const matchText = extractNestedTemplate(content, matchStart);
    if (!matchText) continue;

    // Extract Date
    const dateMatch = matchText.match(/\|date\s*=\s*([^|\n]+)/i);
    const date = dateMatch
      ? dateMatch[1].trim().replace(/\{\{[^}]+\}\}/g, '').replace(/\s+/g, ' ').trim()
      : null;

    // Group maps by player configuration
    const mapGroups = {};
    let order = 0;

    for (let i = 1; i <= 50; i++) {
      const mapPattern = new RegExp(`\\|map${i}\\s*=\\s*\\{\\{Map`, 'i');
      const mapPos = matchText.search(mapPattern);

      if (mapPos === -1) continue;

      const mapSubStart = matchText.indexOf('{{Map', mapPos);
      const mapContent = extractNestedTemplate(matchText, mapSubStart);

      if (!mapContent) continue;

      // Extract players
      const getVal = (k) => {
        const m = mapContent.match(new RegExp(`\\|${k}\\s*=\\s*([^|\\}]+)`, 'i'));
        return m ? m[1].trim() : null;
      };

      const t1p1 = getVal('t1p1');
      const t1p2 = getVal('t1p2');
      const t2p1 = getVal('t2p1');
      const t2p2 = getVal('t2p2');
      const mapName = getVal('map');
      const winner = getVal('winner');
      const subgroup = getVal('subgroup') || '1';

      if (!t1p1 || !t1p2 || !t2p1 || !t2p2) continue;

      // ID for this specific matchup
      const team1Id = [t1p1, t1p2].sort().join('+');
      const team2Id = [t2p1, t2p2].sort().join('+');

      // We group primarily by Subgroup if available, otherwise just by player combo
      // Using subgroup ensures unique sets stay together
      const groupId = `${subgroup}_${team1Id}_vs_${team2Id}`;

      if (!mapGroups[groupId]) {
        order++;
        mapGroups[groupId] = {
          order,
          subgroup,
          team1: { player1: { name: t1p1 }, player2: { name: t1p2 } },
          team2: { player1: { name: t2p1 }, player2: { name: t2p2 } },
          games: []
        };
      }

      if (mapName && winner) {
        mapGroups[groupId].games.push({
          map: mapName,
          winner: parseInt(winner)
        });
      }
    }

    // Convert groups to match objects
    Object.values(mapGroups).forEach(group => {
      const team1Score = group.games.filter(g => g.winner === 1).length;
      const team2Score = group.games.filter(g => g.winner === 2).length;

      matches.push({
        match_id: `SM${index}_SG${group.subgroup}`,
        round: `Show Match (Set ${group.subgroup})`,
        team1: group.team1,
        team2: group.team2,
        team1_score: team1Score,
        team2_score: team2Score,
        best_of: group.games.length + (group.games.length % 2 === 0 ? 1 : 0),
        date: date,
        games: group.games,
        tournament_slug: tournamentSlug
      });
    });
  }

  return matches;
}

/**
 * Main scraper function
 */
async function scrapeTournament(url) {
  console.log(`🔍 Scraping: ${url}`);

  const pageTitle = extractPageTitle(url);
  console.log(`📄 Page title: ${pageTitle}`);

  console.log('⏳ Fetching wikitext...');
  const wikitext = await fetchWikitext(pageTitle);
  console.log(`✓ Fetched ${wikitext.length} characters`);

  const tournament = parseTournament(wikitext, pageTitle);
  if (!tournament) {
    throw new Error('Could not parse tournament metadata');
  }
  console.log(`✓ Tournament: ${tournament.name}`);
  if (tournament.date) console.log(`  Date: ${tournament.date}`);
  if (tournament.prize_pool) console.log(`  Prize Pool: $${tournament.prize_pool}`);

  console.log('⏳ Parsing matches...');

  // Parse both bracket matches and group stage matches
  const bracketMatches = parseBracket(wikitext, pageTitle);
  const groupStageMatches = parseGroupStage(wikitext, pageTitle);

  console.log(`✓ Found ${bracketMatches.length} bracket matches`);
  if (groupStageMatches.length > 0) {
    console.log(`✓ Found ${groupStageMatches.length} group stage matches`);
  }

  const showMatches = parseShowMatches(wikitext, pageTitle);
  if (showMatches.length > 0) {
    console.log(`✓ Found ${showMatches.length} show matches`);
  }

  const matches = [...bracketMatches, ...groupStageMatches, ...showMatches];

  console.log(`✓ Total: ${matches.length} matches`);

  return {
    tournament,
    matches
  };
}

/**
 * Main execution
 */
async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: node scraper.js <liquipedia-url>');
    console.error('Example: node scraper.js https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/1');
    process.exit(1);
  }

  try {
    mkdirSync(outputDir, { recursive: true });

    const data = await scrapeTournament(url);

    const filename = `${data.tournament.liquipedia_slug.replace(/\//g, '_')}.json`;
    const filepath = join(outputDir, filename);

    writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`\n✅ Success!`);
    console.log(`📊 Tournament: ${data.tournament.name}`);
    console.log(`🎮 Matches: ${data.matches.length}`);
    console.log(`💾 Saved to: ${filepath}`);
    console.log(`\n⚠️  Note: Player races are not extracted. Add them manually in the UI.`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
