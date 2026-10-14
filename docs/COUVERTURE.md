# Couverture fonctionnelle — version 0.1

**Cette livraison est une base de plateforme, pas une réalisation complète des 28 sections du cahier des charges.** Les états « implémenté » portent sur le périmètre ci-dessous, et ne prouvent pas une validation Discord en production. Le code ne simule aucun succès externe. Toutes les dépendances réelles doivent être configurées et la recette doit être exécutée.

## Catalogue

### Vue générale — implémenté

Compteurs synchronisés depuis Discord, agrégats collectés et audit récent filtré par permission.

Page : `/dashboard/:guildId/overview` (accès contrôlé).

### Statistiques — partiel

Graphique messages/arrivées avec fenêtres 7/30/90 jours et mesures quotidiennes conservées.

Reste à réaliser / limites : Les invitations utilisées et les présences détaillées ne sont pas encore collectées.

Page : `/dashboard/:guildId/statistics` (accès contrôlé).

### Modération — implémenté

Ban/unban, kick, tempban expirant, timeout/retrait, warn/retrait et motifs. DM et rôle modérateur configurables.

Page : `/dashboard/:guildId/moderation` (accès contrôlé).

### Automod — partiel

Spam/flood, URLs, invitations, mentions, majuscules, emojis et dictionnaire. Action commune et exemptions.

Reste à réaliser / limites : Filtrage local du bot. Aucun classificateur sémantique de contenu.

Page : `/dashboard/:guildId/automod` (accès contrôlé).

### Antiraid — partiel

Âge du compte, seuil d’arrivées en dix secondes et action configurable.

Reste à réaliser / limites : La protection anti-suppression de salons/rôles et anti-webhooks reste à implémenter.

Page : `/dashboard/:guildId/antiraid` (accès contrôlé).

### Tickets — partiel

Panneaux multiples, salons privés, limite par membre, claim, participants, priorité, fermeture/réouverture, HTML et première réponse staff. Option de suppression du salon à la fermeture : la transcription est sauvegardée avant la suppression et reste téléchargeable dans le tableau de bord. Un salon supprimé ne peut pas être rouvert. En cas de refus Discord, la fermeture peut être relancée pour réessayer la suppression.

Reste à réaliser / limites : Questions préalables, transferts et fermeture pour inactivité non implémentés. Le contenu des messages reste soumis au réglage de confidentialité « conserver le contenu ».

Page : `/dashboard/:guildId/tickets` (accès contrôlé).

### Membres — implémenté

Recherche Discord avec 100 résultats maximum par requête, affichage et gestion des rôles.

Page : `/dashboard/:guildId/members` (accès contrôlé).

### Rôles — implémenté

Liste hiérarchisée, création avec permissions vides, nom/couleur, suppression et vérification des rangs.

Page : `/dashboard/:guildId/roles` (accès contrôlé).

### Bienvenue — partiel

Messages d’arrivée/départ, variables et embed d’arrivée coloré ; DM facultatif.

Reste à réaliser / limites : Les cartes images générées ne sont pas implémentées.

Page : `/dashboard/:guildId/welcome` (accès contrôlé).

### Autorôles — partiel

Rôles à l’arrivée et bouton d’acceptation du règlement donnant le rôle vérifié.

Reste à réaliser / limites : Menus de rôles, rôles temporaires et conditions avancées non implémentés.

Page : `/dashboard/:guildId/autoroles` (accès contrôlé).

### Niveaux — partiel

XP texte avec cooldown, récompenses de rôle par niveau, classement, ajustement et reset.

Reste à réaliser / limites : XP vocal, multiplicateurs et cartes graphiques non implémentés.

Page : `/dashboard/:guildId/levels` (accès contrôlé).

### Économie — implémenté

Portefeuille, banque, daily/weekly/work, transfert, transactions, plafond et ajustement staff transactionnels.

Page : `/dashboard/:guildId/economy` (accès contrôlé).

### Boutique — partiel

Articles persistants, achat, inventaire, attribution de rôle et remboursement sur refus Discord.

Reste à réaliser / limites : Les objets sont enregistrés dans l’inventaire. Les achats de rôles passent par une tâche Discord pouvant échouer ; remboursement automatique en cas de refus Discord.

Page : `/dashboard/:guildId/shop` (accès contrôlé).

### Recrutements — partiel

Campagnes, questions longues obligatoires, âge de compte, candidatures web, décision et rôles d’acceptation.

Reste à réaliser / limites : Les questionnaires proposent des réponses longues. Choix multiples, notes staff et dépôt Discord non implémentés.

Page : `/dashboard/:guildId/recruitment` (accès contrôlé).

### Événements — partiel

Date de début, inscriptions, capacité, liste d’attente et annonce au démarrage dans le salon configuré.

Reste à réaliser / limites : Annonces programmées disponibles via les embeds. Les rappels d’événement automatiques restent à implémenter.

