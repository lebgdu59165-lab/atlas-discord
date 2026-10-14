# Les 70 commandes du bot

Toutes les commandes ci-dessous possèdent un gestionnaire. Utilisez `/help` pour la liste complète et `/help commande:nom` pour les paramètres. Le préfixe texte est configurable dans les paramètres du serveur (par défaut `!`).

Les durées de `/mute`, `/giveaway` et `/remind` sont en **minutes**. `/unban user_id` attend l’identifiant Discord comme texte, sans arrondi. Les commandes d’administration vérifient les permissions et la hiérarchie Discord. Les pièces sont une monnaie fictive.

| Commande | Catégorie | Fonction |
|---|---|---|
| /help | Informations | Affiche l'aide du bot |
| /ping | Informations | Latence du bot |
| /uptime | Informations | Temps de fonctionnement du bot |
| /stats | Informations | Statistiques du bot |
| /userinfo | Informations | Infos sur un utilisateur |
| /serverinfo | Informations | Infos sur le serveur |
| /avatar | Informations | Affiche l'avatar d'un utilisateur |
| /poll | Communauté | Crée un sondage |
| /ban | Modération | Bannir un membre |
| /unban | Modération | Débannir un utilisateur |
| /kick | Modération | Expulser un membre |
| /mute | Modération | Mettre en sourdine un membre (timeout) |
| /unmute | Modération | Retirer le mute d'un membre |
| /warn | Modération | Avertir un membre |
| /warns | Modération | Voir les avertissements d'un membre |
| /clearwarns | Modération | Supprimer les warns d'un membre |
| /clear | Modération | Supprimer des messages |
| /slowmode | Modération | Définir le slowmode d'un salon |
| /lock | Modération | Verrouiller un salon |
| /unlock | Modération | Déverrouiller un salon |
| /nick | Modération | Changer le pseudo d'un membre |
| /rank | Niveaux | Affiche ton niveau et XP |
| /leaderboard | Niveaux | Top 10 des membres |
| /givexp | Niveaux | Donner de l'XP à un membre (admin) |
| /resetxp | Niveaux | Remettre l'XP d'un membre à 0 (admin) |
| /join | Musique | Rejoindre ton salon vocal |
| /play | Musique | Jouer une musique (YouTube, recherche ou fichier audio Discord) |
| /pause | Musique | Mettre en pause |
| /resume | Musique | Reprendre la lecture |
| /skip | Musique | Passer à la musique suivante |
| /stop | Musique | Arrêter la musique et vider la file |
| /queue | Musique | Voir la file d'attente |
| /volume | Musique | Régler le volume (0-100) |
| /loop | Musique | Activer/désactiver la répétition |
| /nowplaying | Musique | Voir la musique en cours |
| /remove | Musique | Retirer un morceau de la file |
| /shuffle | Musique | Mélanger la file d'attente |
| /8ball | Divertissement | Pose une question à la boule magique |
| /coinflip | Divertissement | Pile ou face ! |
| /roll | Divertissement | Lancer un dé |
| /joke | Divertissement | Une blague aléatoire |
| /meme | Divertissement | Un mème aléatoire |
| /ship | Divertissement | Compatibilité amoureuse |
| /giveaway | Communauté | Lancer un giveaway |
| /balance | Économie | Voir ton solde |
| /daily | Économie | Collecter ta récompense quotidienne |
| /work | Économie | Travailler pour gagner des pièces |
| /pay | Économie | Envoyer des pièces à quelqu'un |
| /deposit | Économie | Déposer des pièces à la banque |
| /withdraw | Économie | Retirer des pièces de la banque |
| /gamble | Économie | Parier des pièces |
| /richesse | Économie | Top 10 des membres les plus riches |
| /shop | Économie | Voir la boutique |
| /prefix | Configuration | Changer le préfixe du bot |
| /setlog | Configuration | Définir le salon de logs |
| /setwelcome | Configuration | Configurer le message de bienvenue |
| /autorole | Configuration | Rôle attribué automatiquement aux nouveaux membres |
| /setxp | Configuration | Activer/désactiver le système XP |
| /config | Configuration | Voir la configuration du serveur |
| /role | Rôles | Ajouter/retirer un rôle à un membre |
| /createrole | Rôles | Créer un nouveau rôle |
| /deleterole | Rôles | Supprimer un rôle |
| /announce | Communauté | Faire une annonce dans un salon |
| /embed | Communauté | Créer un embed personnalisé |
| /remind | Communauté | Se fixer un rappel |
| /meteo | Outils | Météo d'une ville (wttr.in) |
| /calc | Outils | Calculatrice simple |
| /color | Outils | Afficher une couleur hexadécimale |
| /encode | Outils | Encoder du texte en base64 |
| /decode | Outils | Décoder du base64 |

## Réglages et limites

- Le tableau de bord permet de désactiver des commandes intégrées, de régler le préfixe, l’économie, les niveaux, le volume initial et la taille de file musicale.
- Musique : rejoignez un salon vocal standard, puis `/play recherche:titre ou lien YouTube`. Le flux est lu avec une version verrouillée de yt-dlp, vérifiée par SHA-256 depuis sa distribution officielle, sans cookies ni configuration personnelle. Vous pouvez aussi envoyer un fichier audio sur Discord, copier son lien et le donner à `/play`. Seuls les liens HTTPS des pièces jointes audio Discord sont acceptés pour cette seconde source. Un lien expiré doit être recopié. Le bot doit pouvoir se connecter et parler ; seuls les membres de ce salon contrôlent le lecteur. La file se vide au redémarrage. Les vidéos privées, supprimées ou restreintes par YouTube peuvent rester inaccessibles.
- `/poll` crée un sondage Oui/Non avec boutons. `/giveaway` publie un bouton Participer, déduplique les inscriptions et utilise un tirage cryptographique. Les votes et participations sont conservés dans PostgreSQL.
- `/remind` conserve la programmation dans PostgreSQL et envoie un message privé ; l’envoi échoue si les messages privés sont fermés. Le contenu est masqué aux autres membres dans le suivi des tâches.
- `/shop` affiche les articles existants et leur page d’achat ; une boutique vide est signalée comme telle.
- La météo est lue chez wttr.in ; aucun résultat météo n’est inventé lorsque le service ne répond pas.

## Validation

Inventaire exact des 70 noms et 70 gestionnaires distincts, tests de permissions, validation des entrées, file musicale et opérations PostgreSQL concurrentes. Les actions destructrices de modération n’ont pas été exécutées sur des membres ou salons réels pour la recette. Le contrôle audio décode un WAV généré avec FFmpeg et l’encode en Opus, puis lit une vidéo YouTube de plus de dix minutes dans le véritable lecteur pendant au moins une minute, sans rejoindre de salon. Une écoute réelle reste une vérification distincte.
