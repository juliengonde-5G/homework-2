const express = require('express');
const prisma = require('../utils/prisma');
const { analyzeProfile } = require('../services/ai');

const router = express.Router();

// Discovery steps configuration adapted by age
function getDiscoverySteps(age) {
  return [
    {
      stepNumber: 1,
      stepType: 'interests',
      title: age <= 10 ? 'Qu\'est-ce que tu adores ?' : 'Tes centres d\'intérêt',
      description: age <= 10
        ? 'Choisis les images qui te plaisent le plus !'
        : 'Dis-nous ce qui te passionne pour personnaliser ton parcours.'
    },
    {
      stepNumber: 2,
      stepType: 'learning',
      title: age <= 10 ? 'Comment tu préfères apprendre ?' : 'Tes modalités d\'apprentissage',
      description: age <= 10
        ? 'Choisis ce que tu préfères !'
        : 'Identifie comment tu apprends le mieux.'
    },
    {
      stepNumber: 3,
      stepType: 'pcm',
      title: age <= 10 ? 'Un petit quiz sur toi !' : 'Ta personnalité d\'apprentissage',
      description: age <= 10
        ? 'Réponds à ces questions amusantes !'
        : 'Questionnaire pour adapter ton accompagnement à ta personnalité.'
    },
    {
      stepNumber: 4,
      stepType: 'pathway_choice',
      title: 'Ton parcours',
      description: 'Choisis le type de parcours qui te convient.'
    },
    // Career step only for 13+ (pedagogy: orientation inappropriée avant 13 ans)
    ...(age >= 13 ? [{
      stepNumber: 5,
      stepType: 'career',
      title: 'Orientation et métiers',
      description: 'Découvre des secteurs professionnels et oriente ton parcours.'
    }] : [])
  ];
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

    res.json({ ...step, content, age });
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

    // Handle career focus if step 5
    if (stepNumber === 5 && responses.careerFocus) {
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
    default:
      return {};
  }
}

function getInterestsContent(age) {
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
    instruction: age <= 10
      ? 'Touche les images de ce que tu adores ! (choisis au moins 3)'
      : 'Sélectionne tes centres d\'intérêt (au moins 3)',
    minSelect: 3,
    maxSelect: 8,
    categories
  };
}

function getLearningContent(age) {
  const scenarios = [
    {
      id: 'lecture',
      label: age <= 10 ? 'Lire une histoire' : 'Lire un texte explicatif',
      icon: '📖',
      question: age <= 10
        ? 'Tu préfères quand on te donne un livre à lire ?'
        : 'Tu apprends bien en lisant ?'
    },
    {
      id: 'oral',
      label: age <= 10 ? 'Écouter quelqu\'un raconter' : 'Écouter une explication',
      icon: '🎧',
      question: age <= 10
        ? 'Tu préfères quand quelqu\'un t\'explique en parlant ?'
        : 'Tu retiens mieux quand tu écoutes ?'
    },
    {
      id: 'image',
      label: age <= 10 ? 'Regarder des images et des vidéos' : 'Supports visuels (schémas, vidéos)',
      icon: '🖼️',
      question: age <= 10
        ? 'Tu préfères quand il y a des dessins et des vidéos ?'
        : 'Les schémas et vidéos t\'aident à comprendre ?'
    },
    {
      id: 'kinesthesique',
      label: age <= 10 ? 'Faire des activités avec les mains' : 'Pratiquer, manipuler, expérimenter',
      icon: '🤲',
      question: age <= 10
        ? 'Tu préfères quand tu peux toucher et fabriquer ?'
        : 'Tu apprends mieux en pratiquant ?'
    }
  ];

  return {
    type: 'rating',
    instruction: age <= 10
      ? 'Pour chaque façon d\'apprendre, dis-nous si tu aimes beaucoup, un peu, ou pas trop !'
      : 'Note chaque modalité d\'apprentissage de 1 (pas du tout) à 5 (beaucoup)',
    scale: age <= 10 ? { min: 1, max: 3, labels: ['Pas trop', 'Un peu', 'Beaucoup'] } : { min: 1, max: 5, labels: ['Pas du tout', 'Un peu', 'Moyennement', 'Beaucoup', 'Tout à fait'] },
    scenarios
  };
}

