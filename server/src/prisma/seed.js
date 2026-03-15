const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo family
  const family = await prisma.family.create({
    data: { name: 'Famille Démo' }
  });

  // Create parent
  const parentHash = await bcrypt.hash('demo2024', 12);
  const parent = await prisma.user.create({
    data: {
      familyId: family.id,
      name: 'Julien',
      email: 'parent@demo.fr',
      passwordHash: parentHash,
      role: 'parent'
    }
  });

  // Create children with profiles matching the spec
  const children = [
    {
      name: 'Ilan',
      age: 14,
      avatar: '🌍',
      birthday: new Date('2012-03-15'),
      profile: {
        profileType: 'analyseur',
        learningModalities: { lecture: 4, oral: 3, image: 3, kinesthesique: 2 },
        interests: ['geopolitique', 'histoire', 'sciences'],
        discoveryCompleted: true,
        adviceTips: {
          strengths: ['Analyse approfondie', 'Rigueur', 'Capacité de synthèse'],
          tips: ['Fais des fiches structurées', 'Utilise des cartes mentales', 'Prends le temps de comprendre avant d\'apprendre'],
          bestTimeToStudy: 'Le matin, quand tu es le plus concentré',
          encouragement: 'Ta rigueur est une vraie force !'
        }
      },
      pathway: {
        type: 'project',
        projectTheme: 'Géopolitique et relations internationales',
        status: 'active'
      }
    },
    {
      name: 'Sacha',
      age: 12,
      avatar: '🤖',
      birthday: new Date('2014-06-22'),
      profile: {
        profileType: 'promoteur',
        learningModalities: { lecture: 2, oral: 3, image: 4, kinesthesique: 5 },
        interests: ['tech', 'robotique', 'jeux', 'espace'],
        discoveryCompleted: true,
        adviceTips: {
          strengths: ['Esprit de défi', 'Rapidité', 'Pragmatisme'],
          tips: ['Fixe-toi des objectifs courts', 'Transforme les leçons en défis', 'Pratique dès que possible'],
          bestTimeToStudy: 'Quand tu as de l\'énergie à revendre',
          encouragement: 'Tu adores les challenges, chaque leçon en est un !'
        }
      },
      pathway: {
        type: 'project',
        projectTheme: 'Robotique et Intelligence Artificielle',
        status: 'active'
      }
    },
    {
      name: 'Adan',
      age: 10,
      avatar: '🎨',
      birthday: new Date('2016-01-08'),
      profile: {
        profileType: 'imagineur',
        learningModalities: { lecture: 2, oral: 3, image: 5, kinesthesique: 4 },
        interests: ['arts', 'mode', 'cinema', 'musique'],
        discoveryCompleted: true,
        adviceTips: {
          strengths: ['Créativité', 'Imagination', 'Sensibilité artistique'],
          tips: ['Dessine pour retenir', 'Crée des histoires autour des leçons', 'Utilise les couleurs dans tes notes'],
          bestTimeToStudy: 'Quand tu te sens inspiré',
          encouragement: 'Ton imagination est un trésor !'
        }
      },
      pathway: {
        type: 'project',
        projectTheme: 'Arts, couture et miniaturisme',
        status: 'active'
      }
    }
  ];

  for (const child of children) {
    const user = await prisma.user.create({
      data: {
        familyId: family.id,
        name: child.name,
        age: child.age,
        avatar: child.avatar,
        birthday: child.birthday,
        role: 'child'
      }
    });

    await prisma.profile.create({
      data: { userId: user.id, ...child.profile }
    });

    await prisma.pathway.create({
      data: { userId: user.id, ...child.pathway }
    });

    await prisma.userStats.create({
      data: {
        userId: user.id,
        totalMinutes: Math.floor(Math.random() * 500) + 100,
        totalSessions: Math.floor(Math.random() * 30) + 5,
        currentStreak: Math.floor(Math.random() * 10),
        longestStreak: Math.floor(Math.random() * 20) + 5,
        level: Math.floor(Math.random() * 5) + 1,
        xp: Math.floor(Math.random() * 500) + 50
      }
    });

    // Create discovery sessions (completed)
    const steps = ['interests', 'learning', 'pcm', 'pathway_choice', 'career'];
    for (let i = 0; i < steps.length; i++) {
      await prisma.discoverySession.create({
        data: {
          userId: user.id,
          stepNumber: i + 1,
          stepType: steps[i],
          responses: { completed: true },
          completedAt: new Date()
        }
      });
    }

    console.log(`  ✅ ${child.name} (${child.age} ans, ${child.profile.profileType})`);
  }

  // Create adult users (Ophélie and Julien's adult profiles)
  const adults = [
    {
      name: 'Ophélie',
      age: 35,
      avatar: '👩‍💼',
      profile: {
        profileType: 'empathique',
        learningModalities: { lecture: 4, oral: 4, image: 3, kinesthesique: 2 },
        interests: ['management', 'communication', 'psychologie'],
        discoveryCompleted: true
      },
      pathway: { type: 'project', projectTheme: 'Formation management et leadership', status: 'active' }
    },
    {
      name: 'Julien (Adulte)',
      age: 38,
      avatar: '👨‍💻',
      profile: {
        profileType: 'promoteur',
        learningModalities: { lecture: 3, oral: 3, image: 4, kinesthesique: 4 },
        interests: ['tech', 'entrepreneuriat', 'data'],
        discoveryCompleted: true
      },
      pathway: { type: 'project', projectTheme: 'Data Science et IA appliquée', status: 'active' }
    }
  ];

  for (const adult of adults) {
    const user = await prisma.user.create({
      data: {
        familyId: family.id,
        name: adult.name,
        age: adult.age,
        avatar: adult.avatar,
        role: 'child' // adults use same role for pathways
      }
    });

    await prisma.profile.create({
      data: { userId: user.id, ...adult.profile }
    });

    await prisma.pathway.create({
      data: { userId: user.id, ...adult.pathway }
    });

    await prisma.userStats.create({
      data: { userId: user.id }
    });

    console.log(`  ✅ ${adult.name} (adulte, ${adult.profile.profileType})`);
  }

  // Seed badges
  const badges = [
    { code: 'first_session', name: 'Premier pas', description: 'Tu as complété ta première session !', icon: '🌟', category: 'streak', threshold: 1 },
    { code: 'streak_3', name: 'Régulier', description: '3 jours consécutifs !', icon: '🔥', category: 'streak', threshold: 3 },
    { code: 'streak_7', name: 'Assidu', description: 'Une semaine complète !', icon: '💪', category: 'streak', threshold: 7 },
    { code: 'streak_30', name: 'Champion', description: 'Un mois sans interruption !', icon: '🏆', category: 'streak', threshold: 30 },
    { code: 'mastery_first', name: 'Première maîtrise', description: 'Score parfait sur un exercice !', icon: '⭐', category: 'mastery', threshold: 100 },
    { code: 'explorer', name: 'Explorateur', description: 'Tu as exploré 5 matières différentes', icon: '🧭', category: 'exploration', threshold: 5 },
    { code: 'curious', name: 'Curieux', description: '10 questions posées à l\'agent', icon: '❓', category: 'exploration', threshold: 10 },
    { code: 'level_5', name: 'Niveau 5', description: 'Tu as atteint le niveau 5 !', icon: '🎯', category: 'mastery', threshold: 5 },
    { code: 'level_10', name: 'Expert', description: 'Tu as atteint le niveau 10 !', icon: '🎓', category: 'mastery', threshold: 10 }
  ];

  for (const badge of badges) {
    await prisma.badge.create({ data: badge });
  }
  console.log(`  ✅ ${badges.length} badges créés`);

  // Seed some daily tips
  const tips = [
    { category: 'encouragement', content: 'Le saviez-vous ? Votre cerveau crée de nouvelles connexions à chaque fois que vous apprenez quelque chose !', ageMin: 8, ageMax: 18 },
    { category: 'culture', content: 'Aujourd\'hui dans l\'histoire : La Tour Eiffel a été construite en seulement 2 ans, 2 mois et 5 jours !', ageMin: 8, ageMax: 18 },
    { category: 'blague', content: 'Pourquoi le professeur de maths a-t-il mis des lunettes de soleil ? Parce que ses élèves étaient trop brillants !', ageMin: 8, ageMax: 12 }
  ];

  for (const tip of tips) {
    await prisma.dailyTip.create({ data: tip });
  }

  console.log('\n🎉 Seed completed!');
  console.log('\n📧 Login: parent@demo.fr / demo2024');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
