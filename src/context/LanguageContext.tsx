import React, { createContext, useContext, useState } from 'react';

export type Language = 'fr' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (keyOrText: string) => string;
}

const keyMap: Record<string, { fr: string; en: string }> = {
  'header.home': { fr: 'Examens', en: 'Exams' },
  'header.title': { fr: 'TCF Canada Expression Écrite', en: 'TCF Canada Written Expression' },
  'header.dashboard': { fr: 'Tableau de bord', en: 'Dashboard' },
  'header.profile': { fr: 'Profil', en: 'Profile' },
  'header.logout': { fr: 'Déconnexion', en: 'Log out' },
  'header.login': { fr: 'Se connecter', en: 'Log in' }
};

const directFrenchToEnglish: Record<string, string> = {
  // Navigation & General
  "Accueil": "Exam Selector",
  "← Accueil": "← Exams",
  "Sélecteur d'Examens": "Exam Selector",
  "Sélecteur d'examens": "Exam Selector",
  "Examens": "Exams",
  "Jours de Série": "Days Streak",
  "Série de Jours": "Days Streak",
  "Série active aujourd'hui !": "Streak active today!",
  "Pratiquez aujourd'hui pour continuer": "Practice today to keep it up",
  "Prêt à débuter une série": "Ready to start a streak",
  "jours": "days",
  "jour": "day",
  "Tableau de bord": "Dashboard",
  "Tableau de bord utilisateur": "User Dashboard",
  "Déconnexion": "Log out",
  "Se connecter": "Log in",
  "Se connecter / Créer un compte": "Log in / Register",
  "Retour à l'accueil": "Back to Exams",
  "← Retour au tableau de bord / accueil": "← Back to Dashboard / Exams",
  "Quitter": "Exit",
  "Supprimer": "Delete",
  "Voir": "View",
  "Date": "Date",
  "Année": "Year",
  "Mois": "Month",
  "Combinaison": "Combination",
  "Série / Combinaison": "Exam Set / Combination",
  "Actions": "Actions",
  "Pratique": "Practice",
  "Pratique ciblée :": "Targeted practice:",
  "Combinaisons rapides :": "Quick combinations:",
  "Tâches sélectionnées :": "Selected tasks:",
  "Copier mes rédactions": "Copy my writings",
  "Non évalué": "Not evaluated",
  "mots": "words",
  "inclus": "inclusive",
  "(inclus)": "(inclusive)",
  "mots inclus": "words inclusive",
  "mots (inclus)": "words (inclusive)",
  "Copié !": "Copied!",
  "Copier": "Copy",
  "Copier l'exemple": "Copy example",
  "Copier ma réponse": "Copy my answer",
  "Copier toutes mes réponses": "Copy all my answers",
  "Copier tout": "Copy all",
  "📋 Copier toutes mes réponses": "📋 Copy all my answers",
  "Admin : Copier-coller autorisé": "Admin: Copy/paste enabled",
  "Le copier-coller et les raccourcis clavier sont débloqués pour le compte administrateur.": "Copy-paste and keyboard shortcuts are unlocked for the administrator account.",
  "Fermer": "Close",
  "Suivant": "Next",
  "Terminer": "Finish",
  "Annuler": "Cancel",
  "Confirmer": "Confirm",
  "Examen terminé": "Exam Completed",
  "Temps utilisé": "Time used",
  "Compte-rendu de votre session": "Session Summary",
  "Examen en cours": "Exam in Progress",

  // Months
  "Janvier": "January",
  "Février": "February",
  "Mars": "March",
  "Avril": "April",
  "Mai": "May",
  "Juin": "June",
  "Juillet": "July",
  "Août": "August",
  "Septembre": "September",
  "Octobre": "October",
  "Novembre": "November",
  "Décembre": "December",

  // Home Page
  "TCF Canada — Expression Écrite Simulator": "TCF Canada — Written Expression Simulator",
  "Entraînez-vous dans les conditions de l'examen réel.": "Practice under real exam conditions.",
  "Mon Dashboard (Mes soumissions) →": "My Dashboard (My Submissions) →",
  "Choisissez votre entraînement": "Choose your practice session",
  "Sélectionnez une session d'entraînement": "Select a practice session",
  "Choisissez une combinaison réelle d'examen TCF Canada pour vous entraîner dans les conditions officielles.": "Choose a real TCF Canada exam combination to practice under official conditions.",
  "Vous n'êtes pas connecté. Connectez-vous pour synchroniser vos examens avec Supabase.": "You are not logged in. Log in to sync your exams with Supabase.",
  "Commencer l'examen": "Start Exam",
  "Refaire cet examen": "Retake this exam",
  "Refaire l’examen": "Retake exam",
  "Commencer": "Start",
  "Durée : 60 minutes • 3 tâches obligatoires": "Duration: 60 minutes • 3 mandatory tasks",
  "Durée: 60 minutes": "Duration: 60 minutes",
  "Sessions disponibles": "Available sessions",
  "Combinaisons du mois": "Combinations of the month",
  "Session": "Session",
  "Prêt pour l'épreuve ?": "Ready for the exam?",
  "Vous êtes prêt à commencer l'examen ?": "Are you ready to start the exam?",
  "Vous aurez 60 minutes pour compléter les 3 tâches dans les conditions réelles.": "You will have 60 minutes to complete all 3 tasks under real exam conditions.",
  "L'examen dure 60 minutes au total pour les 3 tâches. Le chronomètre démarre dès la validation.": "The exam lasts 60 minutes in total for all 3 tasks. The timer starts as soon as you confirm.",
  "Confirmer et démarrer": "Confirm and start",
  "Mode Examen Réel": "Real Exam Mode",
  "Conditions officielles TCF Canada": "Official TCF Canada Conditions",
  "Évaluation IA & Banque d'Erreurs": "AI Evaluation & Mistake Bank",
  "Profil Coach Personnalisé": "Personalized Coach Profile",
  "Tâche 1 : Message (60 - 120 mots)": "Task 1: Message (60 - 120 words)",
  "Tâche 2 : Récit / Article (120 - 150 mots)": "Task 2: Story / Article (120 - 150 words)",
  "Tâche 3 : Essai argumenté (120 - 180 mots)": "Task 3: Opinion Essay (120 - 180 words)",
  "Tâche 1 — Message": "Task 1 — Message",
  "Tâche 2 — Récit / Article": "Task 2 — Story / Article",
  "Tâche 3 — Essai argumenté": "Task 3 — Opinion Essay",
  "Tâche 1 — Message (60–120 mots)": "Task 1 — Message (60–120 words)",
  "Tâche 2 — Narration (120–150 mots)": "Task 2 — Story (120–150 words)",
  "Tâche 3 — Argumentation (120–180 mots)": "Task 3 — Opinion Essay (120–180 words)",
  "Tâche 1": "Task 1",
  "Tâche 2": "Task 2",
  "Tâche 3": "Task 3",
  "Déjà complétée (Refaire disponible)": "Already completed (Retake available)",
  "Déjà complétée": "Already completed",
  "Déjà faite (Refaire disponible)": "Already completed (Retake available)",
  "Faite": "Completed",
  "Sélectionnée": "Selected",
  "Consulter vos soumissions passées": "View your past submissions",
  "Retrouvez l'historique complet de vos épreuves, vos décomptes de mots et vos rédactions dans votre tableau de bord personnel.": "Find your full exam history, word counts, and writing submissions in your personal dashboard.",
  "Accéder au Dashboard": "Go to Dashboard",

  // Single Task Mode & Custom Timer
  "Mode d'entraînement": "Training Mode",
  "Examen complet de 60 minutes avec les 3 tâches consécutives (conditions réelles).": "Full 60-minute exam with all 3 consecutive tasks (official conditions).",
  "Entraînement ciblé sur une seule tâche avec un minuteur personnalisé défini par vous-même.": "Targeted practice on a single task with a custom timer defined by yourself.",
  "Examen Complet (60 min)": "Full Exam (60 min)",
  "Pratique par Tâche": "Task Practice",
  "1. Choisissez la tâche à pratiquer": "1. Choose the task to practice",
  "(Question issue de la combinaison sélectionnée)": "(Question from the selected combination)",
  "Message / Description": "Message / Description",
  "Narration / Récit": "Story / Narration",
  "Argumentation (2 documents)": "Opinion Essay (2 documents)",
  "Temps recommandé :": "Recommended time:",
  "Temps conseillé :": "Recommended time:",
  "2. Fixez votre minuteur (Temps libre par vous-même)": "2. Set your custom timer (Choose your own time)",
  "Minuteur réglé :": "Configured timer:",
  "minutes": "minutes",
  "Raccourcis :": "Presets:",
  "Pratique individuelle :": "Individual Practice:",
  "Tâche :": "Task:",
  "Minuteur personnalisé :": "Custom timer:",
  "Conditions réelles :": "Real conditions:",
  "Conditions réelles": "Official conditions",
  "Commencer l'entraînement": "Start practice",
  "Démarrer l'entraînement": "Start practice",
  "Pratique libre": "Free practice",
  "Entraînement Pratique": "Practice Session",
  "Examen Complet": "Full Exam",
  "Examen Officiel": "Official Exam",
  "Examen officiel terminé": "Official Exam Completed",
  "Compte-rendu d'entraînement": "Practice Report",
  "Compte-rendu d'entraînement individuel": "Individual practice summary",
  "Compte-rendu de l'Examen": "Exam Report",
  "Compte-rendu": "Report",
  "Voici le récapitulatif de votre session. Vous pouvez copier votre texte pour l'évaluer ou le conserver.": "Here is the summary of your session. You can copy your text to review or keep.",
  "Entraînement individuel": "Individual practice",
  "Nombre de mots": "Word count",
  "Objectif exigé": "Required target",
  "✓ Conforme": "✓ Compliant",
  "⚠️ Non conforme": "⚠️ Non-compliant",
  "Copier ma rédaction": "Copy my text",
  "Question au hasard": "Random question",
  "Terminer l'entraînement": "Finish practice",
  "Refaire la Combinaison": "Retake Combination",
  "Vous avez déjà soumis cette combinaison auparavant. Vous pouvez la refaire dans les conditions réelles (60 minutes). Votre nouvelle soumission sera enregistrée séparément dans votre tableau de bord.": "You have previously submitted this combination. You can retake it under real exam conditions (60 minutes). Your new submission will be saved separately in your dashboard.",
  "Vous pouvez la refaire à tout moment pour vous réentraîner. Votre nouvelle tentative sera enregistrée séparément dans votre tableau de bord.": "You can retake it anytime to practice again. Your new attempt will be recorded separately in your dashboard.",

  // Dashboard & Mistake Bank
  "Bienvenue": "Welcome",
  "Compte candidat :": "Candidate account:",
  "Ma Banque d'Erreurs & Profil Coach": "My Mistake Bank & Coach Profile",
  "Mes examens précédents": "My Past Exam Submissions",
  "Progression des Scores & Analyse des Performances": "Score Progress & Performance Analytics",
  "Progression des Scores & Niveaux CECRL": "Score Progress & CEFR Band Levels",
  "Profil de Compétences : Forces & Faiblesses": "Competency Profile: Strengths & Weaknesses",
  "Paliers de référence CECRL (TCF Canada)": "CEFR Reference Bands (TCF Canada)",
  "Vos Points Forts": "Key Strengths",
  "Points à Travailler": "Areas to Improve",
  "Taux de maîtrise": "Mastery Rate",
  "Total erreurs répertoriées": "Total recorded mistakes",
  "TOTAL ERREURS RÉPERTORIÉES": "TOTAL RECORDED MISTAKES",
  "Lancer 10 min d'entraînement": "Start 10 min practice",
  "Lancer 10 min d'entraînement ciblé": "Start 10 min targeted practice",
  "ERREUR DE LA SEMAINE CIBLÉE": "TARGET MISTAKE OF THE WEEK",
  "Erreur de la semaine ciblée": "Target Mistake of the Week",
  "Pratiquer maintenant (5 questions) →": "Practice now (5 questions) →",
  "S'entraîner maintenant (5 questions) →": "Practice now (5 questions) →",
  "Banque d'erreurs par catégorie": "Mistake Bank by Category",
  "Cliquez sur une catégorie pour filtrer vos erreurs et voir les sous-catégories associées.": "Click a category to filter your mistakes and see related subcategories.",
  "Afficher toutes les catégories": "Show all categories",
  "Vos 5 axes prioritaires": "Your 5 Priority Areas",
  "Top 5 faiblesses récurrentes": "Top 5 Recurring Weaknesses",
  "À travailler": "To practice",
  "Maîtrise des compétences": "Skill Mastery",
  "Progression": "Progress",
  "Compétences à consolider pour le niveau B2": "Skills to strengthen for B2 level",
  "Plus grande progression observée": "Greatest Observed Improvement",
  "Erreurs résolues avec succès sur les dernières sessions.": "Errors successfully resolved across recent sessions.",
  "Filtre actif :": "Active filter:",
  "Toutes les erreurs répertoriées": "All recorded mistakes",
  "Liste de vos erreurs": "List of your mistakes",
  "Aucune faute répertoriée dans cette catégorie. Excellent travail !": "No mistakes recorded in this category. Excellent work!",
  "Aucune erreur enregistrée pour cette catégorie. Continuez vos rédactions !": "No mistakes recorded for this category. Keep writing!",
  "Historique des examens": "Exam History",
  "Retrouvez vos écrits, vos temps et vos évaluations complètes.": "Find your written tasks, times, and complete evaluations.",
  "Aucun examen enregistré pour le moment. Lancez votre première session !": "No exams recorded yet. Start your first session!",
  "+ Commencer un nouvel examen": "+ Start a new exam",
  "Mois / Année": "Month / Year",
  "Mots écrits (T1 / T2 / T3)": "Words written (T1 / T2 / T3)",
  "Évaluation IA": "AI Evaluation",
  "Banque d'erreurs IA": "AI Mistake Bank",
  "Mes Fautes": "My Mistakes",
  "Mon Carnet de Fautes IA": "My AI Mistakes Bank",
  "fautes enregistrées": "mistakes saved",
  "Voulez-vous vraiment supprimer cette soumission": "Are you sure you want to delete this submission",

  // Results Page & AI Evaluation
  "Évaluation Détaillée par l’IA": "Detailed AI Evaluation",
  "Évaluation Détaillée par l'IA": "Detailed AI Evaluation",
  "Consultez l'analyse des fautes, votre note globale et la réponse modèle C1-C2.": "Review your mistake analysis, overall score, and C1-C2 model answer.",
  "Consultez vos écrits ou lancez l'évaluation détaillée par le Coach IA TCF Canada.": "Review your written tasks or launch detailed feedback from the AI TCF Canada Coach.",
  "Évaluer avec l’IA (Coach TCF)": "Evaluate with AI (TCF Coach)",
  "Évaluer avec l'IA (Coach TCF)": "Evaluate with AI (TCF Coach)",
  "Évaluation en cours...": "Evaluation in progress...",
  "Note globale": "Overall Score",
  "Niveau estimé": "Estimated Level",
  "Niveau CLB / CECRL": "CLB / CEFR Level",
  "Tâches évaluées": "Evaluated Tasks",
  "Tâches évaluées :": "Evaluated Tasks:",
  "Tâche 1 : Description / Message": "Task 1: Description / Message",
  "Tâche 2 : Narration / Récit": "Task 2: Narrative / Story",
  "Tâche 3 : Argumentation": "Task 3: Argumentative Essay",
  "mots rédigés": "words written",
  "exigés": "required",
  "Votre texte rédigé": "Your Written Response",
  "Copier votre texte": "Copy your text",
  "Fautes détectées": "Detected Mistakes",
  "Explications en anglais": "Explanations in English",
  "Excellent travail ! Aucune faute majeure de grammaire ou d’orthographe détectée.": "Great work! No major grammar or spelling mistakes detected.",
  "Excellent travail ! Aucune faute majeure de grammaire ou d’orthographe n’a été détectée.": "Great work! No major grammar or spelling mistakes detected.",
  "Temps / Conjugaison": "Tense / Conjugation",
  "Structure": "Structure",
  "Règle :": "Rule:",
  "Réponse modèle — Niveau C1 - C2": "Model Answer — Level C1 - C2",
  "Exemple enrichi au niveau C1/C2 respectant les consignes et le format officiel.": "Enriched C1/C2 model answer strictly following instructions and official format.",
  "Copier l’exemple": "Copy model answer",
  "Exemple non disponible.": "Model answer not available.",
  "Cible exigée": "Target word count",
  "Score IA": "AI Score",
  "Voici le récapitulatif complet de vos réponses pour évaluation avec votre tuteur.": "Here is the complete summary of your answers for evaluation with your tutor.",
  "Toutes les tâches": "All Tasks",
  "Aperçu de vos rédactions": "Your Written Tasks Preview",
  "Vous pouvez copier vos réponses ci-dessous ou lancer l'évaluation détaillée avec le bouton ci-dessus.": "You can copy your answers below or launch the detailed evaluation with the button above.",
  "Analyse en cours par l'expert TCF Canada...": "Analysis in progress by TCF Canada expert...",
  "Identification des fautes par catégorie, vérification du respect des consignes et estimation du niveau CECRL/NCLC (environ 3 secondes).": "Identifying mistakes by category, checking compliance with instructions, and estimating CEFR/NCLC level (approx. 3 seconds).",
  "Réessayer": "Retry",
  "Erreur lors de l'évaluation :": "Error during evaluation:",
  "Copier tout pour mon tuteur": "Copy all for my tutor",

  // Simulator, Editor & Submission Panel
  "Temps restant": "Time remaining",
  "Tableau de caractère": "Special characters",
  "Majuscules": "Uppercase",
  "Minuscules": "Lowercase",
  "MAJ (Actif)": "CAPS (Active)",
  "Passer en majuscules (ex: É, À)": "Switch to uppercase (e.g. É, À)",
  "Passer en minuscules": "Switch to lowercase",
  "Insérer": "Insert",
  "Conditions de soumission": "Submission conditions",
  "Précédent": "Previous",
  "Terminer l'examen": "Finish exam",
  "Terminer cet entraînement ?": "Finish this practice?",
  "Voulez-vous vraiment terminer l'examen ?": "Do you really want to finish the exam?",
  "Vous ne pourrez plus modifier votre réponse pour cette tâche.": "You will no longer be able to edit your response for this task.",
  "Vous ne pourrez plus modifier vos réponses une fois la soumission validée.": "You will no longer be able to edit your answers once submitted.",
  "⏱️ Temps écoulé ! La rédaction est désormais bloquée.": "⏱️ Time's up! Writing is now locked.",
  "Veuillez cliquer sur \"Terminer l'examen\" ci-dessous.": "Please click on \"Finish exam\" below.",
  "Veuillez rédiger votre texte ci-dessous.": "Please write your text below.",
  "Saisissez votre texte ici...": "Type your text here...",
  "Temps écoulé — Rédaction désactivée.": "Time's up — Writing disabled.",
  "✓ Nombre de mots conforme": "✓ Word count compliant",
  "⚠️ Nombre de mots insuffisant": "⚠️ Insufficient word count",
  "⚠️ Limite dépassée": "⚠️ Word limit exceeded",
  "Description / Message": "Description / Message",
  "Argumentation": "Opinion Essay",
  "Entraînement": "Practice",
  "Tâches": "Tasks",

  // Footer, Developer Info & Feedback
  "⚠️ Avis important :": "⚠️ Important Notice:",
  "Ce site est uniquement un outil de pratique pour l'entraînement à l'écriture. Aucun droit d'auteur revendiqué — créé bénévolement pour aider les étudiants.": "This site is solely a practice tool for writing preparation. No copyright claimed — created voluntarily to help students.",
  "Conditions d'utilisation / Disclaimer": "Terms of Use / Disclaimer",
  "Développé bénévolement par": "Developed voluntarily by",
  "Contact & Remerciements :": "Contact & Feedback:",
  "Remerciements & Feedback": "Thanks & Feedback",
  "Un mot pour le développeur / Feedback": "A note for the developer / Feedback",
  "Envoyer un feedback ou des remerciements": "Send feedback or a thank-you note",
  "Feedback": "Feedback",
  "Développeur": "Developer",
  "Concepteur et développeur de cette plateforme de préparation au TCF Canada.": "Designer and developer of this TCF Canada practice platform.",
  "Écrire un e-mail direct": "Send a direct email",
  "Pourquoi ce site ?": "Why this website?",
  "Ce simulateur a été créé bénévolement dans le but d'aider tous les étudiants et candidats à s'entraîner gratuitement dans les conditions réelles de l'examen d'expression écrite du TCF Canada.": "This simulator was built voluntarily to help all candidates practice for free under real TCF Canada written exam conditions.",
  "Merci infiniment pour votre message !": "Thank you so much for your message!",
  "Votre retour a bien été transmis à": "Your message has been sent to",
  "Chaque message, encouragement ou suggestion compte énormément pour faire évoluer ce simulateur.": "Every message, kind word, or suggestion helps make this platform better.",
  "Envoyer un autre mot": "Send another message",
  "Envoyer un message ou vos remerciements": "Send a message or your thanks",
  "Ce formulaire sera transmis directement sur la boîte mail de Écriture": "This form will be sent directly to Écriture's inbox",
  "Objet de votre message": "Message Topic",
  "Remerciements": "Thanks & Praise",
  "Suggestion": "Suggestion",
  "Signaler bug": "Report bug",
  "Votre appréciation de la plateforme": "Your rating of the platform",
  "Parfait / Très utile": "Perfect / Very helpful",
  "Très bon outil": "Great tool",
  "Peut être amélioré": "Could be improved",
  "Besoin de corrections": "Needs fixes",
  "Votre nom ou prénom": "Your name",
  "optionnel": "optional",
  "Votre adresse e-mail": "Your email address",
  "si vous souhaitez une réponse": "if you would like a reply",
  "Titre / Objet": "Title / Subject",
  "Votre message": "Your message",
  "Envoyer mon message à Écriture": "Send my message to Écriture",
  "Ou envoyer directement via votre boîte mail": "Or send directly via your email app",

  // AI Evaluation View
  "Bilan Coach IA — TCF Canada": "AI Coach Assessment — TCF Canada",
  "estimé": "estimated",
  "Évaluation pédagogique indicative personnalisée basée sur vos rédactions.": "Indicative personalized educational assessment based on your writing.",
  "Commentaire général du Coach :": "Coach's Overall Feedback:",
  "Cap vers le niveau": "On track for level",
  "acquis": "acquired",
  "Axes prioritaires pour sécuriser le B2 :": "Priority areas to secure B2 level:",
  "Points forts démontrés :": "Demonstrated Strengths:",
  "Points prioritaires à consolider :": "Priority Areas to Strengthen:",
  "🎯 Compétence clé à travailler en priorité": "🎯 Key Skill to Work on in Priority",
  "📚 Entraînement recommandé": "📚 Recommended Practice",
  "faute": "mistake",
  "fautes": "mistakes",
  "Niveau estimé tâche :": "Estimated task level:",
  "Sujet & Consigne officielle": "Official Topic & Prompt",
  "SUJET & CONSIGNE OFFICIELLE": "OFFICIAL TOPIC & PROMPT",
  "Consigne :": "Prompt:",
  "Document 1 :": "Document 1:",
  "Document 2 :": "Document 2:",
  "Votre réponse rédigée": "Your Written Response",
  "Aucune réponse rédigée pour cette tâche.": "No response submitted for this task.",
  "Exemple de réponse modèle (Générée par l'IA)": "Model Answer Example (AI Generated)",
  "Niveau B2 Avancé / C1": "Advanced B2 / C1 Level",
  "📋 Copier l'exemple": "📋 Copy example",
  "Avant vs Après : comparaison directe": "Before vs After: Direct Comparison",
  "❌ Votre texte original :": "❌ Your original text:",
  "✅ Formulation B2/C1 améliorée :": "✅ Improved B2/C1 formulation:",
  "Explication détaillée des modifications :": "Detailed explanation of changes:",
  "📊 Grille d'évaluation détaillée de la tâche": "📊 Detailed Task Scoring Grid",
  "Grille d'évaluation détaillée de la tâche": "Detailed Task Scoring Grid",
  "Grammaire": "Grammar",
  "Vocabulaire": "Vocabulary",
  "Orthographe": "Spelling",
  "Temps verbaux": "Verb Tenses",
  "Structure de phrases": "Sentence Structure",
  "Cohérence & Connecteurs": "Coherence & Connectors",
  "Respect consigne": "Task Completion",
  "Score Global": "Overall Score",
  "🔍 Fautes identifiées": "🔍 Identified Mistakes",
  "Fautes identifiées": "Identified Mistakes",
  "✓ Aucune faute grammaticale ou lexicale significative relevée sur cette tâche. Très bon travail !": "✓ No significant grammatical or lexical mistakes found on this task. Great job!",
  "Texte original :": "Original text:",
  "Correction recommandée :": "Recommended correction:",
  "Rule / Explanation :": "Rule / Explanation:",
  "💡 Suggestions de style & tournures B2/C1": "💡 Style Suggestions & B2/C1 Phrasing",
  "Suggestions de style & tournures B2/C1": "Style Suggestions & B2/C1 Phrasing",
  "Votre phrase :": "Your sentence:",
  "Formulation plus naturelle / B2+ :": "More natural / B2+ phrasing:",
  "Critique": "Critical",
  "Majeure": "Major",
  "Mineure": "Minor",
  "🔴 Nouveau": "🔴 New",
  "🟠 En pratique": "🟠 In practice",
  "🟢 En progrès": "🟢 Improving",
  "✅ Maîtrisé": "✅ Mastered",
  "Conforme": "Compliant",
  "Mots insuffisants": "Insufficient words",
  "Limite dépassée": "Limit exceeded",

  // Practice Modal
  "Entraînement Ciblé Coach IA": "AI Coach Targeted Practice",
  "ENTRAÎNEMENT CIBLÉ COACH IA": "AI COACH TARGETED PRACTICE",
  "Question": "Question",
  "Bonne réponse !": "Correct answer!",
  "Explication :": "Explanation:",
  "Réponse incorrecte": "Incorrect answer",
  "Question suivante →": "Next question →",
  "Voir mon bilan d'entraînement": "View practice summary",
  "Entraînement terminé !": "Practice Completed!",
  "Score final :": "Final Score:",
  "Excellente maîtrise ! Vous avez consolidé cette notion clé.": "Excellent mastery! You have consolidated this key concept.",
  "Bon entraînement. Révisez encore cette notion pour la sécuriser.": "Good practice. Review this concept again to secure it.",
  "Fermer l'entraînement": "Close practice",
  "Entraînement TCF Canada": "TCF Canada Practice",

  // Login Page
  "Connexion": "Log In",
  "Inscription": "Sign Up",
  "Connexion candidat": "Candidate Login",
  "Créer un compte": "Create an account",
  "Mot de passe oublié": "Forgot password",
  "Nouveau mot de passe": "New password",
  "Créez votre compte unique. Une vérification par e-mail est obligatoire avant votre premier accès.": "Create your unique account. Email verification is required before your first login.",
  "Connectez-vous avec votre adresse e-mail vérifiée pour accéder au simulateur TCF.": "Log in with your verified email to access the TCF simulator.",
  "Saisissez votre adresse e-mail pour recevoir les instructions de réinitialisation.": "Enter your email address to receive reset instructions.",
  "Choisissez un mot de passe sécurisé pour réactiver l’accès à votre compte.": "Choose a secure password to restore access to your account.",
  "Adresse email": "Email address",
  "Adresse e-mail": "Email address",
  "Mot de passe": "Password",
  "Confirmer le mot de passe": "Confirm password",
  "Se souvenir de moi sur cet appareil": "Remember me on this device",
  "Mot de passe oublié ?": "Forgot password?",
  "Créer mon compte": "Create my account",
  "Renvoyer l'e-mail de confirmation": "Resend confirmation email",
  "Envoyer les instructions": "Send instructions",
  "Enregistrement du mot de passe...": "Saving password...",
  "Envoi en cours...": "Sending...",
  "Connexion en cours...": "Logging in...",
  "Création en cours...": "Creating account...",
  "Enregistrer le nouveau mot de passe": "Save new password",
  "Retour à la connexion": "Back to login",
  "Bienvenue sur votre simulateur TCF Canada": "Welcome to your TCF Canada simulator",
  "Pas encore de compte ? S'inscrire": "Don't have an account yet? Sign up",
  "Déjà un compte ? Se connecter": "Already have an account? Log in",
  "Accès obligatoire par authentification": "Mandatory authenticated access",
  "Configuration de l'IA (Google Gemini)": "AI Configuration (Google Gemini)",
  "Évaluation automatique & Coaching TCF Canada": "Automatic Evaluation & TCF Canada Coaching",
  "100% Gratuit & Sécurisé en local": "100% Free & Secure Locally",
  "L'API Google Gemini 1.5 Flash est gratuite jusqu'à 1 500 évaluations par jour. Votre clé reste strictement enregistrée sur votre navigateur localement.": "The Google Gemini 1.5 Flash API is free up to 1,500 evaluations per day. Your key remains strictly stored locally in your browser.",
  "→ Obtenir ma clé gratuite sur Google AI Studio (2 min) ↗": "→ Get my free key on Google AI Studio (2 min) ↗",
  "Clé API Gemini (Google AI Studio)": "Gemini API Key (Google AI Studio)",
  "Vous pouvez aussi renseigner VITE_GEMINI_API_KEY dans votre fichier .env.": "You can also set VITE_GEMINI_API_KEY in your .env file.",
  "Supprimer la clé": "Delete key",
  "Enregistrer la clé": "Save key",
  "✓ Enregistré !": "✓ Saved!",
  "Entrez une clé API Google Gemini (ou laissez vide pour réinitialiser) :": "Enter a Google Gemini API key (or leave empty to reset):",
  "Clé API": "API Key",

  // User Profile
  "Mon Profil": "My Profile",
  "Profil": "Profile",
  "Profil utilisateur": "User Profile",
  "Gérez vos informations personnelles": "Manage your personal information",
  "Nom complet / Prénom": "Full Name / First Name",
  "Entrez votre nom": "Enter your name",
  "ex. Jean Dupont": "e.g. John Doe",
  "Adresse e-mail liée à votre compte.": "Email address linked to your account.",
  "non modifiable": "read-only",
  "Ce nom sera affiché pour vous accueillir sur votre tableau de bord (ex. \"Bonjour [Nom]\").": "This name will be displayed to greet you on your dashboard (e.g. \"Bonjour [Name]\").",
  "Profil enregistré avec succès !": "Profile saved successfully!",
  "Veuillez entrer votre nom.": "Please enter your name.",
  "Enregistrement...": "Saving...",
  "Modifier mon profil": "Edit my profile",

  // Admin & Notifications
  "Administration": "Administration",
  "👑 Administration": "👑 Admin",
  "Espace Administrateur": "Administrator Area",
  "👑 Espace Administrateur": "👑 Administrator Area",
  "Panneau d'Administration": "Admin Panel",
  "Admin Profil": "Admin Profile",
  "Admin Master": "Admin Master",
  "Gestion des Notifications": "Notification Management",
  "👑 Gestion des Notifications": "👑 Notification Settings",
  "👥 Utilisateurs & Notifications (Admin)": "👥 Users & Notifications (Admin)",
  "👥 Liste des Utilisateurs & Choix des Notifications": "👥 User List & Notification Selection",
  "Liste des Utilisateurs & Choix des Notifications": "User List & Notification Selection",
  "Liste des Utilisateurs": "User List",
  "Sélection des Utilisateurs à Surveiller": "Select Users to Monitor",
  "Tout sélectionner": "Select All",
  "Tout désélectionner": "Deselect All",
  "Tout cocher": "Check All",
  "Tout décocher": "Uncheck All",
  "+ Ajouter": "+ Add",
  "+ Ajouter à la liste": "+ Add to list",
  "Ajouter un e-mail": "Add an email",
  "Ajouter un e-mail (ex: xyz@gmail.com)...": "Add an email (e.g. xyz@gmail.com)...",
  "Filtrer la liste des utilisateurs...": "Filter user list...",
  "Filtrer ou rechercher un e-mail...": "Filter or search an email...",
  "✓ Alertes activées": "✓ Alerts enabled",
  "✓ Alertes actives": "✓ Alerts active",
  "Ignoré": "Ignored",
  "Aucune notification pour cet utilisateur": "No notifications for this user",
  "Tester (toutes tâches)": "Test (all tasks)",
  "Tester (task-2 seul)": "Test (task-2 only)",
  "Envoyer un e-mail test": "Send a test email",
  "Envoyer e-mail test": "Send test email",
  "Configuration Générale des Alertes": "General Alert Settings",
  "Paramètres de Réception": "Recipient Settings",
  "Interrupteur général des alertes": "Master Alert Switch",
  "Activer les alertes e-mail": "Enable email alerts",
  "Recevoir un e-mail à chaque fois qu'un travail est validé.": "Receive an email every time work is submitted.",
  "Statut :": "Status:",
  "Actif • Alertes autorisées": "Active • Alerts enabled",
  "Actif • Envoi en temps réel": "Active • Real-time dispatch",
  "Suspendu (aucune notification envoyée)": "Suspended (no notifications sent)",
  "Désactivé": "Disabled",
  "Adresse e-mail de réception": "Recipient email address",
  "Boîte de réception administrateur": "Administrator Inbox",
  "Les notifications seront acheminées vers cette boîte de réception.": "Notifications will be delivered to this inbox.",
  "Adresse où vous recevrez les alertes de devoirs.": "Address where you will receive homework alerts.",
  "Sauvegarder": "Save",
  "Historique des Alertes Expédiées": "Sent Alerts History",
  "Historique Récent des Notifications": "Recent Notification History",
  "Effacer l'historique": "Clear history",
  "Effacer le journal": "Clear log",
  "Délivré": "Delivered",
  "Simulé": "Simulated",
  "Objet :": "Subject:",
  "Destinataire :": "Recipient:",
  "Connecté en tant que": "Logged in as",
  "Paramètres enregistrés avec succès": "Settings saved successfully",
  "Aucun utilisateur trouvé": "No users found",
  "Compte administrateur avec gestion des alertes e-mail.": "Administrator account with email alert management.",
  "Mes Examens": "My Exams",
  "Consultez le détail de vos rédactions passées et leur nombre de mots.": "View the details of your past writings and word counts.",
  "Gérez et sélectionnez les candidats dont vous voulez recevoir les notifications de devoirs.": "Manage and select the candidates whose homework notifications you want to receive.",
  "Exemples d'alertes reçues selon les tâches soumises :": "Examples of alerts received based on submitted tasks:",
  "Candidat soumettant tout :": "Candidate submitting all tasks:",
  "Candidat soumettant tâche 2 :": "Candidate submitting task 2:",
  "Candidat soumettant tâches 1 et 2 :": "Candidate submitting tasks 1 and 2:",
  "Activer ou suspendre tous les envois d'e-mails.": "Enable or pause all email dispatches.",
  "Journal en temps réel de chaque e-mail envoyé": "Real-time log of every email sent",
  "Remplir identifiants Admin ()": "Fill Admin credentials ()",
  "Voulez-vous réinitialiser l'historique des alertes ?": "Do you want to reset the alerts history?",
  "Retirer de la liste": "Remove from list",
  "Synchronisation Supabase (public.profiles)": "Supabase Synchronization (public.profiles)",
  "Pour récupérer directement les 6 utilisateurs de public.profiles sur localhost et détecter les nouveaux utilisateurs en direct, saisissez votre clé Supabase Anon :": "To directly retrieve the 6 users from public.profiles on localhost and detect new users live, enter your Supabase Anon key:",
  "Connecter & Charger les utilisateurs": "Connect & Load users",
  "Clé Supabase enregistrée ! Synchronisation en cours...": "Supabase key saved! Syncing in progress...",
  "Nouveau candidat détecté :": "New candidate detected:",
  "Vous recevrez un e-mail dès que": "You will receive an email as soon as",
  "soumettra une tâche": "submits a task",
  "Aucune alerte enregistrée pour l'instant.": "No alerts recorded yet.",
  "Cochez les utilisateurs dont vous souhaitez recevoir les soumissions par e-mail": "Check the users whose submissions you want to receive by email",
  "Activez les utilisateurs dont vous souhaitez recevoir les soumissions par e-mail": "Enable the users whose submissions you want to receive by email",
  "Erreur lors de l'envoi du test": "Error while sending test email",
  "Tout activer": "Enable all",
  "Tout désactiver": "Disable all",
  "Activé": "Enabled",
  "actifs": "active",
  "Notifications activées": "Notifications enabled",
  "Notifications désactivées": "Notifications disabled",
  "Désactiver les alertes pour cet utilisateur": "Disable alerts for this user",
  "Activer les alertes pour cet utilisateur": "Enable alerts for this user",

  // Top Bar & Layout Subtitles / Badges
  "Espace Administrateur avec gestion des alertes.": "Administrator Area with alert management.",
  "Sélectionnez votre session et commencez à rédiger dans les conditions réelles.": "Select your session and start writing under real exam conditions.",
  "Bienvenue sur votre tableau de bord personnel.": "Welcome to your personal dashboard.",
  "Entraînement chronométré": "Timed practice",
  "Examen en cours (60 minutes)": "Exam in progress (60 minutes)",
  "Compte-rendu de votre session d'examen": "Exam Session Report",
  "Vos retours, suggestions et messages de remerciements": "Your feedback, suggestions and thank-you messages",
  "Nouvel examen": "New Exam",
  "Nouvel Examen": "New Exam",
  "👑 Administrateur": "👑 Administrator",
  "👑 Admin": "👑 Admin",
  "Admin": "Admin",
  "Administrateur": "Administrator",
  "Administrateur (Écriture)": "Administrator (Écriture)",
  "Candidat TCF": "TCF Candidate",
  "Candidat Vérifié": "Verified Candidate",
  "Compte & Aide": "Account & Support",
  "Réduire le menu": "Collapse menu",
  "Agrandir le menu": "Expand menu",
  "Un examen est en cours. Êtes-vous sûr de vouloir quitter ? Vos réponses non soumises seront perdues.": "An exam is currently in progress. Are you sure you want to leave? Your unsubmitted answers will be lost.",
  "Simulateur TCF Canada": "TCF Canada Simulator",
  "Résultats de l'épreuve": "Exam Results",
  "Notes personnelles": "Feedback & Thanks",

  // Dashboard Stats & Badges
  "Examens Soumis": "Submitted Exams",
  "EXAMENS SOUMIS": "Submitted Exams",
  "Aucune soumission": "No submissions",
  "Enregistrés sur votre compte": "Saved to your account",
  "Tâches Rédigées": "Written Tasks",
  "TÂCHES RÉDIGÉES": "Written Tasks",
  "Tâche 1, 2 ou 3 complétées": "Task 1, 2 or 3 completed",
  "Dernière Session": "Last Session",
  "DERNIÈRE SESSION": "Last Session",
  "Entraînement régulier": "Regular practice",
  "Prêt à débuter": "Ready to start",
  "Statut du Compte": "Account Status",
  "STATUT DU COMPTE": "Account Status",
  "ACTIF": "ACTIVE",
  "Actif": "Active",
  "Commencer un examen": "Start an exam",
  "Chargement de vos soumissions...": "Loading your submissions...",
  "Aucun examen enregistré pour le moment.": "No exams recorded yet.",
  "Entraînez-vous dans les conditions réelles du TCF Canada (60 minutes pour 3 tâches rédigées).": "Practice under real TCF Canada conditions (60 minutes for 3 written tasks).",
  "Passer votre premier examen": "Take your first exam",
  "Supprimer cette soumission": "Delete this submission",
  "Respect de la vie privée :": "Privacy Policy:",
  "Vos réponses rédigées sont enregistrées de façon confidentielle dans votre compte personnel uniquement. Vos soumissions ne sont jamais publiques, aucun profil public n'est généré, et aucun classement n'est partagé.": "Your written responses are stored privately in your personal account only. Your submissions are never public, no public profile is created, and no ranking is shared.",

  // Home Page Options & Confirmation
  "Vert = Déjà complétée": "Green = Already completed",
  "Choisir une combinaison au hasard": "Pick a random combination",
  "Vous avez déjà complété la Combinaison": "You have already completed Combination",
  "1. Choisissez la ou les tâches à pratiquer": "1. Choose the task(s) to practice",
  "Sélectionnez 1 tâche ou combinez 2 tâches (ex: T1+T2, T1+T3, T2+T3)": "Select 1 task or combine 2 tasks (e.g. T1+T2, T1+T3, T2+T3)",
  "allouées pour ces rédactions.": "allocated for these writings.",
  "allouées pour cette rédaction.": "allocated for this writing.",
  "Exacte même interface d'examen TCF avec décompte des mots et clavier d'accents.": "Exact same TCF exam interface with word counter and accents keyboard.",
  "Message (60–120 mots)": "Message (60–120 words)",
  "Narration (120–150 mots)": "Narration (120–150 words)",
  "Argumentation (120–180 mots)": "Opinion Essay (120–180 words)",
  "Prêt pour l'entraînement": "Ready for practice",
  "Vous aurez": "You will have",
  "minutes pour compléter": "minutes to complete",
  "ces tâches": "these tasks",
  "cette tâche": "this task",
  "dans les conditions d'examen du TCF Canada.": "under TCF Canada exam conditions.",
  "Diminuer d'une minute": "Decrease by one minute",
  "Augmenter d'une minute": "Increase by one minute",

  // Results & Evaluation
  "Entraînement terminé": "Practice completed",
  "Copier cette tâche": "Copy this task",
  "Aucune réponse rédigée.": "No response submitted.",
  "Expression Écrite": "Written Expression",
  "Document 1": "Document 1",
  "Document 2": "Document 2",
  "Orthographe / Accents": "Spelling / Accents",
  "Conjugaison / Temps": "Conjugation / Tenses",
  "Structure de phrase": "Sentence Structure",
  "Rule :": "Rule:",
  "💡 Rule:": "💡 Rule:",
  "💡 Règle :": "💡 Rule:",

  // Feedback View
  "✓ Copié !": "✓ Copied!",
  "Idée / Suggestion d'amélioration": "Idea / Suggestion for improvement",
  "Signalement de bug / problème technique": "Bug report / Technical issue",
  "Question sur le simulateur": "Question about the simulator",
  "Veuillez renseigner votre message.": "Please enter your message.",
  "Un grand merci pour cette plateforme !": "A big thank you for this platform!",
  "Bien": "Good",
  "Dites un mot à Écriture, partagez comment cette plateforme vous a aidé pour votre entraînement au TCF...": "Leave a note for Écriture, share how this platform helped your TCF training...",
  "Quelle fonctionnalité ou amélioration aimeriez-vous voir sur le site ?": "What feature or improvement would you like to see on the site?",
  "Décrivez le problème rencontré (sur quel exercice ou tâche, ce qui s'est passé)...": "Describe the problem encountered (on which exercise or task, what happened)...",
  "Posez votre question...": "Ask your question...",
  "Ex: Alexandre, Sarah...": "E.g.: Alex, Sarah...",

  // Login / Auth View
  "Chargement de votre session...": "Loading your session...",
  "La vérification réseau prend du temps en raison de votre connexion.": "Network verification is taking time due to your connection.",
  "Recharger": "Reload",
  "Minimum 6 caractères": "Minimum 6 characters",
  "← Retour à la connexion": "← Back to login",
  "Veuillez saisir votre nouveau mot de passe ci-dessous.": "Please enter your new password below.",
  "Veuillez renseigner votre adresse e-mail et votre mot de passe.": "Please enter your email address and password.",
  "Votre adresse e-mail n'a pas encore été confirmée. Veuillez ouvrir votre messagerie et cliquer sur le lien de confirmation.": "Your email address has not been confirmed yet. Please open your inbox and click the confirmation link.",
  "Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.": "Incorrect credentials. Please verify your email address and password.",
  "Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.": "An account already exists with this email address. Please log in.",
  "Une erreur inattendue est survenue.": "An unexpected error occurred.",
  "Veuillez renseigner tous les champs obligatoires.": "Please fill in all required fields.",
  "Le mot de passe doit comporter au moins 6 caractères.": "Password must be at least 6 characters long.",
  "Les mots de passe ne correspondent pas.": "Passwords do not match.",
  "→ Cliquer ici pour vous connecter avec ce compte": "→ Click here to log in with this account",
  "Masquer le mot de passe": "Hide password",
  "Afficher le mot de passe": "Show password",
  "Vos rédactions et vos statistiques d'examen sont protégées de manière sécurisée et confidentielle.": "Your writings and exam statistics are protected securely and confidentially."
};

