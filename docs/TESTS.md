# Tests et recette

## Résultats de réalisation

Sur Node.js 24 sous Windows, le 12 octobre 2026 : compilation de production Next.js réussie, migration initiale appliquée à un PostgreSQL réel isolé, tests unitaires et d’intégration réussis. Le rapport final est dans `VERIFICATION.md`.

Les tests d’intégration utilisent une vraie base PostgreSQL et une frontière Discord contrôlée. Ils ne prouvent pas qu’un token réel, une hiérarchie réelle ou un intent donné fonctionnent sur votre serveur. Aucun test ne se connecte à un compte utilisateur Discord. Le serveur de réalisation ne disposait ni de Docker installé, ni d’identifiants Discord ; lancement Compose, parcours OAuth2 réel et événements Gateway restent à valider par la recette ci-dessous.

## Tests automatiques

```sh
npm ci
npm run db:generate
npm run check
npm test
npm run build
npm audit --omit=dev
```

Pour les tests d’intégration, utilisez **une base dédiée dont le nom contient `atlas_test`**, sans données de production. Par exemple, dans PostgreSQL local :

```sh
docker compose exec postgres createdb -U atlas atlas_test
```

Dans PowerShell, remplacez MOT_DE_PASSE par la valeur locale, sans imprimer ou partager celle de production :

```powershell
$env:DATABASE_URL='postgresql://atlas:MOT_DE_PASSE@localhost:5432/atlas_test?schema=public'
npm run db:migrate
npm run test:integration
```

Sur Linux, définissez la même variable d’environnement avant les commandes. Les tests effacent uniquement leurs deux serveurs réservés. Ils refusent une URL ne contenant pas `atlas_test`.

Invariants couverts : tokens chiffrés et authentifiés, cookies sécurisés, validation stricte des IDs et des configurations, actions sans scripts arbitraires, échappement de transcription, destinations privées interdites, absence de bypass global, permissions limitées à leur serveur, perte des droits après départ/révocation, blocage des modifications interserveurs, sauvegardes conflictuelles, transferts concurrents sans solde négatif, gains quotidiens uniques, achats transactionnels, places d’événement bornées et votes conservés lors des éditions.

Les tests de déploiement vérifient aussi qu’une origine HTTPS incorrecte, un token d’une autre application ou un bot déconnecté bloquent l’annonce de disponibilité, et que les erreurs de configuration n’affichent pas les secrets. Ils ne lancent pas Docker et ne créent aucun hébergement.

## Recette Discord, sur deux serveurs de test

Préparez A et B avec le bot installé, un propriétaire, un administrateur, un membre délégué et un membre ordinaire. Les sanctions modifient de vrais comptes de test et les publications créent de vrais messages.

| Module | Parcours à vérifier | Résultat attendu |
|---|---|---|
| OAuth2 | Connexion, refus de consentement, state modifié, déconnexion | Une session valide uniquement après OAuth2 ; callback erroné refusé. |
| Isolation | Propriétaire A sans accès B tente des URL/API B | Refus, aucune fuite de données B. |
| Délégation | Accorder seulement tickets puis révoquer | Tickets autorisés ; économie refusée ; accès retiré après révocation. |
| Configuration | Modifier A dans deux onglets ; sauvegarder une révision ancienne | Conflit explicite ; B inchangé ; audit enregistré. |
| Temps réel | Changer une règle dans A, laisser un second onglet ouvert | Nouvelle configuration affichée, nouvelle règle appliquée sans redémarrage. |
| Modération | Warn, retrait de warn, timeout, retrait, kick, ban/unban, tempban court | Action réelle, motif et dossier enregistrés, expiration tempban exécutée. |
| Hiérarchie | Viser propriétaire, rôle supérieur, rôle géré | Refus clair ; aucune action appliquée. |
| Automod | Liens, invitations, spam, mentions, mots, exemptions | Règle choisie appliquée ; exemption respectée ; pas de lecture de contenu si intent absent. |
| Antiraid | Arrivées contrôlées et compte de test récent | Notification ou sanction selon configuration, sans effet sur B. |
| Tickets | Publier panneau, ouvrir, limite simultanée, claim, participant, close/reopen | Salon privé, limite respectée, transcript téléchargée ; HTML malveillant rendu comme texte. |
| Bienvenue | Entrée/départ avec autorôles ; bouton règlement | Messages et rôles réels selon permissions. |
| Membres/rôles | Rechercher, créer/modifier/supprimer un rôle bas, ajouter/retirer | Changements Discord et tâche confirmée ; rang incompatible refusé. |
| Niveaux | Messages avant/après cooldown, récompense, ajustement et reset | XP réel, cooldown respecté, rôle attribué au seuil, reset limité à A. |
| Économie/boutique | Gains, banque, transferts, achat et échec rôle | Solde/inventaire persistants ; refus sans fonds ; remboursement si Discord refuse le rôle. |
| Recrutement | Candidature web, toutes réponses, refus/acceptation | Candidature visible au staff, décision persistante, rôles réels à l’acceptation. |
| Événements | Limite de places et inscription supplémentaire | Inscription ou liste d’attente en base. |
| Giveaways | Plusieurs participants, clôture, double tirage | Gagnants issus des inscrits, sans doublon ; deuxième tirage refusé. |
| Sondages/suggestions | Vote, changement de vote, clôture, réponse staff | Une voix courante par membre ; votes fermés refusés ; état et texte persistants. |
| Embeds | Prévisualisation, duplication, publication, date future | Message réel avec champs et médias ; tâche attend la date prévue. |
| Commandes | Synchroniser puis utiliser une slash ; rôle et cooldown | Réponse réelle, restrictions et journal d’usage. |
| Automatisations | Join → rôle ; trois warns → timeout | Action autorisée exécutée et historique ; aucun code arbitraire. |
| Staff | Début/fin de service, double début | Durée calculée, second service simultané refusé. |
| FiveM | URL publique JSON, URL interne, panne du serveur | Données réelles ou erreur ; IP interne refusée. |
| IA | Sans clé, sans consentement, avec fournisseur, quota épuisé | Indisponibilité explicite ; appel externe seulement avec consentement ; quota respecté. |
| Logs/données | Opt-in contenu, conservation courte, export, effacement | Politique appliquée ; export sans token ; suppression des données du serveur sélectionné. |
| Administration | Compte non propriétaire puis propriétaire | Non propriétaire refusé ; maintenance réelle sans bypass Discord. |
| Pannes | Arrêt bot, Redis, PostgreSQL ; interruption pendant une tâche | Indisponibilité ou tâche échouée visible ; aucun succès simulé. |

## Limites de validation

Les tests UI couvrent la page de configuration initiale, le catalogue et les thèmes, sur desktop et largeur mobile. Les pages authentifiées et leurs formulaires nécessitent la recette Discord. L’audit de dépendances réussi n’est pas un audit de sécurité indépendant de l’application. Les fonctions absentes recensées dans COUVERTURE.md ne doivent pas être incluses dans une démonstration comme si elles existaient.
