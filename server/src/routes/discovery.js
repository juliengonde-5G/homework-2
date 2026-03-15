const express = require('express');
const prisma = require('../utils/prisma');
const { analyzeProfile } = require('../services/ai');

const router = express.Router();

// ─── Cycle-based age thresholds ─────────────────────────────────────
const CYCLE_THRESHOLDS = {
  cycle3: { min: 0, max: 11 },   // CM1-CM2-6e
  cycle4: { min: 12, max: 15 },  // 5e-4e-3e
  lycee:  { min: 16, max: 99 }   // 2nde+
};

function getCycle(age) {
  if (age <= CYCLE_THRESHOLDS.cycle3.max) return 'cycle3';
  if (age <= CYCLE_THRESHOLDS.cycle4.max) return 'cycle4';
  return 'lycee';
}

// Subjects valid per cycle (used to filter pathway options)
const SUBJECTS_BY_CYCLE = {
  cycle3: [
    'Histoire-Géographie', 'SVT', 'Technologie',
    'Arts plastiques', 'Musique', 'EPS', 'Espagnol', 'Allemand'
  ],
  cycle4: [
    'Histoire-Géographie', 'Physique-Chimie', 'SVT', 'Espagnol', 'Allemand',
    'Technologie', 'Arts plastiques', 'Musique', 'EPS',
    'Latin', 'Grec'
  ],
  lycee: [
    'Histoire-Géographie', 'Physique-Chimie', 'SVT', 'Espagnol', 'Allemand',
    'Technologie', 'Arts plastiques', 'Musique', 'EPS', 'Philosophie',
    'SES', 'NSI', 'Latin', 'Grec'
  ]
};

// Discovery steps configuration adapted by age
function getDiscoverySteps(age) {
  const cycle = getCycle(age);
  const steps = [
    {
      stepNumber: 1,
      stepType: 'interests',
      title: cycle === 'cycle3' ? 'Qu\'est-ce que tu adores ?' : 'Tes centres d\'intérêt',
      description: cycle === 'cycle3'
        ? 'Choisis les images qui te plaisent le plus !'
        : 'Dis-nous ce qui te passionne pour personnaliser ton parcours.'
    },
    {
      stepNumber: 2,
      stepType: 'learning',
      title: cycle === 'cycle3' ? 'Comment tu préfères apprendre ?' : 'Tes modalités d\'apprentissage',
      description: cycle === 'cycle3'
        ? 'Choisis ce que tu préfères !'
        : 'Identifie comment tu apprends le mieux.'
    },
    {
      stepNumber: 3,
      stepType: 'pcm',
      title: cycle === 'cycle3' ? 'Un petit quiz sur toi !' : 'Ta personnalité d\'apprentissage',
      description: cycle === 'cycle3'
        ? 'Réponds à ces questions amusantes !'
        : 'Questionnaire pour adapter ton accompagnement à ta personnalité.'
    },
    {
      stepNumber: 4,
      stepType: 'pathway_choice',
      title: 'Ton parcours',
      description: 'Choisis le type de parcours qui te convient.'
    }
  ];

  // Step 5: career for age 13+, exploratory interests for younger children
  if (age >= 13) {
    steps.push({
      stepNumber: 5,
      stepType: 'career',
      title: cycle === 'lycee' ? 'Ton projet d\'avenir' : 'Orientation et métiers',
      description: cycle === 'lycee'
        ? 'Explore les métiers et affine ton orientation.'
        : 'Découvre des secteurs professionnels et oriente ton parcours.'
    });
  } else {
    steps.push({
      stepNumber: 5,
      stepType: 'exploratory_interests',
      title: 'Quand tu seras grand(e)...',
      description: 'Qu\'est-ce que tu aimerais découvrir plus tard ? Pas besoin de choisir un métier, juste ce qui te fait rêver !'
    });
  }

  return steps;
}

