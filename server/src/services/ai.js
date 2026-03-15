const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * Generate content using Claude API
 * @param {string} systemPrompt - System context
 * @param {string} userPrompt - User request
 * @param {object} options - Additional options
 * @returns {string} Generated text
 */
async function generateContent(systemPrompt, userPrompt, options = {}) {
  const response = await anthropic.messages.create({
    model: options.model || 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens || 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  return response.content[0].text;
}

/**
 * Generate a lesson adapted to the learner's profile
 */
async function generateLesson(profile, subject, competency, options = {}) {
  const modalityHints = getModalityHints(profile.learningModalities);
  const pcmTone = getPcmTone(profile.profileType);
  const ageAdaptation = getAgeAdaptation(options.age);

  const systemPrompt = `Tu es un professeur pédagogue expert qui crée des leçons pour des jeunes.
${pcmTone}
${ageAdaptation}

MODALITÉS D'APPRENTISSAGE PRIVILÉGIÉES :
${modalityHints}

RÈGLES :
- Adapte le vocabulaire à l'âge (${options.age || 12} ans)
- Structure claire avec des sections courtes
- Inclus des exemples concrets et des analogies
- Si le sujet est en langue étrangère, écris dans cette langue avec des aides en français
- Format: JSON avec {title, sections: [{title, content, type: "text"|"image_desc"|"audio_desc"|"interactive", keyPoints: []}], summary, vocabulary: [{term, definition}]}`;

  const userPrompt = `Crée une leçon de ${subject} sur la compétence : "${competency}".
${options.context ? `Contexte additionnel : ${options.context}` : ''}
${profile.interests ? `Centres d'intérêt du jeune : ${JSON.stringify(profile.interests)} - essaie d'y faire référence dans les exemples.` : ''}`;

  const text = await generateContent(systemPrompt, userPrompt);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { title: competency, sections: [{ title: 'Leçon', content: text, type: 'text', keyPoints: [] }], summary: '', vocabulary: [] };
  } catch {
    return { title: competency, sections: [{ title: 'Leçon', content: text, type: 'text', keyPoints: [] }], summary: '', vocabulary: [] };
  }
}

/**
 * Generate exercises mapped to a competency
 */
async function generateExercises(profile, subject, competency, options = {}) {
  const pcmTone = getPcmTone(profile.profileType);
  const ageAdaptation = getAgeAdaptation(options.age);

  const systemPrompt = `Tu es un professeur qui crée des exercices de contrôle adaptés.
${pcmTone}
${ageAdaptation}

RÈGLES :
- 3 à 5 exercices progressifs (facile → difficile)
- Chaque exercice a une correction détaillée
- Pas de réponse visible directement (format séparé)
- Format JSON: {exercises: [{id, question, type: "qcm"|"texte_libre"|"vrai_faux"|"association"|"ordre", options?: [], correctAnswer, explanation, difficulty: 1-3, points: number}], totalPoints: number}`;

  const userPrompt = `Crée des exercices de ${subject} pour évaluer la compétence : "${competency}".
Adapté à un jeune de ${options.age || 12} ans.
${profile.interests ? `Thématiser avec ses centres d'intérêt si possible : ${JSON.stringify(profile.interests)}` : ''}`;

  const text = await generateContent(systemPrompt, userPrompt);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { exercises: [], totalPoints: 0 };
  } catch {
    return { exercises: [], totalPoints: 0 };
  }
}

/**
 * Analyze discovery responses to build profile
 */
async function analyzeProfile(responses, age) {
  const systemPrompt = `Tu es un psychologue de l'éducation spécialisé dans le Process Communication Model (PCM) adapté aux jeunes.
Tu analyses les réponses d'un questionnaire de découverte pour déterminer :
1. Le profil PCM dominant (promoteur, rebelle, imagineur, analyseur, empathique, reveur)
2. Les modalités d'apprentissage préférées (scores 0-5 pour: lecture, oral, image, kinesthesique)
3. Des conseils d'apprentissage personnalisés

Réponds en JSON: {
  profileType: "promoteur"|"rebelle"|"imagineur"|"analyseur"|"empathique"|"reveur",
  learningModalities: {lecture: 0-5, oral: 0-5, image: 0-5, kinesthesique: 0-5},
  adviceTips: {strengths: [string], tips: [string], bestTimeToStudy: string, encouragement: string},
  summary: string
}`;

  const userPrompt = `Analyse ces réponses d'un jeune de ${age} ans :
${JSON.stringify(responses, null, 2)}`;

  const text = await generateContent(systemPrompt, userPrompt);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Chat with pedagogical agent
 */
async function chatWithAgent(profile, history, message, context = {}) {
  const pcmTone = getPcmTone(profile.profileType);
  const interests = profile.interests ? JSON.stringify(profile.interests) : '[]';

  const systemPrompt = `Tu es un assistant pédagogique bienveillant pour un jeune de ${context.age || 12} ans.
${pcmTone}

TON RÔLE :
- Aide pédagogique : tu donnes des indices, reformules, expliques autrement
- Tu ne donnes JAMAIS la réponse directe à un exercice
- Tu es un relais culturel : tu fais des liens avec l'actualité, la culture, le monde
- Tu encourages et motives

CENTRES D'INTÉRÊT DU JEUNE : ${interests}
${context.currentSubject ? `MATIÈRE EN COURS : ${context.currentSubject}` : ''}
${context.currentLesson ? `LEÇON EN COURS : ${context.currentLesson}` : ''}

IMPORTANT : Adapte ton vocabulaire à l'âge. Sois dynamique, utilise des analogies.`;

  const messages = [
    ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages
  });

  return response.content[0].text;
}

