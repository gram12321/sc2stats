---
applyTo: '**'
---
# AI Instructions for SC2 2v2 Stats Scraper

## AI Code Generation Principles

- Read @readme.md and this file before making any changes
- After major updates ALWAYS ask to update @readme.md and docs\versionlog.md
- Start every response with the AI-Check-Message where you respond how sure you are you understand the userrequest, and how sure you are that you can solve it. From a scale from 1 to 5. 1 is Absolutly sure i understand this simple and ununambiguous request, that im sure i can solve satisfying. 5 is Unsure what the user requrest, but it seems like a large and complex task that i dont really know how to solve. Give a short feedback of why the promt is easy/difficalut
 Example "AI check: 5 [Clear request but complex task, that require change of many files]"

## AI Code Generation Principles for SC2 2v2 Stats

### 💡 Copilot/AIAGENT Conventions (Always Apply)
- Follow all instructions in this file and the `README.md`. CodeBrief and a Summary Of concept is available in docs\
- Do not use `npm run dev` unless specifically told to. The user already has a dev server running.
- Use named imports; avoid default exports.
- Use ES `import` modules, not `require`.
- Place imports at the top of each file; no inline imports.

### ✅ Key AI Code & Architecture Rules

#### Frontend Development (React) // Not implemented
- **Location**: All React code is in **root directory** (moved from `frontend/` subdirectory for cleaner structure)
- **Styling**: Use **Tailwind CSS** and ShadCN UI exclusively. No Bootstrap or custom CSS
- **Data Integration**: Frontend reads data from **Supabase database** via real-time subscriptions
- **Components**: Use ShadCN-style components in `src/components/ui/`
- **Pages**: Main analysis dashboards in `src/pages/` (Dashboard, Tournament Results, Player Stats, Team Rosters, Analytics)

#### Python Scraping Engine // IMPLEMENTED
- **Main Scraper**: Located in `tools/scraper/scraper.py`
- **Data Storage**: **JSON export** for data persistence and transfer
- **Features**: Caching, error handling, batch processing, rate limiting
- **Database Integration**: **Supabase Python client** for database operations

#### Database & Storage // IMPLEMENTED
- **Supabase**: PostgreSQL database with real-time subscriptions
- **Schema**: Tables for tournaments, players, matches, games, teams
- **Authentication**: Built-in Supabase auth system
- **Real-time**: Live data updates for web applications

### 🔧 AI Development Guidelines
- **Always check README.md first** for project architecture and current status
- **Use Supabase Python client for database operations** - this is the working architecture
- **Follow the JSON export + Supabase insertion pattern** - this is the working architecture
- **Keep scraper focused on data extraction** - let Supabase client handle database persistence
- **Maintain clean separation of concerns** between scraping and database operations
- **Scalable architecture**: Database handles large tournament datasets
- **Advanced analytics**: SQL queries for complex statistics and insights
