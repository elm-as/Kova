# Kova — Plateforme d'Intelligence Recrutement & Radar d'Offres

**Plateforme double-face (Particuliers + Recruteurs)** conçue selon la charte **ElmasCore** :

- **Espace Particulier (B2C)** : import CV (PDF / image / texte via OCR), **Radar d'offres en direct** multi-sources (**Emploi.ci**, **Educarriere.ci**, **Remotive**, **Arbeitnow**, **Jobicy**), moteur de matching 5 axes (*Postuler maintenant* / *Avec ajustements* / *Hors cible*), recommandations exactes **« Ce qu'il faut mettre en avant »**, **Coach IA sur mesure** (pitch + questions probables) et **Suivi de candidatures**.
- **Espace Recruteur (ATS B2B)** : analyse automatique de CV, scoring 7 axes pondérés, génération de questions d'entretien, comparaison multi-candidats, emails personnalisés, gestion multi-tenant et paiement Stripe.

**Stack :** React 19 · TypeScript · Tailwind CSS 4 · Supabase (PostgreSQL + RLS) · Netlify Functions · Vite Dev/Preview Middleware (`/api/job-radar`, `/api/ocr`, `/llm-proxy`) · Stripe · DeepSeek · OCR.space / PaddleOCR

> **Migration Supabase Radar & Particulier** : exécuter [`database/job_radar_migration.sql`](database/job_radar_migration.sql) pour activer les tables `job_offers`, `candidate_profiles` et `candidate_applications` avec politiques RLS.

---

## 📋 Table des matières

