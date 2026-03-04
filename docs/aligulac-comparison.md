# SC2Stats vs Aligulac (1v1) — Practical Comparison

## Scope

This compares the current SC2Stats rating mechanics in this repository against Aligulac's published source code (`TheBB/aligulac`).

Primary local references:
- `tools/rankingCalculations.js`
- `tools/processRankings.js`
- `tools/runSeededRankings.js`

Primary Aligulac references:
- `aligulac/aligulac/default.settings.py`
- `aligulac/period.py`
- `aligulac/rating.py`
- `aligulac/ratings/tools.py`

---

## 1) Update granularity

### SC2Stats
- Updates ratings **online per match** as matches are processed chronologically.
- Uses direct per-match delta:
  - `change = K * (actual - expected)`
  - plus a separate score-share term for series margin.

### Aligulac
- Updates ratings **per period/batch** (`period.py`): collects all games in a period, then solves for new ratings and deviations jointly.
- Uses numerical optimization in `rating.py` (`maximize`, gradient/Hessian) rather than a simple Elo step.

### Practical impact
- SC2Stats reacts faster match-to-match.
- Aligulac is smoother and less sensitive to match order inside the same period.

---

## 2) Uncertainty model (confidence vs RD)

### SC2Stats
- Uses a custom `confidence` score (`0..100`) that adjusts K-factor multiplier.
- Confidence updates based on prediction correctness (`updateConfidence`).
- No explicit probabilistic rating deviation state per player.

### Aligulac
- Uses explicit **RD (rating deviation)** state (`dev`, `dev_vp`, `dev_vt`, `dev_vz`).
- RD decays/inflates over inactivity and is bounded:
  - `INIT_DEV = 0.16`, `DECAY_DEV = 0.065`, `MIN_DEV = 0.04` in settings.
- Win probability uses both rating and uncertainty via scale terms (e.g., `sqrt(1 + dev_a^2 + dev_b^2)`).

### Practical impact
- SC2Stats confidence is intuitive and tunable but heuristic.
- Aligulac RD gives a stronger statistical interpretation and better calibrated uncertainty over time.

---

## 3) Expected-win curve

### SC2Stats
- Uses `predictWinProbability(r1, r2, stdDev)` with base `3` logistic-like curve:
  - `1 / (1 + 3^((r2-r1)/stdDev))`
- Population stddev is recomputed from current pool and used as dynamic scale.

### Aligulac
- Uses logistic CDF implementation in `ratings/tools.py`:
  - `cdf(x, loc=0, scale=1) = 0.5 + 0.5*tanh(pi/(2*sqrt(3)) * (x-loc)/scale)`
- Scale in matchup prediction includes player uncertainty (RD).

### Practical impact
- SC2Stats adapts to pool spread but lacks uncertainty-aware scaling.
- Aligulac’s curve is tightly integrated with RD and race-adjusted total ratings.

---

## 4) New players / initialization

### SC2Stats
- New players default to fixed anchor `0` (unless seeded).
- Optional 3-pass seeding pipeline (`runSeededRankings.js`) to reduce cold-start bias.

### Aligulac
- New players initialized by `start_rating(country, period)`:
  - KR gets `0.2`, others `0.0` (in current settings).
- Initial RD set to `INIT_DEV` and then updated through period process.

### Practical impact
- SC2Stats is simple and transparent.
- Aligulac encodes prior belief at initialization and lets RD reflect uncertainty.

---

## 5) Match weighting details

### SC2Stats
- Uses explicit K-factor stack:
  1. newness K (`getNewnessKFactor`),
  2. confidence multiplier,
  3. opponent-newness asymmetry,
  4. series outcome multiplier,
  5. optional score-share term (`scoreWeight`, `scoreK`).
- Includes margin/score-share signal; close wins by heavy favorites can produce small gains or losses.

### Aligulac
- Weights games in `period.py` by race certainty and offline flag:
  - `weight = 1/len(rca)/len(rcb) * (OFFLINE_WEIGHT if m.offline else 1)`
- Uses game-level wins/losses and race decomposition (P/T/Z splits).
- No Elo-style “K” exposed; updates are implicit in the optimization objective.

### Practical impact
- SC2Stats provides highly interpretable knobs.
- Aligulac’s weighting is more model-driven and race-context aware.

---

## 6) Race handling

### SC2Stats
- Race-specific ranking is implemented as a separate derived system (`calculateRaceRankings.js`).
- Core player rating update is not split into base + race deltas.

### Aligulac
- Core rating is decomposed into:
  - base `rating`
  - race adjustments `rating_vp`, `rating_vt`, `rating_vz`
  - corresponding deviations `dev_*`
- Total vs-race rating is `rating + rating_vX`.

### Practical impact
- SC2Stats race stats are easier to explain but less integrated into core skill estimate.
- Aligulac captures matchup-specific skill directly in the main rating state.

---

## 7) Inactivity handling

### SC2Stats
- No explicit inactivity decay step found in current tools pipeline.

### Aligulac
- Tracks inactivity via `decay` periods and filters active players using `INACTIVE_THRESHOLD`.
- RD inflates with time/no games and active lists depend on decay state.

### Practical impact
- SC2Stats may overstate stale ratings.
- Aligulac better separates active strength from historical peak.

---

## Highest-value parity experiments (recommended)

1. **Add RD-lite to SC2Stats**
   - Keep your current formulas, but add per-player uncertainty state and include it in expected-win scale.

2. **Add inactivity inflation/decay**
   - Increase uncertainty (or effective K dampening) for inactive players over elapsed time.

3. **Introduce period snapshots (optional mode)**
   - Keep online updates for UI, but compute a period-frozen leaderboard for stability/comparability.

4. **Integrate race deltas into main rating (phase 2)**
   - Move from separate race ranking tables to base + vs-race adjustments.

5. **Backtest calibration**
   - Compare predicted win bins vs realized win rates and tune multipliers (`scoreWeight`, K stack, asymmetry).

---

## Bottom line

- Your system is currently a **highly tunable Elo-like online model** with practical features for 2v2/series context.
- Aligulac is a **Bayesian-like period model with explicit uncertainty and race decomposition** for 1v1.
- If your goal is “Aligulac-like calibration quality,” the biggest upgrade path is: **uncertainty state + inactivity handling + race-adjusted core rating**.

---

## Calibration toggle (current implementation)

Probability calibration is now implemented as a toggle in `tools/rankingCalculations.js`.

- **Default now:** enabled with `temperature = 1.4`
- **Disable for baseline comparison:**
  - `setPredictionCalibration({ enabled: false })`
- **Enable with custom value:**
  - `setPredictionCalibration({ enabled: true, temperature: 1.2 })`
- **Inspect current state:**
  - `getPredictionCalibrationSettings()`

This allows A/B testing without changing core rating update logic.