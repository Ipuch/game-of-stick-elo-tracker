# Rating Systems Comparison - Fevrier 26 @ Rennes

## Overview
- **Total Matches**: 134
- **Total Players**: 28
- **Session**: Fevrier 26 @ Rennes

## Key Findings

### Top 3 Players (ELO K=60)
1. **Lucien N** - 1325.3
2. **Thomas D** - 1315.3
3. **Armel G** - 1294.2

### Rating System Comparison

All rating systems were tested with the same match data:
- **ELO (K=20, 40, 60)**: Traditional ELO with different K-factors
- **Glicko-1**: Adds rating deviation (uncertainty)
- **Glicko-2**: Adds volatility (performance consistency)

### Ranking Differences

The different rating systems produced varying rankings:

- **ELO K=20** and **ELO K=40**: Thomas D ranked #1
- **ELO K=60** and **Glicko-2**: Lucien N ranked #1
- **Glicko-1**: Thomas D ranked #1

The higher K-factor (K=60) allows for more dramatic rating changes, which better captured Lucien N's strong performance.

### Glicko-2 Insights (Top 5)

| Rank | Player | Rating | RD | 95% CI | Volatility |
|------|--------|--------|-----|---------|------------|
| 1 | Lucien N | 1463.5 | 123.1 | [1217 - 1710] | 0.0600 |
| 2 | Thomas D | 1457.5 | 112.0 | [1234 - 1682] | 0.0600 |
| 3 | Armel G | 1433.1 | 160.2 | [1113 - 1754] | 0.0600 |
| 4 | Thomas M | 1364.3 | 127.4 | [1109 - 1619] | 0.0600 |
| 5 | Nico B | 1338.7 | 115.3 | [1108 - 1569] | 0.0600 |

**Key Observations**:
- Thomas D has the lowest rating deviation (112.0), indicating more consistent performance
- Armel G has higher uncertainty (RD=160.2) despite being ranked #3
- All players have the same volatility (0.0600), suggesting similar performance consistency patterns

## Visualizations

### Comprehensive Comparison Chart

![Comparison Chart](file:///home/ppuchaud/Documents/perso/game-of-stick-elo-tracker/fevrier26_rennes_comparison.png)

This visualization includes 4 panels:

1. **Rating Systems Comparison - All Players**: Side-by-side bar chart comparing all 28 players across all 5 rating systems
2. **Top 10 Players**: Focused comparison of the top performers
3. **Rating Deviations from ELO K=60 Baseline**: Shows how much each system differs from the ELO K=60 baseline
4. **Glicko-2 Ratings with Uncertainty**: Error bars showing the 95% confidence interval for each player's rating

### Ranking Heatmap

![Ranking Heatmap](file:///home/ppuchaud/Documents/perso/game-of-stick-elo-tracker/fevrier26_rennes_ranking_heatmap.png)

This heatmap visualizes the ranking position of each player across all rating systems:
- **Green**: Top rankings (1-10)
- **Yellow**: Mid rankings (11-18)
- **Red**: Lower rankings (19-28)

The heatmap clearly shows where different rating systems agree and disagree on player rankings.

## Files Generated

- **Script**: [`compare_rating_systems_fevrier26.py`](file:///home/ppuchaud/Documents/perso/game-of-stick-elo-tracker/compare_rating_systems_fevrier26.py)
- **Data Source**: [`matches.csv`](file:///home/ppuchaud/Documents/perso/game-of-stick-elo-tracker/Game_of_stick_parties_sauvegardees-20260209T111037Z-1-001/Game_of_stick_parties_sauvegardees/Fevrier26xRennes/matches.csv)

## How to Run

```bash
conda run -n elote_env python compare_rating_systems_fevrier26.py
```