- [Démarrage rapide](#-démarrage-rapide)
- [Vue d'ensemble fonctionnelle](#-vue-densemble-fonctionnelle)
- [Interface utilisateur](#-interface-utilisateur)
- [Analyse IA & Scoring](#-analyse-ia--scoring)
- [OCR & Extraction de CV](#-ocr--extraction-de-cv)
- [Questions d'entretien](#-questions-dentretien)
- [Emails & Communication](#-emails--communication)
- [Gestion d'entreprise](#-gestion-dentreprise)
- [Paiement & Abonnements](#-paiement--abonnements)
- [Sécurité](#-sécurité)
- [Architecture](#-architecture)
- [Commandes & Configuration](#-commandes--configuration)

---

## ⚡ Démarrage rapide

### Prérequis

- **Node.js** ≥ 18
- **Clés API** dans `.env` :
  - `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` — Base de données
  - `LLM_API_KEY` — DeepSeek (analyse IA)
  - `OCR_SPACE_API_KEY` — OCR.space (extraction CV)
  - `STRIPE_SECRET_KEY` — Paiements (optionnel en local)

```powershell
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de dev (port 5000)
npm run dev
```

**C'est tout.** Le proxy OCR intégré à Vite intercepte `/api/ocr` directement — pas besoin de `netlify dev`.

Ouvre `http://localhost:5000` → page de login.

### Compte demo

| Champ | Valeur |
|---|---|
| Email | `admin@demo-company.com` |
| Password | `Demo123!` |

Licence **Professional** avec toutes les fonctionnalités activées et 1 an avant expiration.

---

## 📐 Vue d'ensemble fonctionnelle

AI Recruit est une plateforme **multi-tenant** de gestion de recrutement qui couvre l'intégralité du cycle :

```
Création de poste → Ajout de CV (upload/lot/texte) → Analyse IA (scoring 7 axes)
    → Génération de questions d'entretien → Évaluation des réponses
    → Comparaison multi-candidats → Emails personnalisés → Archivage
```

### Les 3 rôles utilisateur

| Rôle | Permissions |
|---|---|
| **Owner** | Création d'entreprise, gestion facturation, invitations, toutes les actions |
| **Admin** | Gestion des postes, candidats, invitations utilisateurs |
| **Recruiter** | Création/édition de postes, ajout/évaluation de candidats |
| **Viewer** | Lecture seule : dashboard, historique, postes |

### Les 7 vues principales

| Vue | Description |
|---|---|
| **Tableau de Bord** | Métriques animées, top candidats, distribution des scores, activité récente, filtres par période |
| **Postes** | Liste des postes actifs/archivés, filtres date, création, vue détail avec drag-and-drop |
| **Historique** | Tous les postes avec stats (candidats, évalués, sélectionnés), filtres statut + date, recherche |
| **Entreprise** | Gestion licence, abonnement, utilisateurs, webhooks, widget intégrable |
| **FAQ** | 7 catégories de questions/réponses, navigation contextuelle vers les pages concernées |
| **Paramètres** | Pondération des 7 axes de scoring (5 presets inclus), configuration LLM |
| **DevTools** | Tests du pipeline OCR pas à pas (extraction, classification, champs, tableaux) |

---

## 🎨 Interface utilisateur

### Design system

- **Dark mode natif** (clair/sombre/système) via `data-appearance="dark"`
- **Breakpoints** : `xs` (475px), `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `coarse` (tactile), `pwa` (mode standalone)
- **Composants** : 45+ composants Radix UI via shadcn/ui (accordion, dialog, dropdown, command palette, select, tabs, checkbox, progress, scroll-area, sidebar...)
- **Animations** : Framer Motion (entrées, transitions, compteurs animés)
- **Graphiques** : Recharts (pie/donut charts, area charts pour sparklines)
- **Drag & Drop** : DnD Kit pour le réordonnancement des candidats

### Navigation

- **Sidebar** : Navigation collapsible (mode icône/texte) avec badge d'abonnement et CTA upgrade
- **Command Palette** (`Ctrl+K`) : Recherche globale, navigation rapide, actions
- **Raccourcis clavier** : `Alt+1` Dashboard, `Alt+2` Postes, `Alt+3` Historique, `Alt+4` Entreprise, `Alt+5` FAQ, `Alt+6` Paramètres, `Ctrl+Shift+D` toggle dark mode
- **Header** : Breadcrumbs contextuels, recherche globale, notifications, thème, langue, menu utilisateur

### Internationalisation

3 langues intégralement supportées : **Français**, **English**, **Español**
- Interface complète, messages d'erreur, emails, factures, FAQ
- Sélecteur de langue dans le header

---

## 🧠 Analyse IA & Scoring

### Les 7 axes d'évaluation

Chaque candidat est évalué sur 7 catégories pondérées (poids par défaut) :

| # | Catégorie | Poids | Description |
|---|---|---|---|
| 1 | **Compétences Techniques** | 15% | Frameworks, langages, outils — vérifiés par projets ou expérience |
| 2 | **Expérience Professionnelle** | 15% | Durée, complexité, responsabilités — salariée ET projets |
| 3 | **Formation & Certifications** | 10% | Diplômes, certifications, adéquation avec le poste |
| 4 | **Soft Skills & Adéquation Culturelle** | 10% | Autonomie, rigueur analytique — inférées de faits objectifs |
| 5 | **Trajectoire & Potentiel** | 15% | Progression carrière, complexité croissante, apprentissage continu |
| 6 | **Maturité Production** | 15% | Déploiements réels, utilisateurs, monitoring, sécurité |
| 7 | **Preuve d'Exécution (POE)** | 20% | Projets accessibles (40%), complexité réelle (30%), cohérence d'architecture (30%) |

Le **score global** (0-100) est la moyenne pondérée de ces 7 scores.

### Poids configurables

Dans **Paramètres**, les poids sont ajustables via sliders (0-50%, pas de 5%, total doit faire 100%). **5 presets** sont disponibles :

| Preset | TS | XP | Edu | Soft | Traj | Prod | POE | Cible |
|---|---|---|---|---|---|---|---|---|
| **Équilibré** | 15 | 15 | 10 | 10 | 15 | 15 | 20 | Tous postes |
| **Corporate** | 20 | 20 | 10 | 10 | 10 | 15 | 15 | Grands comptes |
| **Builders** | 20 | 10 | 5 | 10 | 15 | 15 | 25 | Startups |
| **Junior** | 20 | 5 | 15 | 10 | 25 | 10 | 15 | Débutants |
| **Senior** | 20 | 25 | 5 | 10 | 10 | 15 | 15 | Confirmés |

### Méthodologie d'analyse en 3 étapes (intégrée au prompt LLM)

| Étape | Description |
|---|---|
| **Scan rapide** | Titre, expérience, formation, localisation, mots-clés → filtre éliminatoire |
| **Analyse approfondie** | Progression carrière, cohérence compétences, profondeur technique, gaps, qualité des projets |
| **Grille d'évaluation** | Notation des 7 catégories pondérées avec justification rédigée en langage RH |

### Règles intégrées au prompt

- **Anti-biais** : langage interdit (adjectifs de personnalité, gut feelings, stéréotypes, langage genré), focus sur 6 dimensions vérifiables uniquement
- **Requaliﬁcation d'expérience** : les projets personnels déployés comptent comme expérience semi-professionnelle (multiplicateurs 0.5x à 1.2x selon complexité)
- **Équivalences technologiques** : Supabase → Backend (70%), React ↔ Vue/Angular (80%), PostgreSQL ↔ MySQL (70%), etc.
- **Inférence technique** : déduction de compétences à partir du contexte projet (pas seulement les mots-clés)
- **Calibration de marché** : 90+ (senior confirmé), 80-89 (mid solide), 70-79 (junior avancé), <70 (junior)

### Cache d'analyse

- Clé = hash SHA-256 de (profileText + requirements + weights + targetLevel + isInternship)
- TTL = 30 minutes
- Évite de ré-analyser des paires CV + poste identiques

### Niveau cible & Stage

- **Niveau cible** (Junior/Mid/Senior) : adapte les seuils d'évaluation dans le prompt LLM
- **Toggle Stage** : rend l'évaluation plus indulgente (bonus +10-15 points, pénalités réduites)

### Postes alternatifs

Si un candidat score entre 40 et 74, l'IA recherche automatiquement parmi les autres postes ouverts ceux qui pourraient mieux correspondre (différentiel ≥ 15 points).

---

## 🔍 OCR & Extraction de CV

### Pipeline d'extraction à 4 niveaux

| Tier | Méthode | Conditions |
|---|---|---|
| **1** | `pdf.js` (client) + `python-docx` (backend) | PDF texte natif / DOCX → instant |
| **2** | **PaddleOCR** (Python backend) | PDF scanné, image → gratuit, CPU, offline |
| **3** | OCR.space API | Fallback si backend Python down |
| **4** | Canvas rendering | Dernier recours |

### Formats supportés

| Format | Extraction | OCR si scan | Taille max |
|---|---|---|---|
| PDF natif | ✅ pdf.js | ❌ | 5 Mo |
| DOCX (.docx, .doc) | ✅ python-docx | ❌ | 5 Mo |
| TXT | ✅ lecture directe | ❌ | 5 Mo |
| HTML (.html, .htm) | ✅ DOM parser | ❌ | 5 Mo |
| PDF scanné | ❌ pdf.js | ✅ PaddleOCR | 5 Mo |
| Image (PNG, JPG, WEBP) | — | ✅ PaddleOCR | 5 Mo |

### Classification automatique

Après extraction, le document est classifié :
- **Type** : CV, Lettre de motivation, Diplôme, Certificat, Portfolio, Référence, Autre
- **Langue** : FR, EN, ES
- **Score de confiance**

### Backend OCR Python (PaddleOCR)

Outil open-source, CPU, sans clé API. Prétraitement d'image intégré (contraste, niveaux de gris, binarisation, débruitage, correction d'inclinaison).

```powershell
.\start-ocr-backend.bat
# Ou manuellement :
cd ocr-backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Optimisation du texte

La fonction `optimizeTextForAnalysis()` nettoie le texte extrait et tronque intelligemment (~4500 tokens max) en priorisant les sections clés (PROFIL, COMPÉTENCES, EXPÉRIENCE, PROJETS).

---

## 💬 Questions d'entretien

### Génération de questions

Accessible via le bouton **IA** (icône `Sparkle`) dans la carte de chaque candidat évalué.

- **6-8 questions techniques** personnalisées, strictement techniques (pas de comportemental)
- Générées à partir du **profil du candidat** (forces, faiblesses) et des **exigences du poste**
- Adaptées au **niveau cible** (Junior/Mid/Senior)

### Enregistrement & évaluation des réponses

Pour chaque question :
1. Saisie de la réponse du candidat (verbatim ou notes)
2. Évaluation IA sur **4 dimensions** :
   - **Profondeur technique**
   - **Précision**
   - **Complétude**
   - **Score global**

### Questions de suivi (follow-up)

Générées automatiquement après chaque réponse pour approfondir l'expertise technique du candidat.

---

## ✉️ Emails & Communication

### Génération d'emails IA

Depuis le détail d'un poste, bouton **Emails** (icône enveloppe).

- **3 types** : Liste restreinte (hiring manager), Invitation entretien (candidat), Rejet (professionnel et encourageant)
- **Instructions personnalisées** (champ libre)
- **Limite** : 50 emails par jour
- **Copie** dans le presse-papiers

### Export PDF

- **Rapport de poste** : synthèse complète avec tous les candidats
- **Rapport candidat** : fiche individuelle avec scores détaillés
- **Matrice de comparaison** : export PDF du tableau comparatif

---

## 🏢 Gestion d'entreprise

### Licences & Quotas

| Plan | Mensuel | Annuel | Utilisateurs | Postes | Candidats/Poste | Features |
|---|---|---|---|---|---|---|
| **Trial** | Gratuit | - | 3 | 5 | 50 | Basiques |
| **Starter** | 29€ | 290€ | 5 | 20 | 200 | + Bulk ops |
| **Professional** | 79€ | 790€ | 15 | 100 | 1 000 | + Analytics, Emails |
| **Enterprise** | 199€ | 1 990€ | ∞ | ∞ | ∞ | + API, Branding, Webhooks |

### Fonctionnalités par plan

| Fonctionnalité | Trial | Starter | Professional | Enterprise |
|---|---|---|---|---|
| Scoring IA | ✅ | ✅ | ✅ | ✅ |
| Questions d'entretien | ✅ | ✅ | ✅ | ✅ |
| OCR multi-format | ✅ | ✅ | ✅ | ✅ |
| Opérations groupées | ❌ | ✅ | ✅ | ✅ |
| Analyses avancées | ❌ | ❌ | ✅ | ✅ |
| Modèles d'emails | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ |
| Custom Branding | ❌ | ❌ | ❌ | ✅ |
| Webhooks | ❌ | ❌ | ❌ | ✅ |
| Widget intégrable | ❌ | ❌ | ❌ | ✅ |

### Gestion d'équipe

- **Invitation** d'utilisateurs par email (Owner/Admin)
- **4 rôles** : Owner, Admin, Recruiter, Viewer
- **Changement de rôle** et suppression d'utilisateurs
- **Mot de passe temporaire** pour les nouveaux utilisateurs (hashé bcrypt)

### Webhooks (Enterprise)

- **Événements** : `candidate.*` (analyzed, created, deleted), `position.*` (created, updated, deleted), `subscription.changed`
- **Activation/désactivation** par webhook
- **Secret** par webhook pour validation HMAC
- **Journal des déclenchements** (dernier appel, compteur d'échecs)

### Widget intégrable (Enterprise)

Formulaire de candidature embeddable sur site externe :

```html
<div id="ai-recruit-widget"></div>
<script
  src="https://votre-domaine.com/widget.js"
  data-company-id="..."
  data-position-id="..."
  data-lang="fr">
</script>
```

Support FR/EN/ES, upload de CV, design responsive, thème personnalisable.

---

## 💳 Paiement & Abonnements

### Intégration Stripe

- **Stripe Checkout** : page de paiement hébergée, redirection automatique
- **Webhooks** : gestion des événements (`checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`)
- **Modes de paiement** : Carte bancaire, SEPA, PayPal
- **Périodes** : Mensuel ou Annuel (-17%)

### Factures PDF

- Génération automatique de factures A4 en français
- Numérotation séquentielle par mois (`INV-{ANNEE}{MOIS}-{0001}`)
- TVA 20%, entête colorée, totaux HT/TTC
- Infos société : AI Recruitment Score, 75008 Paris, SIRET/TVA française

### Gestion des abonnements

- **Statuts** : Actif, Période d'essai, Paiement en retard, Annulé, Expiré
- **Rappels de paiement** : bannière d'avertissement côté client
- **Blocage** : page dédiée si abonnement expiré
- **Debug (DEV)** : boutons pour expirer/restaurer l'abonnement en mode propriétaire

### Historique des paiements

- Tableau avec filtres par statut (réussi, échoué, pending, remboursé)
- Détail par transaction (date, montant, moyen de paiement)
- Téléchargement de facture

---

## 🛡️ Sécurité

### Protection anti-prompt injection (4 couches)

Défense appliquée sur tous les CV avant envoi au LLM :

| Couche | Description |
|---|---|
| **1. Nettoyage** | Suppression des caractères invisibles (zero-width, BOM, homoglyphes cyrilliques/grecs, Unicode bidirectionnel) |
| **2. Détection** | 100+ patterns regex : instructions directes, manipulation de score, chantage émotionnel, délimiteurs de prompt, mots magiques IA (DAN, jailbreak...), obfuscation (leetspeak, base64, texte reverse) |
| **3. Encadrement** | Délimiteurs ASCII explicites autour du contenu candidat pour isoler le texte non fiable du prompt système |
| **4. Validation** | Vérification post-analyse de la cohérence du score (sanity check), plafonnement si nécessaire |

Niveau de risque remonté : `none`, `low`, `medium`, `high`.

### Sécurité des mots de passe

- Hashage **bcrypt** via Netlify Function (12 rounds) en production
- Fallback **SHA-256** en mode local
- Validation : 8+ caractères, majuscule, minuscule, chiffre, caractère spécial
- Indicateur visuel de force (faible/moyen/fort/très fort)
- Réinitialisation par email (lien temporaire)

### Authentification & Sessions

- Authentification obligatoire par email/mot de passe
- Sessions persistantes (localStorage)
- Contrôle d'accès par rôle (Owner, Admin, Recruiter, Viewer)
- Validation du domaine email de l'entreprise
- Journal d'audit (login, logout, CRUD, role changes, emails envoyés)

---

## 📁 Architecture

```
ai-recruitment-score/
├── public/
│   ├── manifest.json          # PWA : installable, standalone, thème indigo
│   ├── sw.js                  # Service Worker : cache network-first
│   └── widget.js              # Widget intégrable externe
│
├── netlify/functions/          # 6 fonctions serverless
│   ├── llm.ts                 # Proxy API LLM (DeepSeek) + rate limiting
│   ├── ocr.ts                 # OCR via OCR.space, multi-engines (1,2,3)
│   ├── auth.ts                # Bcrypt : hash (12 rounds) + verify
│   ├── create-checkout-session.ts  # Stripe Checkout
│   ├── stripe-webhook.ts      # Webhook Stripe (paiements)
│   ├── validate-license.ts    # Validation serveur anti-contournement
│   └── shared/rate-limit.ts   # Rate limiter global (30 req/60s par IP)
│
├── ocr-backend/                # Backend Python PaddleOCR (gratuit, offline)
│   ├── main.py
│   └── requirements.txt
│
├── src/
│   ├── App.tsx                 # Root : routing, auth, data loading, render switch
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx    # Shell glassmorphism, cmd+K, breadcrumbs, header
│   │   │   └── Sidebar.tsx     # Navigation collapsible, status pill, upgrade CTA
│   │   ├── auth/               # LoginForm, RegistrationForm, ForgotPasswordForm
│   │   ├── ui/                 # 45+ composants shadcn/ui (Radix)
│   │   ├── candidate-details/  # CandidateHeader, ScoreBreakdown, QuestionItem, AnswerScore
│   │   ├── DashboardView.tsx   # Tableau de bord (métriques, top performers, charts)
│   │   ├── PositionsView.tsx   # Liste des postes + navigation vers détail
│   │   ├── PositionDetailView.tsx  # Détail poste : candidats, actions, drag-and-drop
│   │   ├── HistoryView.tsx     # Historique avec stats, filtres statut/date, recherche
│   │   ├── FAQView.tsx         # FAQ 7 catégories avec accordéons et navigation
│   │   ├── CompanyManagement.tsx   # Licence, abonnement, utilisateurs, webhooks, widget
│   │   ├── SettingsView.tsx    # Pondération des 7 axes de scoring
│   │   ├── DevTools.tsx        # Tests OCR pas à pas
│   │   ├── AddCandidateDialog.tsx      # Upload CV (fichier, texte, lot)
│   │   ├── CompareScoresDialog.tsx     # Comparaison question par question
│   │   ├── ComparisonMatrixDialog.tsx  # Matrice comparative + export PDF
│   │   ├── EmailTemplateDialog.tsx     # Génération emails IA (shortlist/invitation/rejet)
│   │   ├── OrderingPresetsDialog.tsx   # Sauvegarde/chargement d'ordres personnalisés
│   │   ├── PaymentPage.tsx             # Page pricing + Stripe Checkout
│   │   ├── SubscriptionSection.tsx     # Affichage du plan d'abonnement
│   │   ├── SubscriptionBlockPage.tsx   # Page de blocage si abonnement expiré
│   │   ├── PaymentReminderBanner.tsx   # Bannière de rappel de paiement
│   │   ├── PaymentHistory.tsx          # Historique des transactions
│   │   ├── InvoiceManager.tsx          # Gestion des factures PDF
│   │   ├── PricingSection.tsx          # Composant pricing réutilisable
│   │   ├── CandidateCard.tsx           # Carte candidat (questions, suivi, réévaluation)
│   │   ├── AdvancedAnalyticsDashboard.tsx  # Analyses avancées (3D, D3)
│   │   └── ...
│   ├── lib/
│   │   ├── aiAnalysis.ts       # Prompt LLM 3 étapes + anti-biais + scoring 7D
│   │   ├── llmClient.ts        # Client LLM (API directe ou Netlify Function)
│   │   ├── llmModels.ts        # Sélection de modèles par usage (analysis/fast/email)
│   │   ├── promptDefense.ts    # Défense anti-prompt injection 4 couches
│   │   ├── db.ts               # Accès BDD (Supabase + fallback localStorage)
│   │   ├── supabase.ts         # Client Supabase
│   │   ├── supabaseClient.ts   # Configuration Supabase
│   │   ├── types.ts            # Tous les types TypeScript (500+ lignes)
│   │   ├── translations.ts     # i18n complet (FR/EN/ES, 1700+ lignes)
│   │   ├── ocrPipeline.ts      # Pipeline OCR multi-engines + prétraitement image
│   │   ├── documentClassifier.ts  # Classification type/langue de document
│   │   ├── fieldExtractor.ts   # Extraction structurée des champs
│   │   ├── fileUtils.ts        # Extraction PDF/DOCX/HTML + validation
│   │   ├── pdfExport.ts        # Export PDF (rapports, comparaisons, factures)
│   │   ├── payment.ts          # Logique Stripe + factures + historique
│   │   ├── license.ts          # Limites et permissions par plan
│   │   ├── webhooks.ts         # Gestion des webhooks
│   │   ├── auditLog.ts         # Journal d'audit
│   │   ├── password.ts         # Hashage bcrypt + validation + force
│   │   ├── kv.ts               # Key-Value store (localStorage)
│   │   └── utils.ts            # Utilitaires (cn, etc.)
│   ├── hooks/
│   │   ├── useAuth.ts          # Gestion d'authentification
│   │   ├── use-keyboard-shortcuts.ts  # Raccourcis clavier
│   │   ├── use-mobile.ts       # Détection mobile
│   │   └── use-theme.ts        # Gestion du thème (next-themes)
│   └── styles/
│       └── theme.css           # Design tokens Radix + thèmes clair/sombre
│
├── ocr-backend/                 # Backend Python PaddleOCR
├── start-ocr-backend.bat        # Script de lancement OCR Python
├── vite.config.ts               # Config Vite + proxy LLM/OCR/python
├── tailwind.config.js           # Design system (breakpoints, couleurs, spacing)
└── package.json
```

### Stockage des données

Double stratégie :
1. **Supabase** (PostgreSQL cloud) — mode principal, persistance garantie
2. **localStorage** — fallback automatique si Supabase non configuré, avec avertissement

### Proxy LLM

2 chemins selon l'environnement :
- **Production** : Netlify Function `/api/llm` (rate limité, sécurisé)
- **Développement** : Proxy Vite `/llm-proxy` → appel direct à l'API DeepSeek

### Modèles LLM par usage

| Usage | Modèle par défaut | Description |
|---|---|---|
| `analysis` | `deepseek-chat` | Scoring complet 7 axes |
| `fast` | `llama-3.1-8b-instant` | Questions d'entretien, postes alternatifs |
| `email` | `deepseek-chat` | Génération d'emails professionnels |
| `default` | `deepseek-chat` | Usage général |

Configurable via variables d'environnement (`VITE_LLM_MODEL_ANALYSIS`, `VITE_LLM_MODEL_FAST`, `VITE_LLM_MODEL_EMAIL`).

### PWA

L'application est installable comme PWA :
- **Manifest** : nom "AI Recruitment Assistant", `display: standalone`, thème indigo
- **Service Worker** : cache network-first avec fallback, bypass pour Supabase/API
- **Mode standalone** : breakpoint dédié (`pwa:`)

---

## 🧪 Tests

### E2E (Playwright)

```powershell
npm run test:e2e        # Tests headless
npm run test:e2e:ui     # Tests avec interface graphique
```

### Vérification TypeScript

```powershell
npx tsc --noEmit
```

---

## 🔧 Commandes

```powershell
npm run dev              # Dev server (Vite + proxy OCR intégré, port 5000)
npm run dev:netlify      # Dev avec Netlify Functions complètes (port 8888)
npm run build            # Build production (tsc + vite)
npm run preview          # Preview du build
npm run lint             # Linting ESLint
npm run optimize         # Optimisation Vite
npm run seed:supabase    # Seed de la BDD Supabase
npx tsc --noEmit         # Vérification TypeScript
```

---

## 🌐 Déploiement

### Netlify

```powershell
npm run build            # Génère le dossier dist/
```

Déploiement standard Netlify avec :
- **Functions** : automatiquement déployées depuis `netlify/functions/`
- **Redirects** : configurés pour le SPA routing et les proxies API
- **Variables d'environnement** : à configurer dans le dashboard Netlify

### Production

- Build statique généré dans `dist/`
- Netlify Functions pour le backend serverless
- Supabase pour la base de données
- Stripe pour les paiements (mode live)

---

**Build : ✅ TypeScript 0 erreur · ✅ Vite build vert · ✅ PWA installable**
