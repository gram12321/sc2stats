# Version Log - SC2 2v2 Stats Scraper

# Guideline for versionlog update for AI-Agents

## 🎯 **Core Principles**
- **ALWAYS use MCP GitHub tools** (`mcp_github2_get_commit`, `mcp_github2_list_commits`) - NEVER use terminal git commands
- **ALWAYS retrieve actual commit data** - Don't guess or assume what changed
- **Verify existing entries** against actual commits before adding new ones

## 📋 **Entry Requirements**
1. **Use `mcp_github2_get_commit` with `include_diff: true`** to get exact file changes and stats
2. **Include specific details:**
   - Mark **NEW FILE:** with exact line counts (e.g., "NEW FILE: component.tsx (372 lines)")
   - Mark **REMOVED:** files that were deleted
   - Include file change stats (e.g., "42 additions, 15 deletions")
   - Note database schema changes explicitly
   
3. **Grouping commits:**
   - Related commits (same feature) can be grouped into one version entry
   - Each entry should cover 1-4 related commits if similiar
   - Large refactors or feature sets may need separate entries

## 📂 **Repository Info**
- **Owner:** gram12321
- **Repository:** sc2stats
- **Full URL:** https://github.com/gram12321/sc2stats.git

## Example of a good versionlog entry

## Version 0.015 - Staff System Foundation & Wage Integration
**Date:** 2025-10-09 | **Commit:** 137b0397 | **Stats:** 2155 additions, 26 deletions
- **NEW FILE:** `src/lib/database/core/staffDB.ts` (184 lines) - Complete staff CRUD operations with Supabase
- **NEW FILE:** `src/components/pages/Staff.tsx` (195 lines) - Main staff management interface
- **NEW FILE:** `src/components/ui/modals/UImodals/HireStaffModal.tsx` (265 lines) - Interactive hiring with skill slider
- **NEW FILE:** `src/components/ui/modals/activitymodals/StaffAssignmentModal.tsx` (234 lines) - Assign staff to activities with work preview
- **NEW FILE:** `src/components/ui/components/StaffSkillBar.tsx` (99 lines) - Visual skill bars with color-coding
- **NEW FILE:** `src/components/finance/StaffWageSummary.tsx` (89 lines) - Wage breakdown display
- **NEW FILE:** `src/lib/constants/staffConstants.ts` (99 lines) - Nationalities, skill levels, specializations, wages
- **NEW FILE:** `src/components/ui/shadCN/slider.tsx` (26 lines) - ShadCN slider component, added `@radix-ui/react-slider`
- **NEW FILE:** `docs/wage_system_integration.md` (175 lines) - Wage system documentation
- `src/lib/services/activity/WorkCalculators/workCalculator.ts` - Staff-based work calculation with multi-tasking penalty, specialization bonus (94 additions, 1 deletion)
- Replaced hardcoded 50 work/tick with dynamic staff contribution based on assigned staff skills
- Added Staff navigation (👥 icon) to header, integrated into app routing


## Version 1.0005a - 2026-01-16 (f8451990)

### 🎯 **Group Stage/Round Robin Support**

#### ✅ **Scraper Enhancements**
- **tools/scraper.js**: Added `parseGroupStage()` function to extract matches from `{{Matchlist}}` templates
- Enhanced group name detection with multiple pattern matching (Group A/B headers, GroupTableLeague titles)
- Extracts matches from Matchlist templates (M1, M2, M3, etc.) with unique IDs (`GS_M1_1`, `GS_M2_1`)
- Combines bracket matches and group stage matches in final output

#### ✅ **UI Enhancements**
- **src/components/BracketView.tsx**: Added tab navigation for "Playoffs" vs "Group Stage"
- Separated group stage matches from bracket matches with automatic detection
- Group stage matches displayed in responsive grid layout grouped by group name
- Each group shown in dedicated card with match count

#### ✅ **Match Editor Enhancements**
- **src/components/MatchEditor.tsx**: Added score editing functionality
- Centered score input section with Team 1 and Team 2 score fields
- Real-time score updates with proper null handling for missing scores
- Visual score separator (":") and "Best of X" display

---

## Version 1.0005 - 2026-01-16 (3acf0414)

### 🎯 **Double-Elimination Bracket Support**

#### ✅ **Bracket View Enhancements**
- **src/components/BracketView.tsx**: Enhanced bracket rendering for double-elimination tournaments
- Separated upper bracket and lower bracket rounds with visual distinction
- Lower bracket detection based on round name patterns ("Lower Bracket" keyword)
- Grand Final displayed separately after lower bracket
- Dynamic round ordering for both single and double-elimination formats

#### ✅ **Round Detection Logic**
- Implemented `useMemo` hooks for efficient round categorization
- Upper bracket rounds exclude "Lower Bracket" matches
- Proper sorting for both bracket types with fallback alphabetical ordering

---

## Version 1.00004 - 2026-01-16 (35539c8b)

### 📊 **Additional Tournament Data**

#### ✅ **Data Collection**
- Enhanced tournament data collection and processing
- Improved match data extraction and storage

---

## Version 1.00003a - 2026-01-16 (ef2da9e1)

### 🔧 **Git Output Fixes**

#### ✅ **Output Improvements**
- Fixed git output formatting and display issues
- Improved commit message handling

---

## Version 1.00003 - 2026-01-15 (2cb5ed30)

### 📊 **Statistics Enhancements**

#### ✅ **Additional Statistics**
- Added more statistical calculations and displays
- Enhanced data analysis capabilities

---

## Version 1.00003 - 2026-01-15 (9a38ca19)

### 🏆 **Ranking System Alpha**

#### ✅ **Ranking Implementation**
- Initial implementation of ranking system
- Player and team ranking calculations
- Ranking display components

---

## Version 1.00002a - 2026-01-15 (5329d8ec)

### 🔧 **Setup Improvements**

#### ✅ **Configuration Updates**
- Refined project setup and configuration
- Improved development environment setup

---

## Version 1.00002 - 2026-01-15 (83c4e5ea)

### ✅ **Working Setup**

#### ✅ **Initial Setup**
- Established working project setup
- Basic functionality implemented

---

## Version 1.00001 - 2026-01-15 (0e29bc0d)

### 🚀 **New Iteration Initial Commit**

#### ✅ **Project Restart**
- New iteration of SC2 2v2 Stats project
- Initial commit with basic structure
- React + TypeScript + Vite setup
- Express.js API server for tournament data
