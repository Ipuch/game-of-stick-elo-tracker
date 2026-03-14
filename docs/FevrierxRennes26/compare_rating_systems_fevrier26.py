"""
Compare Rating Systems using Elote library
ELO (K=20, 40, 60), Bootstrapped ELO, Glicko-1, and Glicko-2

Analyzes Game of Stick duel data from Fevrier26xRennes session.
"""

import csv
import random
import matplotlib.pyplot as plt
import numpy as np
from elote import EloCompetitor, GlickoCompetitor, Glicko2Competitor
from collections import defaultdict

# Path to the CSV file
CSV_PATH = "Game_of_stick_parties_sauvegardees-20260209T111037Z-1-001/Game_of_stick_parties_sauvegardees/Fevrier26xRennes/matches.csv"

def parse_matches(csv_path):
    """Parse matches from CSV file."""
    matches = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader, 1):
            player1 = row['player1Name'].strip()
            player2 = row['player2Name'].strip()
            outcome = row['outcome'].strip()
            
            # Convert outcome to winner format
            if outcome == 'draw':
                winner = 'NUL'
            elif outcome == 'p1':
                winner = player1
            elif outcome == 'p2':
                winner = player2
            else:
                continue  # Skip invalid outcomes
            
            matches.append({
                'match': i,
                'player1': player1,
                'player2': player2,
                'winner': winner
            })
    
    return matches


def run_elo_simulation(matches, k_factor, initial_rating=1200):
    """Run ELO simulation with given K-factor."""
    players = {}
    history = []
    
    for match in matches:
        p1_name = match['player1']
        p2_name = match['player2']
        winner = match['winner']
        
        # Initialize players if needed
        if p1_name not in players:
            players[p1_name] = EloCompetitor(initial_rating=initial_rating, k_factor=k_factor)
        if p2_name not in players:
            players[p2_name] = EloCompetitor(initial_rating=initial_rating, k_factor=k_factor)
        
        p1 = players[p1_name]
        p2 = players[p2_name]
        
        # Record pre-match ratings
        p1_before = p1.rating
        p2_before = p2.rating
        
        # Process match result
        if winner == "NUL":
            p1.tied(p2)
        elif winner == p1_name:
            p1.beat(p2)
        else:
            p2.beat(p1)
        
        history.append({
            'match': match['match'],
            'player1': p1_name,
            'player2': p2_name,
            'winner': winner,
            f'{p1_name}_before': p1_before,
            f'{p1_name}_after': p1.rating,
            f'{p2_name}_before': p2_before,
            f'{p2_name}_after': p2.rating
        })
    
    return players, history


def run_bootstrapped_elo(matches, k_factor, n_bootstrap=1000, initial_rating=1200, seed=42):
    """Run bootstrapped ELO simulation to estimate rating uncertainty.
    
    Args:
        matches: List of match dictionaries
        k_factor: ELO K-factor
        n_bootstrap: Number of bootstrap iterations
        initial_rating: Initial rating for all players
        seed: Random seed for reproducibility
    
    Returns:
        Dictionary with player names as keys and dictionaries containing:
        - mean: Mean rating across bootstrap samples
        - std: Standard deviation
        - ci_low: 2.5th percentile (95% CI lower bound)
        - ci_high: 97.5th percentile (95% CI upper bound)
        - samples: All bootstrap rating samples
    """
    random.seed(seed)
    np.random.seed(seed)
    
    # Store ratings for each bootstrap iteration
    player_ratings = defaultdict(list)
    
    for _ in range(n_bootstrap):
        # Resample matches with replacement
        resampled_matches = random.choices(matches, k=len(matches))
        
        # Run ELO simulation on resampled matches
        players, _ = run_elo_simulation(resampled_matches, k_factor, initial_rating)
        
        # Store ratings
        for name, competitor in players.items():
            player_ratings[name].append(competitor.rating)
    
    # Calculate statistics for each player
    results = {}
    for name, ratings in player_ratings.items():
        ratings = np.array(ratings)
        results[name] = {
            'mean': np.mean(ratings),
            'std': np.std(ratings),
            'ci_low': np.percentile(ratings, 2.5),
            'ci_high': np.percentile(ratings, 97.5),
            'median': np.median(ratings),
            'samples': ratings
        }
    
    return results


def get_bootstrapped_standings(bootstrap_results):
    """Get sorted standings from bootstrapped results (sorted by mean rating)."""
    standings = [(name, stats['mean']) for name, stats in bootstrap_results.items()]
    standings.sort(key=lambda x: x[1], reverse=True)
    return standings


