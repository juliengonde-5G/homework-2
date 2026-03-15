# Cahier des Charges – Application d'Aide aux Devoirs Autonome

**Version** : 1.0  
**Date** : Mars 2025  
**Statut** : Validé (v1.1 – orientation métier intégrée)

---

## 1. Contexte et objectifs

### 1.1 Contexte

Application d'aide aux devoirs autonome destinée aux enfants et adolescents, avec un parcours adulte complémentaire. L'application repose sur une phase de découverte pour profiler chaque jeune, puis propose des parcours de développement des compétences personnalisés.

### 1.2 Objectifs

- **Personnalisation** : Parcours adaptés au profil (centres d'intérêt, modalités d'apprentissage, personnalité PCM, orientation futur métier)
- **Autonomie** : L'enfant progresse avec un agent conversationnel et un contenu généré à la volée
- **Ouverture** : Socle commun + ouverture socio-culturelle en fonction de la personnalisation (géopolitique, arts, etc.)
- **Multi-famille** : Architecture multi-tenant dès la conception pour une évolution future

---

## 2. Périmètre fonctionnel (MVP complet)

### 2.1 Utilisateurs

| Rôle | Description |
|------|-------------|
| **Enfant/Jeune** | Utilisateur principal, parcours personnalisé, 45 min/jour recommandées |
| **Parent** | Compte séparé, dashboard, gestion des profils, suivi |
| **Admin** | Paramétrage global, analyse comportement, performance (peut être fusionné avec parent en MVP) |

### 2.2 Flux principaux

#### 2.2.1 Installation d'un nouveau jeune

