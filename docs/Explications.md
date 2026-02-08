# Présentation – Système de jeu "Game of Stick" en Parkour

## Introduction

« Les tournois, c'est sympa… mais quand tu perds ton premier duel, t'es éliminé, t'es dégoûté, et tu passes le reste du temps à regarder. Alors que t'es venu pour jouer. »

L'idée de ce système de jeu, c'est simple : jouer le plus longtemps possible, jusqu'à la fin de la session, quel que soit ton niveau.

## Le problème des formats classiques

### Tournoi classique
- tu perds → tu sors
- le gagnant est celui qui ne perd jamais
- beaucoup d'attente, peu de pratique

### Notre approche
- tout le monde joue en continu
- tout le monde peut s'affronter
- le gagnant final est celui qui bat le plus de personnes, pas juste celui qui survit à un arbre

## Le principe du système

Pour ça, on utilise un système connu et éprouvé pour mesurer le niveau : le système Elo.

- Plus tu fais de matchs, plus ton score devient précis
- Et chaque duel a un vrai enjeu

## Comment ça marche concrètement

Tout le monde commence avec 1200 points Elo.

Chaque duel :
- le gagnant gagne des points
- le perdant en perd
- La quantité de points dépend de la différence de niveau entre les deux joueurs (K factor = 60)

### Exemples concrets

**1200 contre 1200**
- Le vainqueur gagne +30 points
- Le perdant perd -30 points
- Match équilibré, récompense standard

**1530 contre 1530**
- Même logique : +30 / -30
- Peu importe le niveau absolu, c'est l'écart qui compte

**1400 contre 900 - le favori gagne**
- Le joueur à 1400 gagne seulement +1 ou +2 points
- Le joueur à 900 perd très peu
- Battre plus faible, ça ne rapporte presque rien

**1400 contre 900 - grosse surprise**
- Le joueur à 900 gagne presque +60 points
- Le joueur à 1400 en perd autant
- Le système récompense les grosses performances

## Pourquoi c'est intéressant

- Personne n'est éliminé avant la fin
- Les duels restent motivants à tout moment
- Défier plus fort devient un vrai objectif
- Le score Elo peut être conservé dans la salle
  - tu reviens → tu repars avec ton score
  - tu vois ta progression au fil des sessions

## Règles & esprit du jeu

Pour que ça fonctionne, on s'appuie sur :

- le flow du Game of Stick
- la charte de duel :
  - respect
  - sécurité
  - fair-play
  - engagement et style avant tout

Parce qu'au final, le but n'est pas juste de gagner des points, mais de jouer plus, progresser plus, et tirer tout le monde vers le haut.