def print_bootstrapped_standings(title, bootstrap_results):
    """Print nicely formatted bootstrapped standings with confidence intervals."""
    standings = sorted(bootstrap_results.items(), key=lambda x: x[1]['mean'], reverse=True)
    
    print(f"\n{'='*90}")
    print(f" {title}")
    print(f"{'='*90}")
    print(f"{'Rank':<6} {'Player':<15} {'Mean':<10} {'Std':<10} {'95% CI':<25} {'Median':<10}")
    print("-" * 90)
    
    for i, (name, stats) in enumerate(standings, 1):
        ci_str = f"[{stats['ci_low']:.0f} - {stats['ci_high']:.0f}]"
        print(f"{i:<6} {name:<15} {stats['mean']:.1f}     {stats['std']:.1f}     {ci_str:<25} {stats['median']:.1f}")


def run_glicko_simulation(matches, initial_rating=1200, glicko_version=1):
    """Run Glicko simulation."""
    players = {}
    history = []
    
    CompetitorClass = GlickoCompetitor if glicko_version == 1 else Glicko2Competitor
    
    for match in matches:
        p1_name = match['player1']
        p2_name = match['player2']
        winner = match['winner']
        
        # Initialize players if needed
        if p1_name not in players:
            players[p1_name] = CompetitorClass(initial_rating=initial_rating)
        if p2_name not in players:
            players[p2_name] = CompetitorClass(initial_rating=initial_rating)
        
        p1 = players[p1_name]
        p2 = players[p2_name]
        
        # Record pre-match ratings
        p1_before = p1.rating
        p2_before = p2.rating
        
        # Process match result
        if winner == "NUL":
            p1.tied(p2)
        elif winner == p1_name:
            p1.beat(p2)
        else:
            p2.beat(p1)
        
        history.append({
            'match': match['match'],
            'player1': p1_name,
            'player2': p2_name,
            'winner': winner,
            f'{p1_name}_before': p1_before,
            f'{p1_name}_after': p1.rating,
            f'{p2_name}_before': p2_before,
            f'{p2_name}_after': p2.rating
        })
    
    return players, history


def get_final_standings(players):
    """Get sorted standings from players dict."""
    standings = [(name, p.rating) for name, p in players.items()]
    standings.sort(key=lambda x: x[1], reverse=True)
    return standings


def get_glicko2_standings_with_uncertainty(players):
    """Get sorted standings with RD and volatility for Glicko-2."""
    standings = []
    for name, p in players.items():
        standings.append({
            'name': name,
            'rating': p.rating,
            'rd': p.rd,  # Rating Deviation
            'volatility': p.volatility
        })
    standings.sort(key=lambda x: x['rating'], reverse=True)
    return standings


def print_standings(title, standings):
    """Print nicely formatted standings."""
    print(f"\n{'='*50}")
    print(f" {title}")
    print(f"{'='*50}")
    print(f"{'Rank':<6} {'Player':<20} {'Rating':<10}")
    print("-" * 40)
    for i, (name, rating) in enumerate(standings, 1):
        print(f"{i:<6} {name:<20} {rating:.1f}")


