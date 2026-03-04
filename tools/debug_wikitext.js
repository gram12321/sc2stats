import { fileURLToPath } from 'url';
import { dirname } from 'path';

const API_URL = 'https://liquipedia.net/starcraft2/api.php';
const USER_AGENT = 'sc2stats/1.0 (sc2stats@example.com)';

async function fetchWikitext(pageTitle) {
  const params = new URLSearchParams({
    action: 'query', prop: 'revisions', rvprop: 'content',
    rvslots: 'main', titles: pageTitle, format: 'json', formatversion: '2'
  });
  const response = await fetch(`${API_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } });
  const data = await response.json();
  return data.query.pages[0].revisions[0].slots.main.content;
}

const title = process.argv[2];
const wt = await fetchWikitext(title);
// Print lines with Bracket template names
const lines = wt.split('\n');
lines.forEach((l, i) => {
  if (l.includes('{{Bracket') || l.includes('|R') && l.length < 30) {
    console.log(i, JSON.stringify(l.substring(0, 200)));
  }
});
