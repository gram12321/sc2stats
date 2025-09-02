User:  
Is it easy to scrape the results of an esport like SC2 from Liquipedia? For example, from this page: https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event

---

ChatGPT:  
Yes, it's actually pretty straightforward if you use Liquipedia's API (specifically, their LPDB tables). Scraping the HTML is possible, but much more fragile and annoying. Here's how you can do it the right way:

**1. Use the Liquipedia API (LPDB tables)**

Liquipedia stores match and bracket data in special tables (like `match2`, `match2opponent`, `match2player`, `match2game`). You can access these via their MediaWiki API using the `action=lpdb` parameter.

**Example API queries for your event:**

- **All matches for the event:**
  ```
  GET https://liquipedia.net/starcraft2/api.php
    ?action=lpdb
    &format=json
    &table=match2
    &conditions=[[pagename::UThermal_2v2_Circuit/Main_Event]]
    &limit=500
  ```

- **Get opponents (teams/players and scores):**
  ```
  GET https://liquipedia.net/starcraft2/api.php
    ?action=lpdb
    &format=json
    &table=match2opponent
    &conditions=[[pagename::UThermal_2v2_Circuit/Main_Event]]
    &order=matchid asc
    &limit=500
  ```

- **Get individual maps (games):**
  ```
  GET https://liquipedia.net/starcraft2/api.php
    ?action=lpdb
    &format=json
    &table=match2game
    &conditions=[[pagename::UThermal_2v2_Circuit/Main_Event]]
    &order=matchid, game asc
    &limit=500
  ```

You can join these tables using the `matchid` field to reconstruct the full bracket, matchups, and map-by-map results.

**2. Data Storage Strategy**

The scraped data will be stored in a **Supabase PostgreSQL database** rather than JSON files, enabling:
- **Real-time data access** for web applications
- **Advanced SQL queries** for analytics and statistics
- **Scalable data storage** for large tournament datasets
- **Data relationships** between players, matches, tournaments, and maps

**3. Database Schema Overview**

The database will include tables for:
- **Tournaments**: Event information, dates, prize pools
- **Players**: Player profiles, race preferences, statistics
- **Matches**: Match results, scores, brackets
- **Games**: Individual map results, map types, game details
- **Teams**: 2v2 team compositions and partnerships

**4. Data Flow**

```
Liquipedia API → Enhanced Scraper → Supabase Database → Web Frontend
```

This architecture allows for real-time data updates and provides a solid foundation for building advanced SC2 2v2 analytics and statistics applications.

**Minimal Python example:**