function getPcmContent(age) {
  // PCM questionnaire adapted for young people
  const questions = age <= 10 ? [
    {
      id: 'pcm1',
      question: 'Quand tu as un problème, tu préfères :',
      options: [
        { value: 'promoteur', label: 'Foncer et trouver la solution tout de suite !' },
        { value: 'analyseur', label: 'Réfléchir calmement avant d\'agir' },
        { value: 'empathique', label: 'En parler avec quelqu\'un que tu aimes' },
        { value: 'rebelle', label: 'Inventer une solution rigolote et originale' },
        { value: 'imagineur', label: 'Imaginer plein de solutions dans ta tête' },
        { value: 'reveur', label: 'Attendre un peu et y penser tranquillement' },
        { value: 'perseverant', label: 'Ne pas lâcher jusqu\'à trouver la bonne réponse' }
      ]
    },
    {
      id: 'pcm2',
      question: 'Ce qui te rend le plus content(e) :',
      options: [
        { value: 'promoteur', label: 'Gagner un défi ou un jeu' },
        { value: 'analyseur', label: 'Comprendre comment quelque chose fonctionne' },
        { value: 'empathique', label: 'Faire plaisir à quelqu\'un' },
        { value: 'rebelle', label: 'Faire quelque chose de nouveau et surprenant' },
        { value: 'imagineur', label: 'Créer ou inventer quelque chose' },
        { value: 'reveur', label: 'Avoir du temps pour toi, au calme' },
        { value: 'perseverant', label: 'Finir ce que tu as commencé, même si c\'est dur' }
      ]
    },
    {
      id: 'pcm3',
      question: 'En classe, tu préfères quand :',
      options: [
        { value: 'promoteur', label: 'On fait des compétitions ou des projets rapides' },
        { value: 'analyseur', label: 'On explique bien les règles et le programme' },
        { value: 'empathique', label: 'Le prof est gentil et encourage tout le monde' },
        { value: 'rebelle', label: 'On fait des activités amusantes et variées' },
        { value: 'imagineur', label: 'On peut dessiner, imaginer, créer' },
        { value: 'reveur', label: 'On peut travailler seul à son rythme' },
        { value: 'perseverant', label: 'On doit bien faire les choses et finir son travail' }
      ]
    },
    {
      id: 'pcm4',
      question: 'Quand tu travailles en groupe :',
      options: [
        { value: 'promoteur', label: 'Tu veux être le chef du groupe' },
        { value: 'analyseur', label: 'Tu organises bien le travail' },
        { value: 'empathique', label: 'Tu t\'assures que tout le monde va bien' },
        { value: 'rebelle', label: 'Tu proposes des idées folles et amusantes' },
        { value: 'imagineur', label: 'Tu as plein d\'idées créatives' },
        { value: 'reveur', label: 'Tu préfères faire ta partie tout seul' },
        { value: 'perseverant', label: 'Tu vérifies que tout est bien fait' }
      ]
    },
    {
      id: 'pcm5',
      question: 'Le weekend idéal pour toi c\'est :',
      options: [
        { value: 'promoteur', label: 'Faire du sport ou un défi excitant' },
        { value: 'analyseur', label: 'Construire ou apprendre quelque chose de nouveau' },
        { value: 'empathique', label: 'Passer du temps avec ta famille ou tes amis' },
        { value: 'rebelle', label: 'Faire la fête ou une activité surprenante' },
        { value: 'imagineur', label: 'Créer, dessiner, écrire des histoires' },
        { value: 'reveur', label: 'Rester tranquille et rêver' },
        { value: 'perseverant', label: 'Terminer un projet ou une activité commencée' }
      ]
    }
  ] : [
    {
      id: 'pcm1',
      question: 'Face à un nouveau projet scolaire, ta première réaction :',
      options: [
        { value: 'promoteur', label: 'Je fonce, je veux être le premier à finir' },
        { value: 'analyseur', label: 'J\'analyse le sujet et je fais un plan' },
        { value: 'empathique', label: 'Je cherche avec qui travailler' },
        { value: 'rebelle', label: 'J\'essaie de trouver un angle original' },
        { value: 'imagineur', label: 'Je laisse mon imagination explorer le sujet' },
        { value: 'reveur', label: 'Je prends du recul pour y réfléchir' },
        { value: 'perseverant', label: 'Je m\'organise pour bien faire, sans rien bâcler' }
      ]
    },
    {
      id: 'pcm2',
      question: 'Ce qui te motive le plus dans les études :',
      options: [
        { value: 'promoteur', label: 'Les résultats et la compétition' },
        { value: 'analyseur', label: 'Comprendre en profondeur' },
        { value: 'empathique', label: 'L\'ambiance et les relations avec les profs/camarades' },
        { value: 'rebelle', label: 'Les matières créatives et les projets libres' },
        { value: 'imagineur', label: 'Quand je peux exprimer ma créativité' },
        { value: 'reveur', label: 'Quand je peux travailler à mon rythme' },
        { value: 'perseverant', label: 'Quand je vois que mes efforts portent leurs fruits' }
      ]
    },
    {
      id: 'pcm3',
      question: 'Quand tu es stressé(e) par un contrôle :',
      options: [
        { value: 'promoteur', label: 'Je me challenge : "je vais cartonner"' },
        { value: 'analyseur', label: 'Je révise méthodiquement avec des fiches' },
        { value: 'empathique', label: 'J\'en parle à mes proches pour me rassurer' },
        { value: 'rebelle', label: 'Je décompresse avec une activité fun' },
        { value: 'imagineur', label: 'Je m\'isole pour me concentrer à ma façon' },
        { value: 'reveur', label: 'Je prends du temps calme pour me recentrer' },
        { value: 'perseverant', label: 'Je révise encore plus, je ne lâche rien' }
      ]
    },
    {
      id: 'pcm4',
      question: 'Le type de cours que tu préfères :',
      options: [
        { value: 'promoteur', label: 'Des cours dynamiques avec des défis' },
        { value: 'analyseur', label: 'Des cours structurés et logiques' },
        { value: 'empathique', label: 'Des cours avec de l\'échange et du partage' },
        { value: 'rebelle', label: 'Des cours ludiques et interactifs' },
        { value: 'imagineur', label: 'Des cours qui laissent place à la création' },
        { value: 'reveur', label: 'Des cours calmes où on peut réfléchir' },
        { value: 'perseverant', label: 'Des cours exigeants qui poussent à se dépasser' }
      ]
    },
    {
      id: 'pcm5',
      question: 'Ton rapport aux règles et consignes :',
      options: [
        { value: 'promoteur', label: 'Je les respecte si elles mènent au résultat' },
        { value: 'analyseur', label: 'Je les suis rigoureusement' },
        { value: 'empathique', label: 'Je les respecte par respect pour les autres' },
        { value: 'rebelle', label: 'Je les questionne et les adapte à ma sauce' },
        { value: 'imagineur', label: 'Je les interprète de façon créative' },
        { value: 'reveur', label: 'Je les oublie parfois, absorbé par mes pensées' },
        { value: 'perseverant', label: 'Je les respecte car elles donnent un cadre important' }
      ]
    },
    {
      id: 'pcm6',
      question: 'Ce que tu valorises le plus :',
      options: [
        { value: 'promoteur', label: 'L\'efficacité et les résultats concrets' },
        { value: 'analyseur', label: 'La précision et la rigueur' },
        { value: 'empathique', label: 'La bienveillance et l\'harmonie' },
        { value: 'rebelle', label: 'La liberté et l\'originalité' },
        { value: 'imagineur', label: 'L\'imagination et l\'expression' },
        { value: 'reveur', label: 'Le calme et l\'introspection' },
        { value: 'perseverant', label: 'L\'engagement et la persévérance' }
      ]
    }
  ];

  return {
    type: 'pcm_quiz',
    instruction: age <= 10
      ? 'Pour chaque question, choisis la réponse qui te ressemble le plus !'
      : 'Choisis pour chaque situation la réponse qui te correspond le mieux.',
    questions
  };
}

function getPathwayChoiceContent(age) {
  return {
    type: 'pathway_select',
    instruction: 'Quel parcours te correspond le mieux ?',
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
        inputOptions: [
          'Histoire-Géographie', 'Physique-Chimie', 'SVT', 'Espagnol', 'Allemand',
          'Technologie', 'Arts plastiques', 'Musique', 'EPS', 'Philosophie',
          'SES', 'NSI', 'Latin', 'Grec'
        ]
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
    instruction: age <= 13
      ? 'Quels métiers te font rêver ? Choisis les domaines qui t\'attirent !'
      : 'Explore les secteurs qui t\'intéressent pour orienter ton parcours.',
    sectors,
    allowCustom: true,
    maxSelect: 3
  };
}

module.exports = router;
