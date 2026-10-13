# Rapport de vérification — 12 octobre 2026

| Contrôle | Résultat |
|---|---|
| Génération du client Prisma | Réussie. |
| Migration initiale | Appliquée sur un PostgreSQL réel de test isolé. |
| Vérification TypeScript | Réussie. |
| Tests unitaires | 16 / 16 réussis, dont 5 contrôles du déploiement. |
| Tests d’intégration PostgreSQL | 14 / 14 réussis. |
| Compilation de production Next.js | Réussie. |
| Audit des dépendances de production | Aucune vulnérabilité signalée à la date du contrôle. |
| UI desktop | Accueil et catalogue vérifiés dans le navigateur. |
| UI mobile | Largeur 390 px, absence de débordement horizontal et ouverture/fermeture de la navigation vérifiées. |
| Thèmes | Clair et sombre vérifiés ; contraste de la zone d’accueil corrigé. |
| Discord et Gateway réels | Token accepté et application correspondante vérifiée ; bot Wispbyte connecté à un serveur Discord réel. Intents membres/contenu acceptés. Test local arrêté. |
| OAuth2 utilisateur réel | Secret client accepté par Discord ; jeton temporaire de test révoqué. Redirection déclarée renseignée par l’utilisateur ; parcours navigateur avec consentement encore à vérifier. |
| Redis réel | Upstash Free créé : TLS, authentification, script de limitation et pub/sub vérifiés. |
| PostgreSQL Aiven Free | Running, vingt connexions maximum ; authentification, TLS avec validation CA et migration initiale vérifiés. |
| Dépôt GitHub | Code public avec autorisation après contrôle des secrets ; déploiement Render via Blueprint réussi. |
| Site public Render | Instance Free, déploiement Live ; accueil et /api/health répondent HTTP 200 sur https://atlas-dashboard-vf3d.onrender.com. Contrôle de production réussi : database, redis, oauth et bot disponibles. OAuth désigne la configuration, pas une session utilisateur validée. |
| Socket.IO avec navigateur authentifié réel | Non testé : session OAuth2 utilisateur encore à vérifier. |
| Bot compilé séparément | Compilation réussie ; paquet sans secrets avec lanceur Wispbyte Node.js 24. Installation des dépendances et génération Prisma exécutées sur l’hébergement. |
| Mémoire du bot | Environ 82 Mio sur Wispbyte avec un serveur Discord rejoint ; environ 317 Mio de stockage. Mesure ponctuelle, charge et endurance non validées. |
| Hébergement du bot Wispbyte | Serveur Atlas Discord 3fad2480, Free : 512 Mio de mémoire, 1 Gio de disque, 35 % d’un vCPU. Node.js 24.21.0 ; Gateway et heartbeat publics confirmés. Reconnexion au compte nécessaire toutes les deux semaines. |
| Redémarrage Wispbyte | Réussi avec le lanceur final : installation verrouillée, génération Prisma, retour Gateway à un serveur et contrôle public des quatre services réussi. Environ 83 Mio de mémoire après reprise. Les branches de répétition et de réutilisation des dépendances n’ont pas été provoquées séparément. |
| Hébergement du bot Discloud | Création refusée par le fournisseur : NO_CLUSTER, capacité Free saturée. Aucune application bot créée. |
| Docker Compose | Non exécuté : Docker absent de l’environnement de réalisation. |
| Configuration de déploiement | Validation cloud et token Discord réussis ; secrets Render et Wispbyte configurés avec autorisation. APP_URL public et NODE_ENV=production renseignés localement. |
| Déploiement Oracle | Script de lancement et guide préparés ; aucun compte ni serveur cloud créé. |
| Cahier des charges à 100 % | Non satisfait : périmètre et fonctions manquantes dans docs/COUVERTURE.md. |

## Notifications Twitch — 13 octobre 2026

Compilation Next.js et du bot, vérification TypeScript, 24 tests unitaires et 19 tests PostgreSQL isolés réussis après ajout de Twitch et correction du démarrage. Le test de lancement exige un schéma correspondant et un moteur natif avant de réutiliser le client Prisma. Les cinq tests SQL supplémentaires vérifient la concurrence, la persistance du dédoublonnage, l’annulation après désactivation, le refus d’un salon d’un autre serveur et une livraison réussie sans seconde publication. La base locale de recette utilise explicitement UTF-8, afin de tester les messages contenant des emojis.

Authentification et validation du jeton Twitch réels réussies ; raskuoff est hors ligne lors du contrôle. Salon cible 1395698905378983939 confirmé textuel dans The Rasku Family. Les clés sont conservées hors du dépôt et leur transfert à Wispbyte a été autorisé. Site Render publié avec le suivi des annonces et l’indicateur de contrôle trop ancien. Bot Wispbyte reconnecté à Discord après correction du chemin du certificat Linux, réutilisation du client Prisma et publicité de démarrage exigée par le fournisseur. Le contrôle public confirme database, redis, oauth et bot disponibles. La surveillance distante est confirmée par plusieurs mises à jour de l’état Twitch, dont les contrôles du 13 octobre à 20 h 45 et 20 h 51 (Europe/Paris), configuré=true, chaîne hors ligne et aucune annonce simulée. Première annonce d’un live réel encore à vérifier.

Les 30 tests portent notamment sur l’isolation des données et droits entre serveurs, l’absence de bypass global, la session et CSRF, les sauvegardes conflictuelles, la concurrence sur les dépenses et inscriptions, et le refus d’effacer les données pendant une tâche en cours. Les contrôles refusent une mauvaise origine, un token associé à une autre application et un bot sans heartbeat. Les appels Discord sont contrôlés dans les tests d’autorisation ; cela ne remplace pas un véritable serveur Discord. Les 16 tests unitaires et les 14 tests PostgreSQL ont été relancés avec succès après préparation de l’hébergement sans carte.
