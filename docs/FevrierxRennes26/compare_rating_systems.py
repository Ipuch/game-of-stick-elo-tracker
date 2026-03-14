"""
Compare Rating Systems using Elote library
ELO (K=20, 40, 60), Glicko-1, and Glicko-2

Analyzes Game of Stick duel data.
"""

import csv
from elote import EloCompetitor, GlickoCompetitor, Glicko2Competitor

# Path to the CSV file
CSV_PATH = "Copie de ELO - GAME OF STICK - DUELS.csv"

def parse_matches(csv_path):
    """Parse matches from CSV file."""
    matches = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # The header spans lines 1-3, actual data starts at line 4 (index 3)
    for line in lines[3:]:  # Skip header rows
        line = line.strip()
        if not line:
            continue
        
        parts = line.split(',')
        if len(parts) < 6:
            continue
        
        match_num = parts[0]
        player1 = parts[1].strip()
        player2 = parts[3].strip()
        result = parts[5].strip()  # Winner name or "NUL" for draw
        
        matches.append({
            'match': int(match_num),
            'player1': player1,
            'player2': player2,
            'winner': result
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
    print(f"{'Rank':<6} {'Player':<15} {'Rating':<10}")
    print("-" * 35)
    for i, (name, rating) in enumerate(standings, 1):
        print(f"{i:<6} {name:<15} {rating:.1f}")


def main():
    print("📊 Rating Systems Comparison - Game of Stick")
    print("=" * 60)
    
    # Parse matches
    matches = parse_matches(CSV_PATH)
    print(f"\n✅ Loaded {len(matches)} matches")
    
    # Get unique players
    players_set = set()
    for m in matches:
        players_set.add(m['player1'])
        players_set.add(m['player2'])
    print(f"✅ Found {len(players_set)} players: {', '.join(sorted(players_set))}")
    
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
    
    # Print all standings
    for system_name, standings in results.items():
        print_standings(system_name, standings)
    
    # Comparison table
    print("\n" + "=" * 80)
    print(" COMPARISON TABLE - Final Ratings")
    print("=" * 80)
    
    # Get all player names
    all_players = sorted(players_set)
    
    # Create comparison dataframe
    comparison_data = []
    for player in all_players:
        row = {'Player': player}
        for system_name, standings in results.items():
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
    header_line = f"{'Player':<12}" + "".join(f"{h:<14}" for h in headers[1:])
    print(header_line)
    print("-" * 80)
    
    for row in comparison_data:
        line = f"{row['Player']:<12}"
        for h in headers[1:]:
            line += f"{row.get(h, 'N/A'):<14}"
        print(line)
    
    # Ranking comparison
    print("\n" + "=" * 80)
    print(" RANKING COMPARISON")
    print("=" * 80)
    
    for system_name, standings in results.items():
        ranking = [name for name, _ in standings]
        print(f"{system_name:<15}: {' > '.join(ranking)}")
    
    # Check if rankings differ
    print("\n" + "=" * 80)
    print(" ANALYSIS")
    print("=" * 80)
    
    base_ranking = [name for name, _ in results['ELO (K=60)']]
    for system_name, standings in results.items():
        if system_name == 'ELO (K=60)':
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
    print("\n" + "=" * 80)
    print(" GLICKO-2 UNCERTAINTY ANALYSIS")
    print("=" * 80)
    print(f"{'Rank':<6} {'Player':<12} {'Rating':<12} {'RD':<10} {'95% CI':<20} {'Volatility':<12}")
    print("-" * 80)
    
    glicko2_detailed = get_glicko2_standings_with_uncertainty(players_g2)
    for i, p in enumerate(glicko2_detailed, 1):
        # 95% confidence interval is approximately rating ± 2*RD
        ci_low = p['rating'] - 2 * p['rd']
        ci_high = p['rating'] + 2 * p['rd']
        ci_str = f"[{ci_low:.0f} - {ci_high:.0f}]"
        print(f"{i:<6} {p['name']:<12} {p['rating']:<12.1f} {p['rd']:<10.1f} {ci_str:<20} {p['volatility']:<12.4f}")
    
    print("\n📝 Legend:")
    print("   • RD (Rating Deviation): Uncertainty in the rating. Lower = more confident.")
    print("   • 95% CI: True skill likely falls within this range (rating ± 2×RD)")
    print("   • Volatility: How erratic the player's performance is (higher = more inconsistent)")


if __name__ == "__main__":
    main()