Page : `/dashboard/:guildId/events` (accès contrôlé).

### Giveaways — partiel

Participations Discord par bouton et web, expiration automatique, tirage cryptographique sans doublon et publication programmée des résultats.

Reste à réaliser / limites : Participations Discord et web disponibles. Conditions avancées par rôle non implémentées.

Page : `/dashboard/:guildId/giveaways` (accès contrôlé).

### Sondages — partiel

Sondages Discord Oui/Non et choix web, une voix par membre modifiable, fermeture manuelle/programmée et comptage des votes.

Reste à réaliser / limites : Publication et vote Discord disponibles. Les votes sont identifiés côté serveur ; anonymat public non implémenté.

Page : `/dashboard/:guildId/polls` (accès contrôlé).

### Suggestions — implémenté

Proposition web par les membres, votes, réponse staff et statuts de décision.

Page : `/dashboard/:guildId/suggestions` (accès contrôlé).

### Embed Builder — partiel

Composition des champs Discord, preview texte, duplication, envoi immédiat ou programmé.

Reste à réaliser / limites : Titre, texte, image, miniature, auteur, footer et champs sont pris en charge. Menus et édition de messages existants non implémentés.

Page : `/dashboard/:guildId/embeds` (accès contrôlé).

### Commandes — partiel

Les 70 commandes existantes disposent d’un gestionnaire : informations, modération, niveaux, économie virtuelle, rôles, configuration, musique, sondages, giveaways, rappels et outils. Elles fonctionnent en slash et avec le préfixe texte configurable. La liste complète et les paramètres sont documentés dans [COMMANDES.md](COMMANDES.md). Les désactivations explicites se règlent dans le tableau de bord.

Reste à réaliser / limites : les commandes personnalisées restent des réponses texte avec rôles et cooldown ; les paramètres typés et suites d’actions personnalisées ne sont pas implémentés. Les paramètres des 70 commandes intégrées sont typés et validés.

Page : `/dashboard/:guildId/commands` (accès contrôlé).

### Automatisations — partiel

Triggers définis, seuil et action parmi rôle/message/timeout/récompense ; journal d’exécution.

Reste à réaliser / limites : Déclencheurs join, level, warning, ticketClosed et recruitmentAccepted ; une condition numérique et une action autorisée. Pas de scripts arbitraires.

Page : `/dashboard/:guildId/automations` (accès contrôlé).

### Logs — partiel

Audit des écritures, événements sélectionnés, opt-in contenu, canal de logs et conservation.

Reste à réaliser / limites : La conservation du contenu des messages est désactivée par défaut. Changements de pseudo et attribution des invitations non collectés.

Page : `/dashboard/:guildId/logs` (accès contrôlé).

### Staff — partiel

Fiches de staff, délégations, prise/fin de service personnelles et durée calculée.

Reste à réaliser / limites : Évaluations et sanctions internes non implémentées. Permissions et prises de service réelles.

Page : `/dashboard/:guildId/staff` (accès contrôlé).

### FiveM / RP — partiel

Endpoint JSON public avec actualisation, adresse de connexion et documents RP typés en base.

Reste à réaliser / limites : Endpoint public de statut et suivis RP web disponibles. Pas de ressource FiveM ni de webhook de jeux fourni.

Page : `/dashboard/:guildId/fivem` (accès contrôlé).

### Musique — partiel

Connexion vocale Discord avec DAVE, recherche/lecture YouTube, file, pause/reprise, morceau suivant, arrêt, volume, répétition, retrait et mélange. Le tableau de bord reflète le lecteur et permet de le contrôler depuis le même salon vocal. L’audio passe par FFmpeg et Opus ; les signatures YouTube sont interprétées dans QuickJS isolé sans accès aux secrets du bot.

Limites : disponibilité et restrictions YouTube, permissions Connecter/Parler et charge de l’hébergement. La file est en mémoire et se vide au redémarrage. Le test de décodage audio ne remplace pas une écoute dans un salon vocal réel.

Page : `/dashboard/:guildId/music`.

### Assistant IA — partiel

Appel fournisseur compatible OpenAI, base textuelle, consentement et quota quotidien Redis.

Reste à réaliser / limites : Appels à un fournisseur compatible OpenAI, quota de requêtes et consentement disponibles. Résumés de tickets et mesure des coûts monétaires non implémentés.

Page : `/dashboard/:guildId/ai` (accès contrôlé).

### Intégrations — partiel

Annonces Twitch par le bot : chaîne, salon et message configurables, détection toutes les minutes via l’API officielle, dédoublonnage persistant par live et serveur, état du contrôle et dernière annonce. Les clés Twitch restent privées sur le bot.

Reste à réaliser / limites : RSS, YouTube et webhooks authentifiés non implémentés. Un live très bref peut être manqué entre deux contrôles. Première notification d’un live réel encore à vérifier.

