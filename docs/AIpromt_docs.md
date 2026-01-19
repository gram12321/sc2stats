# AI Documentation Guidelines

## Documentation Files to Update

When making major changes, update these documentation files:
- `docs/versionlog.md` - Version history and changelog
- `README.md` - Main project documentation
- `docs/data-specification.md` - Data structure and format documentation
- `.cursor/rules/ai-agent.rule.mdc/airulesVS.instructions.md` and `.cursor/rules/airules.mdc` - These two should be identical

## Rules vs README

- **Rules files**: Keep clean of additional info, just AI rules and instructions
- **README**: Contains project overview, setup instructions, and feature descriptions
- Try not to duplicate info between rules and README

## Version Log Update Guidelines

### Version Number Format
Version numbers should follow the Git commit names.
- Example: Git commit `9db1324f69a9358fab5fd59128806e4299cf5e1f` → version `0.0023a`
- Format: `Version X.XXXXX - YYYY-MM-DD (commit_sha)`
- Followed by commit title: `[Fix missing M3 games ...]`

### Using Git MCP Tools
Use GitHub MCP tools to check git commits:
- `mcp_github_list_commits` - Get recent commits
- `mcp_github_get_commit` - Get detailed commit information

### Entry Guidelines
- Create an entry for each significant commit
- 5-10 lines depending on extent of updates
- Focus on:
  - Changed files
  - Added/removed functions/functionality
  - New features or major improvements
- Do NOT focus on:
  - Bug fixes (unless critical)
  - Code that was not used in the end
  - Minor refactoring without functional changes

## Current Project Features

### Scraper Capabilities
- Single-elimination bracket parsing
- Double-elimination bracket parsing (upper/lower bracket separation)
- Group stage/round robin match extraction from Matchlist templates

### UI Features
- Tournament bracket visualization
- Tab navigation for Group Stage vs Playoffs
- Match editor with race and score editing
- Player default management

### Data Management
- JSON export format
- Player race defaults
- Manual score correction 