def create_visualizations(results, players_g2, output_prefix="fevrier26_rennes"):
    """Create comprehensive visualizations comparing rating systems."""
    
    # Get all players sorted by ELO K=60
    all_players = [name for name, _ in results['ELO (K=60)']]
    
    # Prepare data for plotting (only non-bootstrap systems)
    systems = ['ELO (K=20)', 'ELO (K=40)', 'ELO (K=60)', 'Glicko-1', 'Glicko-2']
    colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6']
    
    # Create figure with multiple subplots
    fig = plt.figure(figsize=(20, 12))
    
    # 1. Main comparison: All systems side by side
    ax1 = plt.subplot(2, 2, 1)
    x = np.arange(len(all_players))
    width = 0.15
    
    for i, (system, color) in enumerate(zip(systems, colors)):
        ratings = [next((r for n, r in results[system] if n == player), 0) for player in all_players]
        offset = (i - 2) * width
        ax1.bar(x + offset, ratings, width, label=system, color=color, alpha=0.8)
    
    ax1.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Rating', fontsize=12, fontweight='bold')
    ax1.set_title('Rating Systems Comparison - All Players', fontsize=14, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(all_players, rotation=45, ha='right', fontsize=8)
    ax1.legend(loc='upper right')
    ax1.grid(axis='y', alpha=0.3)
    ax1.axhline(y=1200, color='gray', linestyle='--', alpha=0.5, label='Initial Rating')
    
    # 2. Top 10 players comparison
    ax2 = plt.subplot(2, 2, 2)
    top_10_players = all_players[:10]
    x_top = np.arange(len(top_10_players))
    
    for i, (system, color) in enumerate(zip(systems, colors)):
        ratings = [next((r for n, r in results[system] if n == player), 0) for player in top_10_players]
        offset = (i - 2) * width
        ax2.bar(x_top + offset, ratings, width, label=system, color=color, alpha=0.8)
    
    ax2.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Rating', fontsize=12, fontweight='bold')
    ax2.set_title('Top 10 Players - Rating Systems Comparison', fontsize=14, fontweight='bold')
    ax2.set_xticks(x_top)
    ax2.set_xticklabels(top_10_players, rotation=45, ha='right', fontsize=10)
    ax2.legend(loc='upper right')
    ax2.grid(axis='y', alpha=0.3)
    
    # 3. Rating differences from ELO K=60 baseline
    ax3 = plt.subplot(2, 2, 3)
    baseline_system = 'ELO (K=60)'
    baseline_ratings = {name: rating for name, rating in results[baseline_system]}
    
    for system, color in zip(systems[:-1], colors[:-1]):  # Exclude K=60 itself
        if system == baseline_system:
            continue
        differences = []
        for player in all_players:
            baseline = baseline_ratings[player]
            current = next((r for n, r in results[system] if n == player), 0)
            differences.append(current - baseline)
        
        ax3.plot(x, differences, marker='o', label=system, color=color, linewidth=2, markersize=4)
    
    ax3.axhline(y=0, color='red', linestyle='--', linewidth=2, alpha=0.7, label='ELO K=60 Baseline')
    ax3.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax3.set_ylabel('Rating Difference from ELO K=60', fontsize=12, fontweight='bold')
    ax3.set_title('Rating Deviations from ELO K=60 Baseline', fontsize=14, fontweight='bold')
    ax3.set_xticks(x)
    ax3.set_xticklabels(all_players, rotation=45, ha='right', fontsize=8)
    ax3.legend(loc='best')
    ax3.grid(alpha=0.3)
    
    # 4. Glicko-2 Uncertainty Analysis
    ax4 = plt.subplot(2, 2, 4)
    glicko2_detailed = get_glicko2_standings_with_uncertainty(players_g2)
    g2_players = [p['name'] for p in glicko2_detailed]
    g2_ratings = [p['rating'] for p in glicko2_detailed]
    g2_rds = [p['rd'] for p in glicko2_detailed]
    
    x_g2 = np.arange(len(g2_players))
    
    # Plot ratings with error bars (RD)
    ax4.errorbar(x_g2, g2_ratings, yerr=[2*rd for rd in g2_rds], 
                 fmt='o', color='#9b59b6', ecolor='#e74c3c', 
                 elinewidth=2, capsize=5, capthick=2, markersize=6,
                 label='Rating ± 2×RD (95% CI)')
    
    ax4.set_xlabel('Players (Ranked by Glicko-2)', fontsize=12, fontweight='bold')
    ax4.set_ylabel('Rating', fontsize=12, fontweight='bold')
    ax4.set_title('Glicko-2 Ratings with Uncertainty (95% CI)', fontsize=14, fontweight='bold')
    ax4.set_xticks(x_g2)
    ax4.set_xticklabels(g2_players, rotation=45, ha='right', fontsize=8)
    ax4.legend(loc='upper right')
    ax4.grid(alpha=0.3)
    ax4.axhline(y=1200, color='gray', linestyle='--', alpha=0.5, label='Initial Rating')
    
    plt.tight_layout()
    
    # Save the figure
    output_file = f"{output_prefix}_comparison.png"
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"\n✅ Visualization saved to: {output_file}")
    
    # Create a second figure for ranking comparison
    fig2, ax = plt.subplots(figsize=(16, 10))
    
    # Create ranking matrix
    ranking_matrix = []
    for system in systems:
        rankings = [next((i+1 for i, (n, _) in enumerate(results[system]) if n == player), 0) 
                   for player in all_players]
        ranking_matrix.append(rankings)
    
    ranking_matrix = np.array(ranking_matrix)
    
    # Create heatmap
    im = ax.imshow(ranking_matrix, cmap='RdYlGn_r', aspect='auto', vmin=1, vmax=len(all_players))
    
    # Set ticks and labels
    ax.set_xticks(np.arange(len(all_players)))
    ax.set_yticks(np.arange(len(systems)))
    ax.set_xticklabels(all_players, rotation=45, ha='right', fontsize=9)
    ax.set_yticklabels(systems, fontsize=11)
    
    # Add colorbar
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Rank Position', rotation=270, labelpad=20, fontsize=12, fontweight='bold')
    
    # Add text annotations
    for i in range(len(systems)):
        for j in range(len(all_players)):
            text = ax.text(j, i, int(ranking_matrix[i, j]),
                          ha="center", va="center", color="black", fontsize=8, fontweight='bold')
    
    ax.set_title('Ranking Heatmap - All Rating Systems', fontsize=16, fontweight='bold', pad=20)
    ax.set_xlabel('Players (sorted by ELO K=60)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Rating System', fontsize=12, fontweight='bold')
    
    plt.tight_layout()
    
    # Save the ranking heatmap
    output_file2 = f"{output_prefix}_ranking_heatmap.png"
    plt.savefig(output_file2, dpi=300, bbox_inches='tight')
    print(f"✅ Ranking heatmap saved to: {output_file2}")


