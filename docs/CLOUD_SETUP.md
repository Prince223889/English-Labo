> **Version 2 :** suis d'abord `LISEZ-MOI-DABORD.md` (à la racine du ZIP). Le générateur de codes est maintenant la page `admin.html`, et les PDF sont dans le stockage privé Supabase.

# Activer les codes individuels et le compteur de classe (Supabase)

Ce guide active les fonctions qui ne peuvent pas être sécurisées par un simple site statique. Le mode local reste gratuit et fonctionne hors ligne; le mode cloud est facultatif.

## 1. Créer le projet

1. Crée un projet sur https://supabase.com/ et note l'URL du projet.
2. Dans **Authentication → Sign In / Providers**, active **Anonymous Sign-Ins**. L'app utilise une session anonyme persistante puis la lie au code individuel.
3. Dans **Project Settings → API**, copie l'URL et la **clé publishable/anon**. Ne copie jamais la clé `service_role` dans le navigateur.
4. Ouvre **SQL Editor**, colle le contenu entier de `supabase/schema.sql`, puis exécute-le.

## 2. Générer les codes privés

1. Ouvre localement `tools-generate-codes.html` via le serveur local (ou ouvre ce fichier séparément dans un navigateur moderne).
2. Choisis le nombre d'élèves et clique **Générer des codes sécurisés**.
3. Télécharge la liste privée et garde-la hors du dépôt GitHub. Distribue un code différent à un seul élève.
4. Copie le SQL affiché dans **Supabase → SQL Editor** et exécute-le. La table ne conserve que des empreintes SHA-256, pas le code en clair.
5. Si un code a fuité, désactive-le avec la commande commentée à la fin de `supabase/schema.sql` en remplaçant le texte d'exemple par le vrai code (à exécuter dans l'éditeur privé).

**Le code individuel est un secret de connexion** : ne le mets ni dans une capture d'écran publique, ni dans une issue GitHub, ni dans un fichier commité. Toute personne qui possède le code peut ouvrir le profil concerné; si tu penses qu'il a fuité, révoque-le et crée un nouveau code/profil.

## 3. Configurer le site

Ouvre `js/config.js`, puis renseigne ces valeurs :

```js
window.EA_CONFIG = {
  appName: 'English Arena',
  className: 'Terminale · English Lab',
  mode: 'supabase',
  supabaseUrl: 'https://TON-PROJET.supabase.co',
  supabaseAnonKey: 'TA-CLE-PUBLISHABLE-OU-ANON'
};
```

L'URL et la clé publique sont conçues pour être utilisées dans le navigateur; les règles SQL limitent l'accès aux données. Ne mets pas la clé `service_role` ici. Les données de progression sont synchronisées par des fonctions SQL; les tables ne sont pas directement lisibles/écrivable par les clients.

## 4. Test à effectuer avant d'inviter la classe

- Crée un code de test, exécute le SQL et connecte-toi en mode cloud sur `http://localhost:8000` ou ton URL HTTPS.
- Essaie un code inexistant : il doit être rejeté.
- Réalise un quiz, ferme puis rouvre l'app; les progrès doivent être conservés.
- Ouvre le même code sur un deuxième appareil : le profil doit être repris, et la session de l'ancien appareil peut perdre l'accès cloud au profil. Les codes individuels sont personnels; ne les partage pas entre plusieurs élèves.
- Ouvre Profil : le compteur affiche les profils cloud actifs, et non les profils du seul navigateur.
- Après le test, révoque le code de test ou réserve-le à l'administrateur.

## Limites et sécurité

- Cette première mise en place utilise des sessions anonymes associées à un code secret long. Elle n'est pas équivalente à une identité avec récupération par e-mail, et elle ne protège pas contre le partage volontaire d'un code.
- Les fonctions SQL vérifient les codes et limitent l'accès aux progrès du profil associé à la session; garde le code confidentiel.
- Pour des besoins institutionnels, ajoute un rôle administrateur géré côté serveur, une procédure de révocation automatisée et une politique de confidentialité avant une diffusion plus large.
- Le site fonctionne en local sans Supabase. Lorsque le mode cloud est activé, la connexion est utilisée pour l'authentification et les synchronisations groupées; les leçons/quiz restent locaux.

## Mise à jour : duels protégés + tournois complets (à faire une seule fois)

Le fichier `supabase/schema.sql` a été **complété** (ajouts uniquement : aucun élève, code, progression ni message existant n'est touché). Pour activer les nouveautés :

1. Ouvre **SQL Editor** dans Supabase, colle de nouveau tout `supabase/schema.sql` et exécute-le (il est conçu pour pouvoir être relancé sans risque).
2. C'est tout. Les duels de classe utilisent désormais des fonctions serveur (`create_duel`, `submit_duel_answer`, `duel_state`…) : le **chrono et les points sont calculés par la base**, la bonne réponse n'est révélée à un joueur qu'après sa réponse (ou la fin du temps), et les tables de duel sont fermées aux navigateurs.
3. Les tournois (`create_tournament`) génèrent **toutes les manches** (toutes rondes ou élimination directe avec exempts) ; l'organisateur saisit les scores (`report_match`) et le tableau se remplit tout seul.

Test automatique de ces fonctions sur une base PostgreSQL jetable : `bash supabase/tests/run.sh` (nécessite PostgreSQL 16 en local).

Limite à connaître : l'élève qui **crée** le duel choisit les questions (il connaît donc les réponses de ce duel, comme un professeur). Les autres joueurs ne peuvent ni voir les réponses ni modifier leur score.