/**
 * Generate daily program based on pathway
 */
async function generateDailyProgram(profile, pathway, progress, options = {}) {
  const systemPrompt = `Tu es un planificateur pédagogique. Tu crées un programme quotidien de 45 minutes pour un jeune.

RÈGLES :
- 45 minutes total recommandées, répartition libre
- Alterner leçons et exercices
- Chaque bloc : 10-15 min
- Adapter au niveau et à la progression
- Format JSON: {blocks: [{id, type: "lesson"|"exercise", subject, competencyLabel, title, durationMinutes, description}], encouragement: string}`;

  const userPrompt = `Crée le programme du jour pour :
- Âge : ${options.age || 12} ans
- Parcours : ${pathway.type}
- Matières : ${getPathwaySubjects(pathway)}
- Progression actuelle : ${JSON.stringify(progress)}
${pathway.projectTheme ? `- Projet : ${pathway.projectTheme}` : ''}
${profile.interests ? `- Intérêts : ${JSON.stringify(profile.interests)}` : ''}`;

  const text = await generateContent(systemPrompt, userPrompt);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { blocks: [], encouragement: '' };
  } catch {
    return { blocks: [], encouragement: '' };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function getModalityHints(modalities) {
  if (!modalities) return 'Pas de préférence détectée, utilise un mix varié.';
  const m = typeof modalities === 'string' ? JSON.parse(modalities) : modalities;
  const hints = [];
  if (m.lecture >= 4) hints.push('- Privilégie les textes structurés, les lectures');
  if (m.oral >= 4) hints.push('- Privilégie les explications orales, indique que le TTS sera utile');
  if (m.image >= 4) hints.push('- Privilégie les schémas, images, descriptions visuelles');
  if (m.kinesthesique >= 4) hints.push('- Privilégie les exercices pratiques, manipulations');
  return hints.length ? hints.join('\n') : 'Mix équilibré de toutes les modalités.';
}

function getPcmTone(profileType) {
  const tones = {
    promoteur: 'Ton direct, orienté action et résultats. Challenge le jeune. Utilise des défis.',
    rebelle: 'Ton créatif, ludique. Laisse de la liberté. Utilise l\'humour et la surprise.',
    imagineur: 'Ton calme, imaginatif. Laisse le temps. Utilise des métaphores et des histoires.',
    analyseur: 'Ton structuré, logique. Explique le pourquoi. Utilise des schémas et des étapes.',
    empathique: 'Ton chaleureux, encourageant. Valorise les efforts. Utilise des mots positifs.',
    reveur: 'Ton doux, patient. Laisse le temps de réflexion. Utilise des images et de l\'imagination.'
  };
  return tones[profileType] || tones.empathique;
}

function getAgeAdaptation(age) {
  if (!age || age < 8) return 'ADAPTATION : Très simple, très imagé, phrases courtes, beaucoup d\'exemples visuels.';
  if (age <= 10) return 'ADAPTATION : Simple, imagé, exemples concrets du quotidien, vocabulaire accessible.';
  if (age <= 13) return 'ADAPTATION : Structuré mais accessible, exemples variés, début d\'abstraction.';
  if (age <= 16) return 'ADAPTATION : Plus élaboré, raisonnement, liens entre disciplines, culture générale.';
  return 'ADAPTATION : Niveau adulte, analyse, synthèse, ouverture culturelle large.';
}

function getPathwaySubjects(pathway) {
  const base = ['Français', 'Mathématiques', 'Anglais'];
  if (pathway.type === 'back_to_basics') return base.join(', ');
  if (pathway.type === 'oriented' && pathway.targetSubjects) {
    const extra = Array.isArray(pathway.targetSubjects) ? pathway.targetSubjects : [];
    return [...new Set([...base, ...extra])].join(', ');
  }
  if (pathway.type === 'project') {
    return `${base.join(', ')} + Projet: ${pathway.projectTheme || 'non défini'}`;
  }
  return base.join(', ');
}

module.exports = {
  generateContent,
  generateLesson,
  generateExercises,
  analyzeProfile,
  chatWithAgent,
  generateDailyProgram
};
