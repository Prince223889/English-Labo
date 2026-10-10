# English Arena — Terminale English Lab

**Une webapp installable, orientée pratique orale, conçue pour les élèves de Terminale et les connexions limitées.**

English Arena part du ZIP de cours transmis : le livre *English for Terminale — Cours intensif 56 jours* et les huit supports hebdomadaires sont conservés. Le site ajoute des cartes de vocabulaire, des quiz corrigés, des simulations conversationnelles sans IA obligatoire, un suivi local, des missions et des ressources externes gratuites.

## Ce que contient cette première version

- **56 leçons / 8 semaines** : objectifs, exemples, mots-clés, validation de progression et liens vers les PDF d'origine.
- **18 ateliers complémentaires originaux** : conversation naturelle, demande de clarification, narration, débat, oral de Terminale, graphes, STEM, sécurité en laboratoire, entretiens, courriels formels et résumés. Chaque atelier inclut phrases utiles, défi personnel et modèle à écouter.
- **Speaking Lab** : huit jeux de rôle (présentation, directions, boutique, entretien d'études, débat, environnement/mines, panne technique, oral d'examen), suggestions de phrases, réponses modèles, synthèse vocale et micro optionnel si le navigateur le permet.
- **Quiz** : questions de grammaire, vocabulaire, écriture et communication, corrigés et explications hors ligne.
- **Vocabulaire actif** : 40 cartes, traduction, exemple et liste des mots maîtrisés.
- **Gamification** : XP, missions du jour, progression, série de jours et badges.
- **PWA** : installable sur les navigateurs compatibles. L'interface, les cours intégrés et quiz sont utilisables sans réseau après la première visite.
- **Sauvegarde** : export/import JSON pour déplacer les progrès en mode local.
- **Cloud optionnel** : Supabase permet les codes individuels partagés entre appareils, la synchronisation et le compteur de classe. Voir `docs/CLOUD_SETUP.md`.
- **Générateur d'invitations** : `tools-generate-codes.html` prépare des codes privés et les lignes SQL pour Supabase. Ce fichier ne s'ajoute pas au site de classe si tu ne veux pas l'exposer.

## Important : local vs cloud

La configuration par défaut (`js/config.js`) est **`mode: 'local'`**. Dans ce mode, les profils et les progrès sont enregistrés dans le navigateur de l'appareil. Ce n'est pas une authentification de classe sécurisée, et le compteur ne mesure pas les élèves sur différents téléphones.

Pour des codes réellement vérifiés, un compteur commun et une synchronisation sur plusieurs appareils, configure Supabase comme décrit dans `docs/CLOUD_SETUP.md`. Le dépôt GitHub Pages est public : n'y publie jamais la liste des codes privés, les numéros de téléphone, les mots de passe ou une clé Supabase secrète/service-role. Attention : les codes cloud protègent le profil et les progrès, mais ne rendent pas privés les PDF et fichiers statiques hébergés sur GitHub Pages. Si les documents doivent rester confidentiels, ne les place pas dans le dépôt public; héberge-les dans un stockage privé avec des règles d’accès.

## Lancer en local sur Windows

1. Décompresse le ZIP dans un dossier comme `C:\Users\Prince\Desktop\EnglishArena`.
2. Ouvre PowerShell dans ce dossier.
3. Avec Python installé, lance :

   ```powershell
   py -m http.server 8000
   ```

4. Dans ton navigateur, ouvre `http://localhost:8000`.
5. Crée ton profil local et essaie les cours, Speaking Lab et les quiz.

> N'ouvre pas simplement `index.html` en double-cliquant si tu veux tester la PWA : le service worker nécessite `localhost` ou HTTPS.

## Déployer sur GitHub Pages

Le guide avec les étapes détaillées pour débuter est dans [`docs/GITHUB_DEPLOY.md`](docs/GITHUB_DEPLOY.md).

Le dépôt est préparé pour `Prince223889/english-arena` (si tu n'as pas encore créé ce dépôt, crée-le avec ce nom dans ton compte GitHub). Depuis le dossier du projet :

```powershell
git init
git add .
git commit -m "Build English Arena learning PWA"
git branch -M main
git remote add origin https://github.com/Prince223889/english-arena.git
git push -u origin main
```

Puis, dans GitHub : **Settings → Pages → Build and deployment → Source: GitHub Actions**. Le workflow `.github/workflows/pages.yml` publiera le site après le push et versionne le cache d’application pour éviter que les anciens fichiers restent servis indéfiniment. L'adresse attendue sera : `https://prince223889.github.io/english-arena/`.

GitHub Pages est un hébergeur de site statique. La page sera publiquement accessible sur le web même si le dépôt est privé sur certains forfaits. Il ne protège pas les cours par un code côté serveur; c'est pourquoi le mode cloud est indispensable si tu veux une vraie porte d'entrée individuelle.

## Données et consommation

- Aucun framework, aucune police web, aucun analytics, aucune publicité ni appel IA au démarrage.
- Les quiz et simulations guidées n'appellent pas de serveur.
- Les PDF ne sont pas tous préchargés; le service worker les met en cache lorsqu'un élève les ouvre.
- En mode cloud, une bibliothèque d'authentification est chargée à la demande, et les sauvegardes sont regroupées avant synchronisation.
- La synthèse vocale utilise la voix disponible sur l'appareil. La reconnaissance vocale est optionnelle et peut, selon le navigateur, envoyer la parole à un service distant. En cas de doute, répondre par écrit.
- Les rappels intégrés sont des rappels locaux de confort. Le navigateur ne garantit pas des notifications exactes quand il est fermé; un fichier calendrier (.ics) et des rappels SMS côté serveur sont des options distinctes.

## Ajouter un cours

Ajoute ton document dans `assets/courses/`, puis référence-le dans la vue Bibliothèque. Pour ajouter une leçon structurée, ajoute un élément dans `js/data.js` et vérifie les objectifs, exemples et réponses avec le professeur. N'attribue pas de note officielle à la prononciation : le feedback hors ligne se limite à des indices de vocabulaire et d'organisation.

## Sources complémentaires utilisées

Les leçons interactives du projet sont originales et basées sur le cours fourni. Pour les ressources supplémentaires, la bibliothèque renvoie vers les pages officielles de pratique :

- British Council — Speaking: https://learnenglish.britishcouncil.org/free-resources/speaking
- British Council — Grammar: https://learnenglish.britishcouncil.org/free-resources/grammar
- Cambridge English — Activities for learners: https://www.cambridgeenglish.org/learning-english/activities-for-learners/
- MDN — PWA offline and caching: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- GitHub Pages docs: https://docs.github.com/en/pages/getting-started-with-github-pages

## Licence et contribution

Le code original English Arena peut être placé sous MIT à ta convenance, mais vérifie les droits des documents de cours que tu distribues. La présence d'un PDF dans ton dossier ne garantit pas qu'il puisse être republié publiquement. Pour publier tout le dépôt, assure-toi que tu as le droit de redistribuer le PDF complet et ses extraits.

## Vérifier le projet

Avec Node.js installé, depuis le dossier du projet, lance :

```powershell
node tests/smoke.test.cjs
```

Ce test vérifie les 56 leçons, la présence de chaque PDF référencé, la structure des cartes de vocabulaire et des questions de quiz, les simulations orales, les 18 ateliers complémentaires et le manifeste PWA. Il ne remplace pas un test de connexion Supabase réel; celui-ci se fait seulement après la configuration du cloud.