def create_bootstrap_visualization(bootstrap_results_by_k, output_prefix="fevrier26_rennes"):
    """Create visualization for bootstrapped ELO results."""
    
    fig, axes = plt.subplots(2, 2, figsize=(18, 14))
    
    k_factors = [20, 40, 60]
    colors = ['#3498db', '#2ecc71', '#e74c3c']
    
    # Get player order from K=60 (by mean rating)
    all_players = [name for name, _ in get_bootstrapped_standings(bootstrap_results_by_k[60])]
    
    # 1. Comparison of mean ratings across K-factors (top-left)
    ax1 = axes[0, 0]
    x = np.arange(len(all_players))
    width = 0.25
    
    for i, (k, color) in enumerate(zip(k_factors, colors)):
        results = bootstrap_results_by_k[k]
        means = [results[p]['mean'] for p in all_players]
        errors = [results[p]['std'] for p in all_players]
        offset = (i - 1) * width
        ax1.bar(x + offset, means, width, yerr=errors, label=f'K={k}', color=color, alpha=0.8, capsize=2)
    
    ax1.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax1.set_ylabel('Rating (Mean ± Std)', fontsize=12, fontweight='bold')
    ax1.set_title('Bootstrapped ELO - Mean Ratings with Standard Deviation', fontsize=14, fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(all_players, rotation=45, ha='right', fontsize=8)
    ax1.legend(loc='upper right')
    ax1.grid(axis='y', alpha=0.3)
    ax1.axhline(y=1200, color='gray', linestyle='--', alpha=0.5)
    
    # 2. 95% Confidence Interval comparison for top 10 (top-right)
    ax2 = axes[0, 1]
    top_10 = all_players[:10]
    x_top = np.arange(len(top_10))
    
    for i, (k, color) in enumerate(zip(k_factors, colors)):
        results = bootstrap_results_by_k[k]
        means = [results[p]['mean'] for p in top_10]
        ci_low = [results[p]['mean'] - results[p]['ci_low'] for p in top_10]
        ci_high = [results[p]['ci_high'] - results[p]['mean'] for p in top_10]
        offset = (i - 1) * 0.25
        ax2.errorbar(x_top + offset, means, yerr=[ci_low, ci_high], 
                    fmt='o', color=color, label=f'K={k}', capsize=5, markersize=8, linewidth=2)
    
    ax2.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax2.set_ylabel('Rating (95% CI)', fontsize=12, fontweight='bold')
    ax2.set_title('Top 10 Players - 95% Confidence Intervals', fontsize=14, fontweight='bold')
    ax2.set_xticks(x_top)
    ax2.set_xticklabels(top_10, rotation=45, ha='right', fontsize=10)
    ax2.legend(loc='upper right')
    ax2.grid(alpha=0.3)
    
    # 3. Distribution violin plots for top 5 players (bottom-left)
    ax3 = axes[1, 0]
    top_5 = all_players[:5]
    
    violin_data = []
    violin_positions = []
    violin_colors = []
    
    for j, player in enumerate(top_5):
        for i, k in enumerate(k_factors):
            violin_data.append(bootstrap_results_by_k[k][player]['samples'])
            violin_positions.append(j * 4 + i)
            violin_colors.append(colors[i])
    
    parts = ax3.violinplot(violin_data, positions=violin_positions, showmeans=True, showmedians=True)
    
    for i, pc in enumerate(parts['bodies']):
        pc.set_facecolor(violin_colors[i])
        pc.set_alpha(0.7)
    
    ax3.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax3.set_ylabel('Rating Distribution', fontsize=12, fontweight='bold')
    ax3.set_title('Top 5 Players - Rating Distributions (Violin Plots)', fontsize=14, fontweight='bold')
    ax3.set_xticks([1 + i*4 for i in range(len(top_5))])
    ax3.set_xticklabels(top_5, fontsize=10)
    ax3.grid(axis='y', alpha=0.3)
    
    # Add legend manually
    from matplotlib.patches import Patch
    legend_elements = [Patch(facecolor=c, alpha=0.7, label=f'K={k}') for k, c in zip(k_factors, colors)]
    ax3.legend(handles=legend_elements, loc='upper right')
    
    # 4. CI Width comparison - which K gives tighter estimates? (bottom-right)
    ax4 = axes[1, 1]
    
    for i, (k, color) in enumerate(zip(k_factors, colors)):
        results = bootstrap_results_by_k[k]
        ci_widths = [results[p]['ci_high'] - results[p]['ci_low'] for p in all_players]
        ax4.plot(x, ci_widths, marker='o', color=color, label=f'K={k}', linewidth=2, markersize=4)
    
    ax4.set_xlabel('Players', fontsize=12, fontweight='bold')
    ax4.set_ylabel('95% CI Width', fontsize=12, fontweight='bold')
    ax4.set_title('Confidence Interval Width by K-Factor', fontsize=14, fontweight='bold')
    ax4.set_xticks(x)
    ax4.set_xticklabels(all_players, rotation=45, ha='right', fontsize=8)
    ax4.legend(loc='upper right')
    ax4.grid(alpha=0.3)
    
    plt.tight_layout()
    
    output_file = f"{output_prefix}_bootstrapped_elo.png"
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"✅ Bootstrapped ELO visualization saved to: {output_file}")