1. **Phase de découverte** (15–30 min, sur plusieurs jours)
   - Format ludique, très imagé pour les plus jeunes
   - Contenus plus structurés (lecture, médias) pour les plus âgés
   - Détection : centres d'intérêt, modalités d'apprentissage (lecture, oral, image), profil PCM (questionnaire adapté à l'âge), orientation métier
   - Résultat visible : résumé du profil + explication + module « Mes conseils » (aides à l'apprentissage, méthode)

2. **Choix du parcours**
   - **Parcours 1 – Back to basics** : Français, Maths, Anglais uniquement
   - **Parcours 2 – Orienté moyenne** : « Je dois faire évoluer ma moyenne dans ces matières : [liste] » → Back to basics + renforcement des matières ciblées
   - **Parcours 3 – Projet** : Back to basics + projet lié aux passions (ex. géopolitique, robotique, arts)

3. **Création du parcours**
   - Génération à la volée du contenu (leçons, exercices)
   - Référentiel : socle commun Éducation nationale + ouverture socio-culturelle
   - Chrono 45 min/jour, répartition libre

#### 2.2.2 Session quotidienne (enfant)

1. **Page d'accueil**
   - Phrase d'encouragement / blague du jour / anniversaires et événements
   - Sélection du jeune (si plusieurs dans la famille)

2. **Programme du jour**
   - Programme personnalisé pour la journée
   - Questions d'accueil : « Comment ça va ? Comment s'est passée la journée ? »

3. **Navigation**
   - Scroll (pas d'onglets)
   - Timer toujours visible en haut (45 min, changement de couleur après 45 min)
   - Répartition libre des 45 min

4. **Contenu**
   - Leçons générées à la volée
   - Exercices de contrôle adaptés au référentiel et au mapping compétences
   - Moteur de lecture (TTS) adapté à la leçon, changement d'origine selon la langue (FR, EN, ES si renforcement)

5. **Agent conversationnel**
   - Aide pédagogique (indices, reformulations, pas de réponses directes)
   - Relais culturel et ouverture sur le monde
   - Ton adapté au profil PCM

6. **Gamification**
   - Badges, niveaux, streaks

#### 2.2.3 Parcours adulte

- Deux utilisateurs modèles (ex. Ophélie, Julien)
- Parcours distinct : formation pro, mot du jour, actualités sectorielles

#### 2.2.4 Admin / Parent

- **Accès** : Compte parent isolé (email + mot de passe)
- **Dashboard** : Temps passé, difficultés, progression
- **Actions** : Historique, modification profil, matières, objectifs, historique chat agent, analyse profil et comportement
- **Profil** : Modifiable, avec historisation des changements

### 2.3 Spécifications détaillées par module

#### Module Découverte

| Élément | Spécification |
|---------|---------------|
| Durée | 15–30 min total, réparties sur plusieurs jours |
| Format | Ludique, imagé (jeunes) → structuré (adolescents) |
| Contenu | Centres d'intérêt, modalités d'apprentissage, questionnaire PCM adapté à l'âge, orientation métier (référentiels type ONISEP) |
| Sortie | Profil stocké, résumé visible, module « Mes conseils » |

#### Module Parcours

| Parcours | Contenu |
|----------|---------|
| Back to basics | FR, Maths, EN uniquement |
| Orienté moyenne | Back to basics + matières ciblées (renforcement ou ajout) |
| Projet | Back to basics + projet lié aux passions |

#### Module Contenu

| Élément | Spécification |
|---------|---------------|
| Génération | À la volée par IA |
| Référentiel | Socle commun + ouverture socio-culturelle |
| Exercices | Générés par IA, mapping compétences |
| TTS | google-tts-api, FR/EN/ES selon parcours |

#### Module Chrono

| Élément | Spécification |
|---------|---------------|
| Durée | 45 min/jour recommandées |
| Comportement | Reco avec possibilité de continuer |
| Affichage | Timer en haut, changement de couleur après 45 min |
| Répartition | Libre |

#### Module UX

| Élément | Spécification |
|---------|---------------|
| Navigation | Scroll |
| Style | Gamification (badges, niveaux, streaks) |
| Couleurs | Charte unique, palette adaptée au profil |
| Avatar | Personnage récurrent (mascotte) |
| Responsive | PC, tablette, smartphone |
| Contexte | Usage à la maison (Wi-Fi) privilégié |

---

## 3. Architecture technique

### 3.1 Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (SPA)                                 │
│  React/Vue • Responsive • Scroll • Gamification • TTS intégré            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTPS / REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (API)                                  │
│  Node.js + Express/Fastify • Auth • Sessions • Multi-tenant             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │  PostgreSQL  │ │  Claude API   │ │ google-tts   │
            │  (Supabase/  │ │  (Anthropic) │ │ (TTS)        │
            │   Neon)      │ │              │ │              │
            └──────────────┘ └──────────────┘ └──────────────┘
```

### 3.2 Stack technique proposée

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| **Frontend** | React ou Vue 3 | Composants, responsive, écosystème |
| **Backend** | Node.js + Express ou Fastify | Léger, bon pour IA, déploiement simple |
| **Base de données** | PostgreSQL (Supabase ou Neon) | Multi-tenant, JSON, évolutif |
| **IA** | Claude API (Anthropic) | Génération contenu, chat, prompts |
| **TTS** | google-tts-api | Conservé, fonctionne bien |
| **Auth** | Sessions + bcrypt (parent), sélection enfant | Simplicité MVP |
| **Déploiement** | Render ou Railway | Gratuit/faible coût, PostgreSQL inclus |

### 3.3 Principe multi-tenant

- **Clé d'isolation** : `family_id` sur toutes les entités
- **Règles** : Toutes les requêtes filtrées par `family_id`
- **Phase 1** : Une famille (family_id = 1)
- **Phase 2** : Inscription famille, création de family_id

### 3.4 Schéma de déploiement (démarrage)

```
                    ┌─────────────────────────────────────┐
                    │         Render / Railway             │
                    │  ┌─────────────┐  ┌───────────────┐ │
                    │  │   Web       │  │   PostgreSQL  │ │
                    │  │   Service   │  │   (add-on)    │ │
                    │  └─────────────┘  └───────────────┘ │
                    └─────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              Claude API      google-tts      (futur: cache)
```

---

## 4. Modèle de données

### 4.1 Entités principales

```
families
├── id (PK)
├── name
├── created_at
└── (futur: subscription, etc.)

users
├── id (PK)
├── family_id (FK) ────────────────────────┐
├── name                                    │
├── avatar                                  │
├── age                                     │
├── role ('child' | 'parent')                │
├── email (parent uniquement)                │
├── password_hash (parent uniquement)        │
├── created_at                              │
└── ...                                     │
                                            │
profiles (profil jeune)                     │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── profile_type (PCM: promoteur, rebelle,   │
│                 imagineur, analyseur)     │
├── learning_modalities (JSON: lecture,     │
│                        oral, image, etc.) │
├── interests (JSON)                        │
├── career_orientation (JSON)               │
│   → aspirations métier, secteurs,         │
│     référentiels ONISEP                   │
├── is_dyslexic                             │
├── theme / palette                         │
├── daily_limit_minutes                     │
├── advice_tips (JSON)                      │
├── created_at                             │
└── updated_at                             │
                                            │
profile_history (historisation)             │
├── id (PK)                                 │
├── profile_id (FK)                         │
├── changed_by (user_id admin)              │
├── changes (JSON)                          │
├── created_at                             │
└── ...                                    │
                                            │
pathways (parcours)                        │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── type ('back_to_basics' | 'oriented' |   │
│         'project')                         │
├── target_subjects (JSON, pour oriented)   │
├── project_theme (pour project)            │
├── career_focus (JSON, optionnel)          │
│   → matières/projet liés au profil métier │
├── status                                  │
├── created_at                              │
└── ...                                    │
                                            │
competencies (référentiel)                  │
├── id (PK)                                 │
├── subject                                 │
├── skill_code (socle commun ou custom)     │
├── label                                   │
├── level (cycle 3, 4, etc.)                │
└── ...                                    │
                                            │
career_references (référentiel métiers)     │
├── id (PK)                                 │
├── sector (ex: santé, tech, arts...)       │
├── job_family (famille métier ONISEP)      │
├── label                                   │
└── ...                                    │
                                            │
discovery_sessions (phase découverte)       │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── step_number                             │
├── step_type                               │
├── responses (JSON)                        │
├── completed_at                           │
└── ...                                    │
                                            │
daily_programs (programme du jour)          │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── date                                    │
├── blocks (JSON: leçons, exercices)        │
├── status                                  │
├── created_at                              │
└── ...                                    │
                                            │
generated_content (cache leçons/exercices)  │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── subject                                 │
├── competency_id (FK)                      │
├── content_type ('lesson' | 'exercise')   │
├── content (JSON/TEXT)                     │
├── created_at                             │
└── ...                                    │
                                            │
sessions_log (usage)                        │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── started_at                             │
├── ended_at                               │
├── duration_minutes                        │
└── ...                                    │
                                            │
chat_history                                │
├── id (PK)                                 │
├── user_id (FK) ──────────────────────────┤
├── role ('user' | 'assistant')             │
├── content                                │
├── created_at                             │
└── ...                                    │
                                            │
user_progress, badges, user_badges,         │
user_stats, skill_assessment...             │
                                            │
daily_mood, daily_tips, events...          │
                                            │
└──────────────────────────────────────────┘
```

### 4.2 Tables détaillées (extrait)

#### families
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID/SERIAL | Clé primaire |
| name | VARCHAR | Nom de la famille |
| created_at | TIMESTAMP | Date de création |

#### users
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID/SERIAL | Clé primaire |
| family_id | FK | Famille |
| name | VARCHAR | Prénom |
| avatar | VARCHAR | Emoji ou URL |
| age | INT | Âge |
| role | ENUM | child, parent |
| email | VARCHAR | Parent uniquement |
| password_hash | VARCHAR | Parent uniquement |
| birthday | DATE | Anniversaire |
| created_at | TIMESTAMP | |

#### profiles
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID/SERIAL | Clé primaire |
| user_id | FK | Utilisateur |
| profile_type | VARCHAR | PCM (promoteur, rebelle, imagineur, analyseur) |
| learning_modalities | JSONB | {lecture: 1, oral: 1, image: 1, ...} |
| interests | JSONB | ["robotique", "géopolitique", ...] |
| career_orientation | JSONB | Aspirations métier, secteurs, référentiels ONISEP |
| is_dyslexic | BOOLEAN | |
| theme | VARCHAR | Palette graphique |
| daily_limit_minutes | INT | 45 par défaut |
| advice_tips | JSONB | Contenu "Mes conseils" |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

#### profile_history
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID/SERIAL | Clé primaire |
| profile_id | FK | Profil modifié |
| changed_by | FK | Admin/parent |
| changes | JSONB | Diff des modifications |
| reason | TEXT | Motif optionnel |
| created_at | TIMESTAMP | |

#### pathways
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID/SERIAL | Clé primaire |
| user_id | FK | Utilisateur |
| type | ENUM | back_to_basics, oriented, project |
| target_subjects | JSONB | Pour oriented |
| project_theme | VARCHAR | Pour project |
| career_focus | JSONB | Matières/projet liés au profil métier (optionnel) |
| status | VARCHAR | active, draft, completed |
| created_at | TIMESTAMP | |

#### career_references
| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID/SERIAL | Clé primaire |
| sector | VARCHAR | Secteur (santé, tech, arts, etc.) |
| job_family | VARCHAR | Famille métier (référentiel ONISEP) |
| label | VARCHAR | Libellé |

---

## 5. APIs principales

### 5.1 Authentification

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/auth/parent/login | Connexion parent (email, password) |
| POST | /api/auth/parent/logout | Déconnexion |
| GET | /api/auth/me | Utilisateur courant (parent ou enfant sélectionné) |

### 5.2 Famille et utilisateurs

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/family/users | Liste des jeunes de la famille |
| POST | /api/family/users | Créer un jeune (déclenche découverte) |
| GET | /api/family/users/:id | Détail d'un jeune |

### 5.3 Découverte

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/discovery/status/:userId | État de la découverte (étapes, complétée) |
| POST | /api/discovery/step | Soumettre une étape de découverte |
| GET | /api/discovery/result/:userId | Résultat du profil + conseils |

### 5.4 Parcours

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/pathways | Créer un parcours (après découverte) |
| GET | /api/pathways/:userId | Parcours actif du jeune |
| PUT | /api/pathways/:id | Modifier un parcours |

### 5.5 Programme du jour

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/program/today/:userId | Programme du jour (génère si absent) |
| POST | /api/program/complete-block | Marquer un bloc terminé |

### 5.6 Contenu

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/content/generate-lesson | Générer une leçon (IA) |
| POST | /api/content/generate-exercises | Générer des exercices (IA) |
| GET | /api/content/lesson/:id | Récupérer une leçon (cache ou génération) |

### 5.7 Chat

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/chat/message | Envoyer un message, recevoir réponse |
| GET | /api/chat/history/:userId | Historique du chat |

### 5.8 TTS

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | /api/tts/synthesize | Texte → audio (langue paramétrable) |

### 5.9 Admin / Parent

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/admin/dashboard | Stats (temps, difficultés, progression) |
| GET | /api/admin/profiles/:userId | Profil + historique |
| PUT | /api/admin/profiles/:userId | Modifier profil (historisation) |
| GET | /api/admin/chat-history/:userId | Historique chat agent |
| GET | /api/admin/analytics | Analyse comportement |

### 5.10 Événements et accueil

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | /api/home/feed/:userId | Phrase d'encouragement, blague, anniversaires |
| GET | /api/home/events | Événements du jour (famille) |

---

## 6. Parcours utilisateur détaillés

### 6.1 Premier accès (nouveau jeune)

```
1. Parent connecté → Créer un jeune
2. Nom, âge, avatar, date de naissance
3. Redirection vers Phase de découverte

Phase de découverte (plusieurs jours)

Jour 1 (≈10 min)
├── Étape 1 : Centres d'intérêt (images, choix multiples)
├── Étape 2 : Comment tu préfères apprendre ? (oral, lecture, image, etc.)
└── Fin de session

Jour 2 (≈10 min)
├── Étape 3 : Questionnaire PCM adapté (questions ludiques)
└── Fin de session

Jour 3 (≈10 min)
├── Étape 4 : Choix du parcours (Back to basics / Orienté moyenne / Projet)
├── Si Orienté : saisie des matières ciblées
├── Si Projet : saisie du thème/ passion
└── Génération du parcours

Jour 4 (≈10 min)
├── Étape 5 : Orientation métier (découverte des gammes de métiers selon les référentiels existants de type ONISEP))
├── Si Orienté : saisie des matières ciblées au profil métier ou aspiration
├── Si Projet : saisie du thème/ passion/ projet pro
└── Génération du parcours

4. Affichage du profil + "Mes conseils"
5. Redirection vers page d'accueil jeune
```

### 6.2 Session quotidienne (jeune)

```
1. Page d'accueil
   ├── Phrase d'encouragement
   ├── Blague du jour
   ├── Anniversaires / événements
   └── Sélection du jeune (si plusieurs)

2. Accueil du jour
   ├── Programme concocté pour lui
   ├── Questions : Comment ça va ? Comment s'est passée la journée ?
   └── Bouton "Commencer ma session"

3. Session (scroll)
   ├── Timer en haut (45 min, change de couleur après)
   ├── Blocs : Leçon → Exercices → Leçon → Exercices...
   ├── TTS sur les leçons (langue adaptée)
   ├── Chat agent disponible (aide pédagogique)
   └── Gamification (badges, streaks)

4. Fin de session
   └── Chrono change de couleur (simple)
```

### 6.3 Admin / Parent

```
1. Connexion (email + mot de passe)

2. Dashboard
   ├── Temps passé par jeune
   ├── Difficultés par matière
   ├── Progression

3. Actions
   ├── Modifier profil (historisation)
   ├── Gérer matières / objectifs
   ├── Consulter historique chat agent
   └── Analyse profil et comportement
```

---

## 7. Contraintes et critères de validation

### 7.1 Contraintes techniques

| Contrainte | Description |
|------------|-------------|
| Multi-tenant | Toutes les données isolées par family_id |
| Responsive | PC, tablette, smartphone |
| Performance | Génération IA à la volée avec cache possible |
| Sécurité | Mots de passe hashés, sessions sécurisées |

### 7.2 Contraintes fonctionnelles

| Contrainte | Description |
|------------|-------------|
| Agent | Pas de réponses directes aux exercices |
| TTS | Changement de langue selon le contenu |
| Profil | Modifiable avec historisation |

### 7.3 Critères de validation

- [ ] Phase de découverte complète sur plusieurs jours
- [ ] Trois types de parcours opérationnels
- [ ] Contenu généré à la volée (leçons + exercices)
- [ ] Timer 45 min avec changement de couleur
- [ ] Agent conversationnel (aide pédagogique, relais culturel)
- [ ] Module « Mes conseils » visible
- [ ] Admin : dashboard, modification profil, historisation
- [ ] Responsive (PC, tablette, smartphone)
- [ ] Gamification (badges, streaks)

---

## 8. Annexes

### 8.1 Référentiel PCM (rappel)

| Profil | Traits |
|--------|--------|
| Promoteur | Action, compétition, résultats |
| Rebelle | Liberté, créativité, expression |
| Imagineur | Imaginaire, créativité, monde intérieur |
| Analyseur | Logique, précision, structure |

### 8.2 Référentiel socle commun (extrait)

- Cycle 3 (CM1, CM2, 6ème) : Français, Maths, Langues vivantes, etc.
- Cycle 4 (5ème, 4ème, 3ème) : Idem + approfondissement
- Ouverture : géopolitique, arts, culture, sciences, sports, espace, histoire, géographie, technologie, robotique, pompiers, ...

### 8.3 Glossaire

| Terme | Définition |
|-------|------------|
| PCM | Process Communication Model |
| TTS | Text-to-Speech |
| Back to basics | Parcours FR, Maths, EN uniquement |
| Parcours orienté | Parcours avec matières ciblées pour la moyenne |
| Parcours projet | Parcours avec projet lié aux passions |

---

## 9. Prochaines étapes

1. **Validation** du présent cahier des charges
2. **Développement** selon les phases définies (P0 → P6)
3. **Tests** et ajustements

---

*Document rédigé à partir des échanges de cadrage (Phases 1, 2, 3).*
