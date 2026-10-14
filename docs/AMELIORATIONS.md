# Présentation et utilisation d’Atlas

L’accueil public présente les fonctions disponibles et ouvre la connexion Discord. Le guide de démarrage accompagne le choix d’un serveur, l’invitation du bot et les premiers réglages.

Le tableau de bord utilise des textes plus lisibles, une navigation mobile, des thèmes clair/sombre et une recherche accessible avec Ctrl K. Les salons et les rôles sont proposés par leur nom. Les rôles attribuables respectent la hiérarchie du bot. Les dates se saisissent à l’heure locale.

Le module Commandes présente les 70 commandes intégrées, avec recherche, catégories et activation individuelle. Les modifications demandent un enregistrement ; les choix existants du serveur sont conservés. Les commandes personnalisées restent disponibles dans une section séparée.

Le lecteur musical affiche l’état du vocal, le morceau courant, la file, le volume et la répétition. Les contrôles sont désactivés lorsque leur action est indisponible. L’ajout de morceaux se fait avec `/play` dans Discord. Les restrictions YouTube et la perte de la file au redémarrage restent indiquées.

L’espace membres dispose de filtres et d’une recherche. Les réponses du bot, son aide et les erreurs utilisent une présentation cohérente. Les erreurs distinguent les droits Discord, les éléments supprimés et les indisponibilités de données.

Les actualisations protègent les formulaires et les réglages non enregistrés. Une connexion interrompue ne relance pas automatiquement une modification qui aurait déjà été appliquée. Les connexions à PostgreSQL sont limitées à quatre par service, avec conservation des paramètres de vérification TLS.

La couverture fonctionnelle détaillée reste dans `COUVERTURE.md`. Cette amélioration ne déclare pas terminées les fonctions encore partielles. Render Free peut démarrer lentement après une période sans visite ; Wispbyte Free demande une reconnexion au compte toutes les deux semaines.

Le panneau Wispbyte signale plusieurs arrêts pour dépassement CPU, y compris avec une moyenne indiquée de 15,02 %. Les règles de partage des ressources de l’hébergeur restent applicables. Le worker vérifie désormais les actions toutes les 2,5 secondes au lieu de chaque seconde et le décodage audio utilise un seul thread. La continuité 24 h/24 ne peut pas être garantie sur cet hébergement gratuit.

Validation : construction de production, 115 tests unitaires et 28 tests sur PostgreSQL isolé. Les parcours ont été contrôlés sur l’interface réelle avec des données de démonstration locales, sur écran de bureau et mobile. Les actions de modération réelles et les messages de test sur le serveur communautaire ne font pas partie de cette recette.