const FRENCH_MONTHS_MAP: Record<string, string> = {
  "Janvier": "January",
  "Février": "February",
  "Mars": "March",
  "Avril": "April",
  "Mai": "May",
  "Juin": "June",
  "Juillet": "July",
  "Août": "August",
  "Septembre": "September",
  "Octobre": "October",
  "Novembre": "November",
  "Décembre": "December"
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'fr',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (keyOrText: string) => keyOrText
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('tcf_language');
      return (saved === 'en' || saved === 'fr') ? saved : 'fr';
    } catch {
      return 'fr';
    }
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('tcf_language', lang);
    } catch {}
  };

  const toggleLanguage = () => {
    setLanguage(language === 'fr' ? 'en' : 'fr');
  };

  const t = (keyOrText: string): string => {
    if (!keyOrText) return '';

    // Handle key-based lookups (e.g. 'header.home')
    if (keyMap[keyOrText]) {
      return keyMap[keyOrText][language];
    }

    if (language === 'fr') {
      return keyOrText;
    }

    const trimmed = keyOrText.trim();
    if (directFrenchToEnglish[trimmed]) {
      return directFrenchToEnglish[trimmed];
    }

    // Dynamic / Pattern-based translation
    if (trimmed.startsWith('Combinaison ')) {
      let res = trimmed.replace('Combinaison', 'Combination');
      for (const [frMonth, enMonth] of Object.entries(FRENCH_MONTHS_MAP)) {
        if (res.includes(frMonth)) {
          res = res.replace(frMonth, enMonth);
        }
      }
      return res;
    }
    if (trimmed.startsWith('Tâche ')) {
      return trimmed.replace('Tâche', 'Task');
    }
    if (trimmed.startsWith('Mois (')) {
      return trimmed.replace('Mois', 'Month');
    }
    if (trimmed.startsWith('Fait le ')) {
      return trimmed.replace('Fait le', 'Completed on');
    }
    if (trimmed.startsWith('Question ')) {
      return trimmed;
    }
    if (trimmed.endsWith(' mots')) {
      return trimmed.replace('mots', 'words');
    }
    if (trimmed.includes('combinaison')) {
      return trimmed.replace(/combinaisons?/g, (m) => (m.endsWith('s') ? 'combinations' : 'combination'));
    }
    if (trimmed.includes('faite')) {
      return trimmed.replace(/faites?/g, 'done');
    }

    // Check month replacement if composite date string (e.g. "2026 / Septembre / Combinaison 1")
    let translatedComposite = trimmed;
    let hasMonthMatch = false;
    for (const [frMonth, enMonth] of Object.entries(FRENCH_MONTHS_MAP)) {
      if (translatedComposite.includes(frMonth)) {
        translatedComposite = translatedComposite.replace(new RegExp(`\\b${frMonth}\\b`, 'g'), enMonth);
        hasMonthMatch = true;
      }
    }
    if (hasMonthMatch) {
      translatedComposite = translatedComposite.replace(/\bCombinaison\b/g, 'Combination');
      translatedComposite = translatedComposite.replace(/\bTâche\b/g, 'Task');
      return translatedComposite;
    }

    // Check without punctuation or leading emojis
    const cleanKey = trimmed.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim();
    if (directFrenchToEnglish[cleanKey]) {
      return directFrenchToEnglish[cleanKey];
    }

    return keyOrText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