def create_bump_chart(results, bootstrap_results_by_k, players_g2, output_prefix="fevrier26_rennes"):
    """Create a bump chart showing rankings across all methods with uncertainty ribbons."""
    
    from matplotlib.patches import Patch
    import matplotlib.lines as mlines
    
    # Define all methods in order
    methods_no_uncertainty = ['ELO (K=20)', 'ELO (K=40)', 'ELO (K=60)', 'Glicko-1']
    methods_bootstrap = ['Bootstrap K=20', 'Bootstrap K=40', 'Bootstrap K=60']
    methods_glicko2 = ['Glicko-2']
    all_methods = methods_no_uncertainty + methods_bootstrap + methods_glicko2
    
    # Get player order from ELO K=60
    all_players = [name for name, _ in results['ELO (K=60)']]
    n_players = len(all_players)
    n_methods = len(all_methods)
    
    # Prepare ranking data
    # For each method, compute the ranking for each player
    rankings = {}
    rank_uncertainties = {}  # For methods with uncertainty: (lower_rank, upper_rank)
    
    # Standard methods (no uncertainty)
    for method in methods_no_uncertainty:
        method_standings = results[method]
        rankings[method] = {name: i+1 for i, (name, _) in enumerate(method_standings)}
        rank_uncertainties[method] = None
    
    # Bootstrap methods (with uncertainty)
    k_map = {'Bootstrap K=20': 20, 'Bootstrap K=40': 40, 'Bootstrap K=60': 60}
    for method in methods_bootstrap:
        k = k_map[method]
        bootstrap_data = bootstrap_results_by_k[k]
        
        # Get mean ranking
        standings = get_bootstrapped_standings(bootstrap_data)
        rankings[method] = {name: i+1 for i, (name, _) in enumerate(standings)}
        
        # Compute rank uncertainty from bootstrap samples
        # For each player, compute their rank in each bootstrap sample
        rank_samples = defaultdict(list)
        
        # Get minimum sample count across all players
        n_samples = min(len(data['samples']) for data in bootstrap_data.values())
        
        for sample_idx in range(n_samples):
            # Get ratings for this sample
            sample_ratings = [(name, data['samples'][sample_idx]) for name, data in bootstrap_data.items()]
            sample_ratings.sort(key=lambda x: x[1], reverse=True)
            for rank, (name, _) in enumerate(sample_ratings, 1):
                rank_samples[name].append(rank)
        
        # Compute 95% CI for ranks
        rank_uncertainties[method] = {}
        for name in all_players:
            samples = np.array(rank_samples[name])
            rank_uncertainties[method][name] = (
                np.percentile(samples, 2.5),
                np.percentile(samples, 97.5)
            )
    
    # Glicko-2 (with uncertainty via RD)
    glicko2_data = get_glicko2_standings_with_uncertainty(players_g2)
    rankings['Glicko-2'] = {p['name']: i+1 for i, p in enumerate(glicko2_data)}
    
    # For Glicko-2, estimate rank uncertainty from rating ± 2*RD
    # Monte Carlo simulation to estimate rank uncertainty
    n_simulations = 1000
    np.random.seed(42)
    rank_samples_g2 = defaultdict(list)
    for _ in range(n_simulations):
        # Sample ratings from normal distribution with mean=rating, std=RD
        sampled_ratings = []
        for p in glicko2_data:
            sampled_rating = np.random.normal(p['rating'], p['rd'])
            sampled_ratings.append((p['name'], sampled_rating))
        sampled_ratings.sort(key=lambda x: x[1], reverse=True)
        for rank, (name, _) in enumerate(sampled_ratings, 1):
            rank_samples_g2[name].append(rank)
    
    rank_uncertainties['Glicko-2'] = {}
    for name in all_players:
        samples = np.array(rank_samples_g2[name])
        rank_uncertainties['Glicko-2'][name] = (
            np.percentile(samples, 2.5),
            np.percentile(samples, 97.5)
        )
    
    # Create color palette for players
    cmap = plt.cm.get_cmap('tab20', n_players)
    player_colors = {player: cmap(i) for i, player in enumerate(all_players)}
    
    # Create the bump chart
    fig, ax = plt.subplots(figsize=(18, 14))
    
    x_positions = np.arange(n_methods)
    
    # Draw lines and uncertainty ribbons for each player
    for player in all_players:
        color = player_colors[player]
        y_values = [rankings[method][player] for method in all_methods]
        
        # Draw the main line
        ax.plot(x_positions, y_values, '-o', color=color, linewidth=2, markersize=8, 
                label=player, alpha=0.8, zorder=3)
        
        # Draw uncertainty ribbons for methods with uncertainty
        for i, method in enumerate(all_methods):
            if rank_uncertainties[method] is not None:
                ci_low, ci_high = rank_uncertainties[method][player]
                # Draw vertical error bar
                ax.plot([i, i], [ci_low, ci_high], color=color, linewidth=4, alpha=0.3, zorder=2)
    
    # Add player names on the right side
    final_rankings = rankings[all_methods[-1]]
    for player in all_players:
        final_rank = final_rankings[player]
        ax.annotate(player, xy=(n_methods - 1, final_rank), xytext=(n_methods - 0.7, final_rank),
                   fontsize=9, va='center', color=player_colors[player], fontweight='bold')
    
    # Add player names on the left side
    first_rankings = rankings[all_methods[0]]
    for player in all_players:
        first_rank = first_rankings[player]
        ax.annotate(player, xy=(0, first_rank), xytext=(-0.3, first_rank),
                   fontsize=9, va='center', ha='right', color=player_colors[player], fontweight='bold')
    
    # Configure axes
    ax.set_xlim(-1.5, n_methods + 1)
    ax.set_ylim(n_players + 0.5, 0.5)  # Invert y-axis, rank 1 at top
    ax.set_xticks(x_positions)
    ax.set_xticklabels(all_methods, rotation=30, ha='right', fontsize=11)
    ax.set_yticks(range(1, n_players + 1))
    ax.set_ylabel('Rank', fontsize=14, fontweight='bold')
    ax.set_xlabel('Rating Method', fontsize=14, fontweight='bold')
    ax.set_title('Bump Chart - Player Rankings Across All Methods\n(with 95% CI uncertainty ribbons for Bootstrap & Glicko-2)', 
                fontsize=16, fontweight='bold')
    
    # Add grid
    ax.grid(axis='y', alpha=0.3, linestyle='-')
    ax.axhline(y=10.5, color='red', linestyle='--', alpha=0.5, linewidth=2)  # Top 10 line
    
    # Add method category labels
    ax.axvline(x=3.5, color='gray', linestyle=':', alpha=0.5)
    ax.axvline(x=6.5, color='gray', linestyle=':', alpha=0.5)
    ax.text(1.5, n_players + 1.3, 'Standard ELO & Glicko-1', ha='center', fontsize=10, style='italic', color='gray')
    ax.text(5, n_players + 1.3, 'Bootstrapped ELO', ha='center', fontsize=10, style='italic', color='gray')
    ax.text(7, n_players + 1.3, 'Glicko-2', ha='center', fontsize=10, style='italic', color='gray')
    
    plt.tight_layout()
    
    output_file = f"{output_prefix}_bump_chart.png"
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"✅ Bump chart saved to: {output_file}")
    
    # Create a cleaner version with only top 15 players
    fig2, ax2 = plt.subplots(figsize=(18, 12))
    
    top_15_players = all_players[:15]
    
    for player in top_15_players:
        color = player_colors[player]
        y_values = [rankings[method][player] for method in all_methods]
        
        ax2.plot(x_positions, y_values, '-o', color=color, linewidth=2.5, markersize=10, 
                label=player, alpha=0.9, zorder=3)
        
        for i, method in enumerate(all_methods):
            if rank_uncertainties[method] is not None:
                ci_low, ci_high = rank_uncertainties[method][player]
                ax2.fill_between([i-0.15, i+0.15], [ci_low, ci_low], [ci_high, ci_high],
                               color=color, alpha=0.2, zorder=1)
    
    # Add labels
    for player in top_15_players:
        final_rank = rankings[all_methods[-1]][player]
        ax2.annotate(player, xy=(n_methods - 1, final_rank), xytext=(n_methods - 0.6, final_rank),
                   fontsize=10, va='center', color=player_colors[player], fontweight='bold')
        
        first_rank = rankings[all_methods[0]][player]
        ax2.annotate(player, xy=(0, first_rank), xytext=(-0.3, first_rank),
                   fontsize=10, va='center', ha='right', color=player_colors[player], fontweight='bold')
    
    ax2.set_xlim(-1.5, n_methods + 1)
    ax2.set_ylim(16, 0.5)
    ax2.set_xticks(x_positions)
    ax2.set_xticklabels(all_methods, rotation=30, ha='right', fontsize=11)
    ax2.set_yticks(range(1, 16))
    ax2.set_ylabel('Rank', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Rating Method', fontsize=14, fontweight='bold')
    ax2.set_title('Bump Chart - Top 15 Players\n(with 95% CI uncertainty ribbons)', 
                fontsize=16, fontweight='bold')
    ax2.grid(axis='y', alpha=0.3)
    ax2.axvline(x=3.5, color='gray', linestyle=':', alpha=0.5)
    ax2.axvline(x=6.5, color='gray', linestyle=':', alpha=0.5)
    
    plt.tight_layout()
    
    output_file2 = f"{output_prefix}_bump_chart_top15.png"
    plt.savefig(output_file2, dpi=300, bbox_inches='tight')
    print(f"✅ Bump chart (Top 15) saved to: {output_file2}")


def main():
    print("📊 Rating Systems Comparison - Game of Stick (Fevrier 26 @ Rennes)")
    print("=" * 80)
    
    # Parse matches
    matches = parse_matches(CSV_PATH)
    print(f"\n✅ Loaded {len(matches)} matches")
    
    # Get unique players
    players_set = set()
    for m in matches:
        players_set.add(m['player1'])
        players_set.add(m['player2'])
    print(f"✅ Found {len(players_set)} players")
    print(f"   Players: {', '.join(sorted(players_set))}")
    
    # Run simulations
    results = {}
    
    # ELO with different K-factors
    for k in [20, 40, 60]:
        players, _ = run_elo_simulation(matches, k_factor=k, initial_rating=1200)
        results[f'ELO (K={k})'] = get_final_standings(players)
    
    # Glicko-1
    players_g1, _ = run_glicko_simulation(matches, initial_rating=1200, glicko_version=1)
    results['Glicko-1'] = get_final_standings(players_g1)
    
    # Glicko-2
    players_g2, _ = run_glicko_simulation(matches, initial_rating=1200, glicko_version=2)
    results['Glicko-2'] = get_final_standings(players_g2)
    
    # Bootstrapped ELO
    print("\n" + "=" * 120)
    print(" RUNNING BOOTSTRAPPED ELO (1000 iterations per K-factor)...")
    print("=" * 120)
    
    bootstrap_results_by_k = {}
    for k in [20, 40, 60]:
        print(f"  Running bootstrap for K={k}...")
        bootstrap_results_by_k[k] = run_bootstrapped_elo(matches, k_factor=k, n_bootstrap=1000)
        results[f'Bootstrap ELO (K={k})'] = get_bootstrapped_standings(bootstrap_results_by_k[k])
    
    # Print all standings (non-bootstrap)
    for system_name, standings in results.items():
        if 'Bootstrap' not in system_name:
            print_standings(system_name, standings)
    
    # Comparison table
    print("\n" + "=" * 120)
    print(" COMPARISON TABLE - Final Ratings")
    print("=" * 120)
    
    # Get all player names
    all_players = sorted(players_set)
    
    # Create comparison dataframe
    comparison_data = []
    for player in all_players:
        row = {'Player': player}
        for system_name, standings in results.items():
            if 'Bootstrap' not in system_name:
                rating = next((r for n, r in standings if n == player), None)
                row[system_name] = f"{rating:.1f}" if rating else "N/A"
        comparison_data.append(row)
    
    # Sort by ELO K=60 (original game setting)
    comparison_data.sort(
        key=lambda x: float(x.get('ELO (K=60)', '0')), 
        reverse=True
    )
    
    # Print comparison table
    headers = ['Player', 'ELO (K=20)', 'ELO (K=40)', 'ELO (K=60)', 'Glicko-1', 'Glicko-2']
    header_line = f"{'Player':<20}" + "".join(f"{h:<14}" for h in headers[1:])
    print(header_line)
    print("-" * 120)
    
    for row in comparison_data:
        line = f"{row['Player']:<20}"
        for h in headers[1:]:
            line += f"{row.get(h, 'N/A'):<14}"
        print(line)
    
    # Ranking comparison
    print("\n" + "=" * 120)
    print(" RANKING COMPARISON")
    print("=" * 120)
    
    for system_name, standings in results.items():
        if 'Bootstrap' not in system_name:
            ranking = [name for name, _ in standings]
            print(f"{system_name:<15}: {' > '.join(ranking)}")
    
    # Check if rankings differ
    print("\n" + "=" * 120)
    print(" ANALYSIS")
    print("=" * 120)
    
    base_ranking = [name for name, _ in results['ELO (K=60)']]
    for system_name, standings in results.items():
        if system_name == 'ELO (K=60)' or 'Bootstrap' in system_name:
            continue
        ranking = [name for name, _ in standings]
        if ranking == base_ranking:
            print(f"✅ {system_name} maintains same ranking order as ELO (K=60)")
        else:
            differences = []
            for i, (orig, new) in enumerate(zip(base_ranking, ranking)):
                if orig != new:
                    differences.append(f"Position {i+1}: {orig} vs {new}")
            print(f"⚠️  {system_name} differs: {'; '.join(differences)}")
    
    # Glicko-2 Uncertainty Analysis
    print("\n" + "=" * 120)
    print(" GLICKO-2 UNCERTAINTY ANALYSIS")
    print("=" * 120)
    print(f"{'Rank':<6} {'Player':<20} {'Rating':<12} {'RD':<10} {'95% CI':<20} {'Volatility':<12}")
    print("-" * 120)
    
    glicko2_detailed = get_glicko2_standings_with_uncertainty(players_g2)
    for i, p in enumerate(glicko2_detailed, 1):
        # 95% confidence interval is approximately rating ± 2*RD
        ci_low = p['rating'] - 2 * p['rd']
        ci_high = p['rating'] + 2 * p['rd']
        ci_str = f"[{ci_low:.0f} - {ci_high:.0f}]"
        print(f"{i:<6} {p['name']:<20} {p['rating']:<12.1f} {p['rd']:<10.1f} {ci_str:<20} {p['volatility']:<12.4f}")
    
    # Bootstrapped ELO Analysis
    print("\n" + "=" * 120)
    print(" BOOTSTRAPPED ELO UNCERTAINTY ANALYSIS")
    print("=" * 120)
    
    for k in [20, 40, 60]:
        print_bootstrapped_standings(f"Bootstrapped ELO (K={k}) - 1000 iterations", bootstrap_results_by_k[k])
    
    print("\n📝 Legend:")
    print("   • RD (Rating Deviation): Uncertainty in the rating. Lower = more confident.")
    print("   • 95% CI: True skill likely falls within this range (rating ± 2×RD)")
    print("   • Volatility: How erratic the player's performance is (higher = more inconsistent)")
    print("   • Bootstrap CI: Rating range where 95% of resampled simulations fall")
    
    # Generate visualizations
    print("\n" + "=" * 120)
    print(" GENERATING VISUALIZATIONS")
    print("=" * 120)
    create_visualizations(results, players_g2)
    create_bootstrap_visualization(bootstrap_results_by_k)
    create_bump_chart(results, bootstrap_results_by_k, players_g2)
    
    plt.show()


if __name__ == "__main__":
    main()
