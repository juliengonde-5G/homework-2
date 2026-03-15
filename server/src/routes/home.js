const express = require('express');
const prisma = require('../utils/prisma');

const router = express.Router();

// GET /api/home/feed/:userId
router.get('/feed/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const user = await prisma.user.findFirst({
      where: { id: userId, familyId: req.familyId },
      include: { profile: true, userStats: true }
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);

    // Get encouragement based on profile
    const encouragements = getEncouragements(user.profile?.profileType, user.age);
    const encouragement = encouragements[dayOfYear % encouragements.length];

    // Get joke of the day
    const jokes = getJokes(user.age);
    const joke = jokes[dayOfYear % jokes.length];

    // Check birthdays
    const birthdays = await getBirthdaysToday(req.familyId);

    // Get historical events
    const events = await getEventsToday(today);

    // Get streak info
    const streak = user.userStats?.currentStreak || 0;

    res.json({
      encouragement,
      joke,
      birthdays,
      events,
      streak,
      userName: user.name
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

// GET /api/home/events
router.get('/events', async (req, res) => {
  try {
    const today = new Date();
    const events = await getEventsToday(today);
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur' });
  }
});

function getEncouragements(profileType, age) {
  const base = [
    'Chaque jour tu progresses un peu plus !',
    'Tu es capable de grandes choses !',
    'La curiosité est ta plus grande force !',
    'Apprendre, c\'est comme un super pouvoir qui grandit chaque jour !',
    'Bravo d\'être là aujourd\'hui, c\'est déjà une victoire !',
    'Ton cerveau est un champion en entraînement !',
    'Chaque exercice te rend plus fort(e) !',
    'Tu fais partie des gens qui se donnent les moyens de réussir !',
    'L\'erreur n\'est pas un échec, c\'est un apprentissage !',
    'Continue comme ça, tu es sur le bon chemin !'
  ];

  const pcmSpecific = {
    promoteur: ['Aujourd\'hui, vise le top !', 'C\'est le moment de relever un défi !'],
    rebelle: ['Aujourd\'hui, surprends-toi !', 'Prêt(e) à apprendre en s\'amusant ?'],
    imagineur: ['Laisse ta créativité s\'exprimer !', 'Imagine tout ce que tu peux apprendre aujourd\'hui !'],
    analyseur: ['Chaque fait nouveau est une pièce du puzzle !', 'Logique + persévérance = succès !'],
    empathique: ['Tu rends tes proches fiers !', 'Ton travail inspire les autres !'],
    reveur: ['Prends ton temps, tu avances à ton rythme !', 'Chaque pas compte, même les petits !']
  };

  return [...base, ...(pcmSpecific[profileType] || [])];
}

function getJokes(age) {
  if (age && age <= 10) {
    return [
      'Pourquoi les plongeurs plongent-ils toujours en arrière ? Parce que sinon ils tomberaient dans le bateau ! 😄',
      'Que dit une imprimante dans la mer ? J\'ai papier ! 😂',
      'Pourquoi les maths sont tristes ? Parce qu\'elles ont trop de problèmes ! 😆',
      'Comment appelle-t-on un chat tombé dans un pot de peinture le jour de Noël ? Un chat-peint de Noël ! 🎄',
      'Quel est le sport préféré des insectes ? Le cri-cket ! 🦗'
    ];
  }
  return [
    'Un algorithme entre dans un bar et demande une boisson. Le barman lui dit : « Désolé, on ne sert pas les boucles infinies. » 😄',
    'Les maths et moi, c\'est une relation complexe. Elle a des problèmes, j\'ai pas de solutions. 😂',
    'Pourquoi le livre de maths est-il toujours triste ? Parce qu\'il a trop de problèmes ! 📚',
    'L\'anglais c\'est facile : « time flies » = le temps file. « Fruit flies » = petites mouches. Logique ! 🪰',
    'Un electron entre dans un bar : « C\'est gratuit pour les particules ? — Non, c\'est toujours au prix courant. » ⚡'
  ];
}

async function getBirthdaysToday(familyId) {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  // Check family members birthdays
  const users = await prisma.user.findMany({
    where: { familyId },
    select: { name: true, birthday: true, avatar: true }
  });

  return users
    .filter(u => u.birthday && u.birthday.getMonth() + 1 === month && u.birthday.getDate() === day)
    .map(u => ({ name: u.name, avatar: u.avatar }));
}

async function getEventsToday(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Try to get from DB first
  const dbEvents = await prisma.event.findMany({
    where: {
      date: {
        gte: new Date(date.getFullYear(), month - 1, day),
        lt: new Date(date.getFullYear(), month - 1, day + 1)
      }
    }
  });

  if (dbEvents.length > 0) return dbEvents;

  // Fallback: some hardcoded famous dates
  const famousDates = {
    '1-1': [{ title: 'Jour de l\'An', category: 'culture' }],
    '3-14': [{ title: 'Journée de Pi (π = 3,14...)', category: 'science' }],
    '3-8': [{ title: 'Journée internationale des droits des femmes', category: 'histoire' }],
    '4-12': [{ title: 'Premier homme dans l\'espace (Youri Gagarine, 1961)', category: 'science' }],
    '7-20': [{ title: 'Premier pas sur la Lune (1969)', category: 'science' }],
    '11-9': [{ title: 'Chute du mur de Berlin (1989)', category: 'histoire' }],
    '12-10': [{ title: 'Journée des droits de l\'homme', category: 'culture' }]
  };

  return famousDates[`${month}-${day}`] || [];
}

module.exports = router;