Page : `/dashboard/:guildId/integrations` (accès contrôlé).

### Paramètres du serveur — implémenté

Nom affiché du serveur, couleur d’accent et thème. Français uniquement.

Page : `/dashboard/:guildId/settings` (accès contrôlé).

### Sécurité — implémenté

Délégations nominatives bornées au serveur, révocation, session et permissions Discord actuelles.

Page : `/dashboard/:guildId/security` (accès contrôlé).

### Gestion des données — implémenté

Export JSON tenant sans secrets et suppression des données applicatives avec confirmation.

Page : `/dashboard/:guildId/data` (accès contrôlé).

### Administration globale — partiel

Serveurs installés, heartbeat, erreurs de tâches et mode maintenance réservés au propriétaire.

Reste à réaliser / limites : Maintenance et erreurs de tâches disponibles. Déploiement automatique et gestion des administrateurs globaux non implémentés.

Page : `/dashboard/:guildId/global` (également `/admin` ; propriétaire requis).

## Fichiers et procédures de test

Les pages sont générées par la route Next.js `src/app/dashboard/[guildId]/[module]/page.tsx` avec des formulaires distincts définis dans `src/shared/catalog.ts`. Le catalogue contient les validations, valeurs par défaut et limitations affichées. Les handlers sont centralisés dans `src/app/api/[...path]/route.ts`, les services persistants dans `src/services/store.ts` et `src/services/community.ts`, les actions Discord dans `src/bot/actions.ts` et les événements dans `src/bot/index.ts`. Le rendu et les interactions se trouvent dans `src/components/dashboard.tsx` et `src/components/community.tsx`.

Les tests et la procédure de recette de **chaque module** figurent dans [TESTS.md](TESTS.md). Le schéma est dans `prisma/schema.prisma` et sa migration initiale dans `prisma/migrations/202610120001_initial/migration.sql`.

## Autres écarts au cahier des charges

- Automod utilise une action commune aux filtres activés ; le paramétrage d’actions indépendantes par filtre reste à développer. L’antiraid ne reconstruit aucun salon/rôle supprimé.
- Tickets : pas de menus, formulaires modaux préalables, transfert de catégorie/staff, SLA/rating, archivage Discord automatisé ou règle de clôture automatique. La transcription est plafonnée à 5 000 messages, et ne télécharge pas les pièces jointes.
- Rôles : pas de menus de rôles de réaction ni de rôles temporaires. Niveaux : pas d’XP vocal, cartes ou multiplicateurs.
- Recrutements : pas de questionnaire graphique à choix multiples, candidature slash ou système complet de notes internes.
- Événements : pas de calendrier visuel ou rappels configurables. Giveaways : pas de conditions de rôle, reroll ni de vote/participation Discord. Sondages : pas d’anonymat public configurable.
- Embed Builder : pas de menus, boutons génériques configurables ou édition des anciens messages. La preview ne reproduit pas exactement le Markdown ni tous les médias Discord.
- Commandes : pas de paramètres typés ou actions en chaîne. Automatisations : une condition numérique et une action par règle ; pas d’éditeur graphique de graphe complet.
- FiveM : le suivi RP sauvegarde des documents typés, sans automatiser les entreprises, factions, grades ou promotions dans le jeu. Pas de ressource Lua, API authentifiée dédiée ou collecte des logs RP du serveur.
- Staff : pas d’évaluations, sanctions internes, présence vocale ou rapports statistiques complets.
- IA : pas de résumé automatique de ticket, suivi du coût monétaire ou index documentaire. Le modèle et le fournisseur doivent être configurés.
- RSS, notifications de publications YouTube et webhooks externes non implémentés. La musique YouTube et les annonces Twitch sont disponibles avec leurs limites respectives.
- Global : pas de gestion d’administrateurs système secondaires, déploiement web des mises à jour, quotas globaux ou gestion multilingue.
- Interface : navigation et recherche de modules, thème et responsive implémentés ; la sidebar devient un tiroir mobile, sans mode réduit à icônes sur desktop.
- Journal : connexions OAuth2 non associées à chaque serveur, attribution des invitations et logs exhaustifs de pseudos non collectés.
- Suppression : aucune API de suppression individuelle de toutes les données d’un utilisateur dans tous les serveurs. Les sessions/token sont conservés jusqu’à expiration ou révocation de session.
- Exploitation : absence de preuve de déploiement cloud, tests de charge, reprise de sinistre automatisée ou audit indépendant.

## Suite de développement

La méthode demandée est suivie pour l’architecture et les premiers modules. Les prochaines étapes indispensables sont la recette Discord réelle, les tickets avancés et formulaires, l’XP vocal et rôles interactifs, les parcours communautaires Discord, l’intégration FiveM authentifiée, la musique autorisée, les connecteurs officiels et l’administration complète. Chacune doit disposer d’un code, de tests et d’une confirmation externe observée avant d’être annoncée terminée.