// GET /api/discovery/status/:userId
router.get('/status/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true }
    });

    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const sessions = await prisma.discoverySession.findMany({
      where: { userId },
      orderBy: { stepNumber: 'asc' }
    });

    const steps = getDiscoverySteps(user.age || 12);
    const completedSteps = sessions.filter(s => s.completedAt).map(s => s.stepNumber);
    const currentStep = completedSteps.length < steps.length
      ? steps.find(s => !completedSteps.includes(s.stepNumber))
      : null;

    res.json({
      userId,
      age: user.age,
      cycle: getCycle(user.age || 12),
      totalSteps: steps.length,
      completedSteps,
      currentStep,
      steps: steps.map(s => ({
        ...s,
        completed: completedSteps.includes(s.stepNumber),
        responses: sessions.find(sess => sess.stepNumber === s.stepNumber)?.responses || null
      })),
      discoveryCompleted: user.profile?.discoveryCompleted || false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/discovery/step/:userId/:stepNumber - Get step content
router.get('/step/:userId/:stepNumber', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const stepNumber = parseInt(req.params.stepNumber);

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const age = user.age || 12;
    const steps = getDiscoverySteps(age);
    const step = steps.find(s => s.stepNumber === stepNumber);
    if (!step) return res.status(404).json({ error: 'Étape non trouvée' });

    // Return step with its questions/content
    const content = getStepContent(step.stepType, age);

    res.json({ ...step, content, age, cycle: getCycle(age) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// POST /api/discovery/step - Submit a discovery step
router.post('/step', async (req, res) => {
  try {
    const { userId, stepNumber, responses } = req.body;

    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const steps = getDiscoverySteps(user.age || 12);
    const step = steps.find(s => s.stepNumber === stepNumber);
    if (!step) return res.status(400).json({ error: 'Étape invalide' });

    // Upsert the discovery session
    await prisma.discoverySession.upsert({
      where: { userId_stepNumber: { userId, stepNumber } },
      create: {
        userId,
        stepNumber,
        stepType: step.stepType,
        responses,
        completedAt: new Date()
      },
      update: {
        responses,
        completedAt: new Date()
      }
    });

    // Check if all steps are completed
    const allSessions = await prisma.discoverySession.findMany({
      where: { userId },
      orderBy: { stepNumber: 'asc' }
    });

    const allCompleted = steps.every(s =>
      allSessions.some(sess => sess.stepNumber === s.stepNumber && sess.completedAt)
    );

    let profileResult = null;

    if (allCompleted) {
      // Analyze all responses to build profile
      const allResponses = {};
      for (const sess of allSessions) {
        allResponses[sess.stepType] = sess.responses;
      }

      profileResult = await analyzeProfile(allResponses, user.age || 12);

      if (profileResult) {
        await prisma.profile.update({
          where: { userId },
          data: {
            profileType: profileResult.profileType,
            learningModalities: profileResult.learningModalities,
            interests: allResponses.interests?.selected || [],
            adviceTips: profileResult.adviceTips,
            discoveryCompleted: true
          }
        });
      }
    }

    // Handle pathway creation if step 4 (pathway_choice)
    if (stepNumber === 4 && responses.pathwayType) {
      await prisma.pathway.upsert({
        where: { userId },
        create: {
          userId,
          type: responses.pathwayType,
          targetSubjects: responses.targetSubjects || null,
          projectTheme: responses.projectTheme || null,
          status: 'draft'
        },
        update: {
          type: responses.pathwayType,
          targetSubjects: responses.targetSubjects || null,
          projectTheme: responses.projectTheme || null
        }
      });
    }

    // Handle career focus if step 5 (career only for age 13+)
    if (stepNumber === 5 && step.stepType === 'career' && responses.careerFocus) {
      await prisma.pathway.update({
        where: { userId },
        data: {
          careerFocus: responses.careerFocus,
          status: allCompleted ? 'active' : 'draft'
        }
      });

      await prisma.profile.update({
        where: { userId },
        data: { careerOrientation: responses.careerOrientation || null }
      });
    }

    // Handle exploratory interests if step 5 for younger children
    if (stepNumber === 5 && step.stepType === 'exploratory_interests' && responses.exploratoryInterests) {
      await prisma.profile.update({
        where: { userId },
        data: { careerOrientation: { exploratoryInterests: responses.exploratoryInterests } }
      });

      // Activate pathway if all completed
      if (allCompleted) {
        await prisma.pathway.update({
          where: { userId },
          data: { status: 'active' }
        }).catch(() => {}); // pathway may not exist yet
      }
    }

    res.json({
      success: true,
      stepCompleted: stepNumber,
      allCompleted,
      profileResult: allCompleted ? profileResult : null,
      nextStep: !allCompleted ? steps.find(s => s.stepNumber === stepNumber + 1) : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la soumission' });
  }
});

// GET /api/discovery/result/:userId - Profile result
router.get('/result/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true, pathway: true }
    });

    if (!user || !user.profile?.discoveryCompleted) {
      return res.status(404).json({ error: 'Profil non finalisé' });
    }

    res.json({
      profile: {
        profileType: user.profile.profileType,
        learningModalities: user.profile.learningModalities,
        interests: user.profile.interests,
        adviceTips: user.profile.adviceTips,
        careerOrientation: user.profile.careerOrientation
      },
      pathway: user.pathway ? {
        type: user.pathway.type,
        targetSubjects: user.pathway.targetSubjects,
        projectTheme: user.pathway.projectTheme,
        careerFocus: user.pathway.careerFocus
      } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// ─── Step content generators ─────────────────────────────────────────

function getStepContent(stepType, age) {
  switch (stepType) {
    case 'interests':
      return getInterestsContent(age);
    case 'learning':
      return getLearningContent(age);
    case 'pcm':
      return getPcmContent(age);
    case 'pathway_choice':
      return getPathwayChoiceContent(age);
    case 'career':
      return getCareerContent(age);
    case 'exploratory_interests':
      return getExploratoryInterestsContent(age);
    default:
      return {};
  }
}

function getInterestsContent(age) {
  const cycle = getCycle(age);
  const categories = [
    { id: 'sciences', label: 'Sciences & Nature', icon: '🔬', image: 'microscope and nature' },
    { id: 'tech', label: 'Technologie & Robotique', icon: '🤖', image: 'robot and computer' },
    { id: 'arts', label: 'Arts & Création', icon: '🎨', image: 'painting and music' },
    { id: 'sports', label: 'Sports & Mouvement', icon: '⚽', image: 'sports activities' },
    { id: 'histoire', label: 'Histoire & Géographie', icon: '🌍', image: 'globe and old books' },
    { id: 'geopolitique', label: 'Géopolitique & Actualités', icon: '📰', image: 'world news' },
    { id: 'litterature', label: 'Lecture & Écriture', icon: '📚', image: 'books and writing' },
    { id: 'musique', label: 'Musique', icon: '🎵', image: 'musical instruments' },
    { id: 'cuisine', label: 'Cuisine & Gastronomie', icon: '👨‍🍳', image: 'cooking' },
    { id: 'mode', label: 'Mode & Design', icon: '✂️', image: 'fashion design' },
    { id: 'animaux', label: 'Animaux', icon: '🐾', image: 'animals' },
    { id: 'espace', label: 'Espace & Astronomie', icon: '🚀', image: 'space and stars' },
    { id: 'jeux', label: 'Jeux vidéo & Gaming', icon: '🎮', image: 'gaming' },
    { id: 'cinema', label: 'Cinéma & Séries', icon: '🎬', image: 'movies' },
    { id: 'environnement', label: 'Environnement & Écologie', icon: '🌱', image: 'ecology' },
    { id: 'pompiers', label: 'Secours & Pompiers', icon: '🚒', image: 'firefighters' }
  ];

  return {
    type: 'multi_select',
    instruction: cycle === 'cycle3'
      ? 'Touche les images de ce que tu adores ! (choisis au moins 3)'
      : 'Sélectionne tes centres d\'intérêt (au moins 3)',
    minSelect: 3,
    maxSelect: 8,
    categories
  };
}

function getLearningContent(age) {
  const cycle = getCycle(age);
  const scenarios = [
    {
      id: 'lecture',
      label: cycle === 'cycle3' ? 'Lire une histoire' : 'Lire un texte explicatif',
      icon: '📖',
      question: cycle === 'cycle3'
        ? 'Tu préfères quand on te donne un livre à lire ?'
        : 'Tu apprends bien en lisant ?'
    },
    {
      id: 'oral',
      label: cycle === 'cycle3' ? 'Écouter quelqu\'un raconter' : 'Écouter une explication',
      icon: '🎧',
      question: cycle === 'cycle3'
        ? 'Tu préfères quand quelqu\'un t\'explique en parlant ?'
        : 'Tu retiens mieux quand tu écoutes ?'
    },
    {
      id: 'image',
      label: cycle === 'cycle3' ? 'Regarder des images et des vidéos' : 'Supports visuels (schémas, vidéos)',
      icon: '🖼️',
      question: cycle === 'cycle3'
        ? 'Tu préfères quand il y a des dessins et des vidéos ?'
        : 'Les schémas et vidéos t\'aident à comprendre ?'
    },
    {
      id: 'kinesthesique',
      label: cycle === 'cycle3' ? 'Faire des activités avec les mains' : 'Pratiquer, manipuler, expérimenter',
      icon: '🤲',
      question: cycle === 'cycle3'
        ? 'Tu préfères quand tu peux toucher et fabriquer ?'
        : 'Tu apprends mieux en pratiquant ?'
    }
  ];

  return {
    type: 'rating',
    instruction: cycle === 'cycle3'
      ? 'Pour chaque façon d\'apprendre, dis-nous si tu aimes beaucoup, un peu, ou pas trop !'
      : 'Note chaque modalité d\'apprentissage de 1 (pas du tout) à 5 (énormément)',
    scale: cycle === 'cycle3'
      ? { min: 1, max: 3, labels: ['Pas trop', 'Un peu', 'Beaucoup'] }
      : { min: 1, max: 5, labels: ['Pas du tout', 'Un peu', 'Moyennement', 'Beaucoup', 'Énormément'] },
    scenarios
  };
}

function getPcmContent(age) {
  const cycle = getCycle(age);
  // PCM questionnaire adapted for young people - all 7 types including perseverant
  const questions = cycle === 'cycle3' ? [
    {
      id: 'pcm1',
      question: 'Quand tu as un problème, tu préfères :',
      options: [
        { value: 'promoteur', label: 'Foncer et trouver la solution tout de suite !' },
        { value: 'analyseur', label: 'Réfléchir calmement avant d\'agir' },
        { value: 'perseverant', label: 'Chercher la bonne solution, même si ça prend du temps' },
        { value: 'empathique', label: 'En parler avec quelqu\'un que tu aimes' },
        { value: 'rebelle', label: 'Inventer une solution rigolote et originale' },
        { value: 'imagineur', label: 'Imaginer plein de solutions dans ta tête' },
        { value: 'reveur', label: 'Attendre un peu et y penser tranquillement' }
      ]
    },
    {
      id: 'pcm2',
      question: 'Ce qui te rend le plus content(e) :',
      options: [
        { value: 'promoteur', label: 'Gagner un défi ou un jeu' },
        { value: 'analyseur', label: 'Comprendre comment quelque chose fonctionne' },
        { value: 'perseverant', label: 'Quand on te dit que tu as bien travaillé et que c\'est juste' },
        { value: 'empathique', label: 'Faire plaisir à quelqu\'un' },
        { value: 'rebelle', label: 'Faire quelque chose de nouveau et surprenant' },
        { value: 'imagineur', label: 'Créer ou inventer quelque chose' },
        { value: 'reveur', label: 'Avoir du temps pour toi, au calme' }
      ]
    },
    {
      id: 'pcm3',
      question: 'En classe, tu préfères quand :',
      options: [
        { value: 'promoteur', label: 'On fait des compétitions ou des projets rapides' },
        { value: 'analyseur', label: 'On explique bien les règles et le programme' },
        { value: 'perseverant', label: 'Le prof demande notre avis et écoute nos idées' },
        { value: 'empathique', label: 'Le prof est gentil et encourage tout le monde' },
        { value: 'rebelle', label: 'On fait des activités amusantes et variées' },
        { value: 'imagineur', label: 'On peut dessiner, imaginer, créer' },
        { value: 'reveur', label: 'On peut travailler seul à son rythme' }
      ]
    },
    {
      id: 'pcm4',
      question: 'Quand tu travailles en groupe :',
      options: [
        { value: 'promoteur', label: 'Tu veux être le chef du groupe' },
        { value: 'analyseur', label: 'Tu organises bien le travail' },
        { value: 'perseverant', label: 'Tu vérifies que le travail est bien fait' },
        { value: 'empathique', label: 'Tu t\'assures que tout le monde va bien' },
        { value: 'rebelle', label: 'Tu proposes des idées folles et amusantes' },
        { value: 'imagineur', label: 'Tu as plein d\'idées créatives' },
        { value: 'reveur', label: 'Tu préfères faire ta partie tout seul' }
      ]
    },
    {
      id: 'pcm5',
      question: 'Le weekend idéal pour toi c\'est :',
      options: [
        { value: 'promoteur', label: 'Faire du sport ou un défi excitant' },
        { value: 'analyseur', label: 'Construire ou apprendre quelque chose de nouveau' },
        { value: 'perseverant', label: 'Finir un projet ou aider quelqu\'un à réussir' },
        { value: 'empathique', label: 'Passer du temps avec ta famille ou tes amis' },
        { value: 'rebelle', label: 'Faire la fête ou une activité surprenante' },
        { value: 'imagineur', label: 'Créer, dessiner, écrire des histoires' },
        { value: 'reveur', label: 'Rester tranquille et rêver' }
      ]
    }
  ] : [
    {
      id: 'pcm1',
      question: 'Face à un nouveau projet scolaire, ta première réaction :',
      options: [
        { value: 'promoteur', label: 'Je fonce, je veux être le premier à finir' },
        { value: 'analyseur', label: 'J\'analyse le sujet et je fais un plan' },
        { value: 'perseverant', label: 'Je m\'assure de bien comprendre les attentes et je m\'y tiens' },
        { value: 'empathique', label: 'Je cherche avec qui travailler' },
        { value: 'rebelle', label: 'J\'essaie de trouver un angle original' },
        { value: 'imagineur', label: 'Je laisse mon imagination explorer le sujet' },
        { value: 'reveur', label: 'Je prends du recul pour y réfléchir' }
      ]
    },
    {
      id: 'pcm2',
      question: 'Ce qui te motive le plus dans les études :',
      options: [
        { value: 'promoteur', label: 'Les résultats et la compétition' },
        { value: 'analyseur', label: 'Comprendre en profondeur' },
        { value: 'perseverant', label: 'Défendre mes opinions et mes convictions' },
        { value: 'empathique', label: 'L\'ambiance et les relations avec les profs/camarades' },
        { value: 'rebelle', label: 'Les matières créatives et les projets libres' },
        { value: 'imagineur', label: 'Quand je peux exprimer ma créativité' },
        { value: 'reveur', label: 'Quand je peux travailler à mon rythme' }
      ]
    },
    {
      id: 'pcm3',
      question: 'Quand tu es stressé(e) par un contrôle :',
      options: [
        { value: 'promoteur', label: 'Je me challenge : "je vais cartonner"' },
        { value: 'analyseur', label: 'Je révise méthodiquement avec des fiches' },
        { value: 'perseverant', label: 'Je me concentre sur ce qui est juste et important' },
        { value: 'empathique', label: 'J\'en parle à mes proches pour me rassurer' },
        { value: 'rebelle', label: 'Je décompresse avec une activité fun' },
        { value: 'imagineur', label: 'Je m\'isole pour me concentrer à ma façon' },
        { value: 'reveur', label: 'Je prends du temps calme pour me recentrer' }
      ]
    },
    {
      id: 'pcm4',
      question: 'Le type de cours que tu préfères :',
      options: [
        { value: 'promoteur', label: 'Des cours dynamiques avec des défis' },
        { value: 'analyseur', label: 'Des cours structurés et logiques' },
        { value: 'perseverant', label: 'Des cours où on peut débattre et donner son avis' },
        { value: 'empathique', label: 'Des cours avec de l\'échange et du partage' },
        { value: 'rebelle', label: 'Des cours ludiques et interactifs' },
        { value: 'imagineur', label: 'Des cours qui laissent place à la création' },
        { value: 'reveur', label: 'Des cours calmes où on peut réfléchir' }
      ]
    },
    {
      id: 'pcm5',
      question: 'Ton rapport aux règles et consignes :',
      options: [
        { value: 'promoteur', label: 'Je les respecte si elles mènent au résultat' },
        { value: 'analyseur', label: 'Je les suis rigoureusement' },
        { value: 'perseverant', label: 'Je les respecte si elles sont justes et cohérentes' },
        { value: 'empathique', label: 'Je les respecte par respect pour les autres' },
        { value: 'rebelle', label: 'Je les questionne et les adapte à ma sauce' },
        { value: 'imagineur', label: 'Je les interprète de façon créative' },
        { value: 'reveur', label: 'Je les oublie parfois, absorbé par mes pensées' }
      ]
    },
    {
      id: 'pcm6',
      question: 'Ce que tu valorises le plus :',
      options: [
        { value: 'promoteur', label: 'L\'efficacité et les résultats concrets' },
        { value: 'analyseur', label: 'La précision et la rigueur' },
        { value: 'perseverant', label: 'L\'engagement et la fidélité à ses valeurs' },
        { value: 'empathique', label: 'La bienveillance et l\'harmonie' },
        { value: 'rebelle', label: 'La liberté et l\'originalité' },
        { value: 'imagineur', label: 'L\'imagination et l\'expression' },
        { value: 'reveur', label: 'Le calme et l\'introspection' }
      ]
    }
  ];

  return {
    type: 'pcm_quiz',
    instruction: cycle === 'cycle3'
      ? 'Pour chaque question, choisis la réponse qui te ressemble le plus !'
      : 'Choisis pour chaque situation la réponse qui te correspond le mieux.',
    questions
  };
}

function getPathwayChoiceContent(age) {
  const cycle = getCycle(age);
  const validSubjects = SUBJECTS_BY_CYCLE[cycle] || SUBJECTS_BY_CYCLE.cycle4;

  return {
    type: 'pathway_select',
    instruction: 'Quel parcours te correspond le mieux ?',
    disclaimer: 'Ce choix n\'est pas définitif ! Tu pourras changer de parcours à tout moment. Il sert uniquement à personnaliser tes premières activités et ne constitue en aucun cas une évaluation ou un jugement sur tes capacités.',
    pathways: [
      {
        id: 'back_to_basics',
        label: 'Back to Basics',
        description: 'Français, Maths, Anglais - pour consolider les bases',
        icon: '📐',
        color: '#4F46E5'
      },
      {
        id: 'oriented',
        label: 'Objectif Moyenne',
        description: 'Les bases + renforcement dans les matières où tu veux progresser',
        icon: '📈',
        color: '#059669',
        requiresInput: true,
        inputLabel: 'Dans quelles matières veux-tu progresser ?',
        inputType: 'multi_select',
        inputOptions: validSubjects
      },
      {
        id: 'project',
        label: 'Parcours Projet',
        description: 'Les bases + un projet lié à ta passion',
        icon: '🚀',
        color: '#DC2626',
        requiresInput: true,
        inputLabel: 'Quel est ton projet ou ta passion ?',
        inputType: 'text'
      }
    ]
  };
}

function getCareerContent(age) {
  const sectors = [
    { id: 'sante', label: 'Santé & Bien-être', icon: '🏥', examples: ['Médecin', 'Infirmier', 'Psychologue'] },
    { id: 'tech', label: 'Technologie & Numérique', icon: '💻', examples: ['Développeur', 'Data scientist', 'Cybersécurité'] },
    { id: 'arts', label: 'Arts & Culture', icon: '🎭', examples: ['Artiste', 'Designer', 'Musicien'] },
    { id: 'sciences', label: 'Sciences & Recherche', icon: '🔬', examples: ['Chercheur', 'Ingénieur', 'Astronome'] },
    { id: 'social', label: 'Social & Éducation', icon: '🤝', examples: ['Enseignant', 'Éducateur', 'Travailleur social'] },
    { id: 'environnement', label: 'Environnement & Nature', icon: '🌿', examples: ['Écologue', 'Vétérinaire', 'Agriculteur'] },
    { id: 'commerce', label: 'Commerce & Entreprise', icon: '💼', examples: ['Entrepreneur', 'Marketing', 'Commerce'] },
    { id: 'droit', label: 'Droit & Justice', icon: '⚖️', examples: ['Avocat', 'Juge', 'Policier'] },
    { id: 'media', label: 'Médias & Communication', icon: '📱', examples: ['Journaliste', 'Vidéaste', 'Community manager'] },
    { id: 'sport', label: 'Sport & Loisirs', icon: '🏆', examples: ['Coach sportif', 'Kiné du sport', 'Animateur'] },
    { id: 'securite', label: 'Sécurité & Défense', icon: '🛡️', examples: ['Pompier', 'Militaire', 'Gendarme'] },
    { id: 'artisanat', label: 'Artisanat & Création', icon: '🔨', examples: ['Couturier', 'Ébéniste', 'Boulanger'] }
  ];

  return {
    type: 'career_explorer',
    instruction: 'Explore les secteurs qui t\'intéressent pour orienter ton parcours.',
    sectors,
    allowCustom: true,
    maxSelect: 3
  };
}

function getExploratoryInterestsContent(age) {
  const themes = [
    { id: 'construire', label: 'Construire et fabriquer des choses', icon: '🏗️' },
    { id: 'aider', label: 'Aider les gens et les animaux', icon: '🤗' },
    { id: 'decouvrir', label: 'Découvrir comment les choses fonctionnent', icon: '🔍' },
    { id: 'creer', label: 'Créer des histoires, de la musique, des dessins', icon: '🎨' },
    { id: 'explorer', label: 'Explorer la nature et le monde', icon: '🌍' },
    { id: 'jouer', label: 'Inventer des jeux et des règles', icon: '🎲' },
    { id: 'organiser', label: 'Organiser et ranger les choses', icon: '📋' },
    { id: 'communiquer', label: 'Parler, raconter, expliquer aux autres', icon: '🗣️' },
    { id: 'bouger', label: 'Bouger, courir, faire du sport', icon: '🏃' },
    { id: 'cuisiner', label: 'Cuisiner et inventer des recettes', icon: '🍳' }
  ];

  return {
    type: 'multi_select',
    instruction: 'Qu\'est-ce que tu aimerais faire plus tard ? Choisis tout ce qui te fait rêver !',
    note: 'Pas besoin de choisir un métier. Dis-nous juste ce que tu aimes faire !',
    minSelect: 2,
    maxSelect: 5,
    themes
  };
}

module.exports = router;
