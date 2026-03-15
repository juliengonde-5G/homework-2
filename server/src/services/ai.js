const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Valid PCM types for validation
const VALID_PCM_TYPES = ['promoteur', 'rebelle', 'imagineur', 'analyseur', 'empathique', 'reveur', 'perseverant'];

/**
 * Robust JSON extraction from AI response text.
 * Handles markdown fences, nested objects, and partial responses.
 */
function extractJSON(text) {
  // Try markdown code block first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Try full text as JSON
  try { return JSON.parse(text.trim()); } catch {}

  // Find outermost { ... } with brace balancing
  let start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end === -1) return null;

  try {
    return JSON.parse(text.substring(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Sanitize user input to prevent prompt injection
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  // Remove common prompt injection patterns
  return input
    .replace(/(?:ignore|oublie|forget)\s+(?:all|tout|les|previous|précédent)/gi, '[filtered]')
    .replace(/(?:system|système)\s*(?:prompt|instruction)/gi, '[filtered]')
    .replace(/(?:you are|tu es)\s+(?:now|maintenant|désormais)/gi, '[filtered]')
    .slice(0, 2000); // Limit length
}

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
    temperature: options.temperature ?? 0.7,
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
- IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après
- Format: {title, sections: [{title, content, type: "text"|"image_desc"|"audio_desc"|"interactive", keyPoints: []}], summary, vocabulary: [{term, definition}]}`;

  const userPrompt = `Crée une leçon de ${sanitizeInput(subject)} sur la compétence : "${sanitizeInput(competency)}".
${options.context ? `Contexte additionnel : ${sanitizeInput(options.context)}` : ''}
${profile.interests ? `Centres d'intérêt du jeune : ${JSON.stringify(profile.interests)} - essaie d'y faire référence dans les exemples.` : ''}`;

  const text = await generateContent(systemPrompt, userPrompt, { temperature: 0.7 });

  const parsed = extractJSON(text);
  if (parsed && parsed.title) return parsed;
  return { title: competency, sections: [{ title: 'Leçon', content: text, type: 'text', keyPoints: [] }], summary: '', vocabulary: [] };
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
- IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après
- Format JSON: {exercises: [{id, question, type: "qcm"|"texte_libre"|"vrai_faux"|"association"|"ordre", options?: [], correctAnswer, explanation, difficulty: 1-3, points: number}], totalPoints: number}`;

  const userPrompt = `Crée des exercices de ${sanitizeInput(subject)} pour évaluer la compétence : "${sanitizeInput(competency)}".
Adapté à un jeune de ${options.age || 12} ans.
${profile.interests ? `Thématiser avec ses centres d'intérêt si possible : ${JSON.stringify(profile.interests)}` : ''}`;

  const text = await generateContent(systemPrompt, userPrompt, { temperature: 0.5 });

  const parsed = extractJSON(text);
  if (parsed && parsed.exercises) return parsed;
  return { exercises: [], totalPoints: 0 };
}

/**
 * Analyze discovery responses to build profile
 */
async function analyzeProfile(responses, age) {
  const systemPrompt = `Tu es un psychologue de l'éducation spécialisé dans le Process Communication Model (PCM) adapté aux jeunes.
Tu analyses les réponses d'un questionnaire de découverte pour déterminer :
1. Le profil PCM dominant parmi : promoteur, rebelle, imagineur, analyseur, empathique, reveur, perseverant
2. Les modalités d'apprentissage préférées (scores 0-5 pour: lecture, oral, image, kinesthesique)
3. Des conseils d'apprentissage personnalisés

IMPORTANT :
- Le profil PCM doit être l'un des 7 types exactement : promoteur, rebelle, imagineur, analyseur, empathique, reveur, perseverant
- Ce profilage est indicatif et pédagogique, il ne constitue pas un diagnostic psychologique
- Réponds UNIQUEMENT avec un objet JSON valide

Format JSON: {
  profileType: "promoteur"|"rebelle"|"imagineur"|"analyseur"|"empathique"|"reveur"|"perseverant",
  learningModalities: {lecture: 0-5, oral: 0-5, image: 0-5, kinesthesique: 0-5},
  adviceTips: {strengths: [string], tips: [string], bestTimeToStudy: string, encouragement: string},
  summary: string
}`;

  const userPrompt = `Analyse ces réponses d'un jeune de ${age} ans :
${JSON.stringify(responses, null, 2)}`;

  const text = await generateContent(systemPrompt, userPrompt, { temperature: 0.3 });

  const parsed = extractJSON(text);
  if (!parsed) return null;

  // Validate PCM type
  if (parsed.profileType && !VALID_PCM_TYPES.includes(parsed.profileType)) {
    parsed.profileType = 'empathique'; // Safe default
  }

  return parsed;
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
- Tu ne réponds qu'à des questions liées à l'apprentissage et à la culture générale
- Si on te demande de faire autre chose (écrire du code, des histoires inappropriées, etc.), refuse poliment et ramène la conversation à l'apprentissage

CENTRES D'INTÉRÊT DU JEUNE : ${interests}
${context.currentSubject ? `MATIÈRE EN COURS : ${context.currentSubject}` : ''}
${context.currentLesson ? `LEÇON EN COURS : ${context.currentLesson}` : ''}

IMPORTANT : Adapte ton vocabulaire à l'âge. Sois dynamique, utilise des analogies.`;

  const sanitizedMessage = sanitizeInput(message);

  const messages = [
    ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: sanitizedMessage }
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    temperature: 0.8,
    system: systemPrompt,
    messages
  });

  return response.content[0].text;
}

/**
 * Generate daily program based on pathway
 */
async function generateDailyProgram(profile, pathway, progress, options = {}) {
  const pcmTone = getPcmTone(profile.profileType);

  const systemPrompt = `Tu es un planificateur pédagogique. Tu crées un programme quotidien de 45 minutes pour un jeune.
${pcmTone}

RÈGLES :
- 45 minutes total recommandées, répartition libre
- Alterner leçons et exercices
- Chaque bloc : 10-15 min
- Adapter au niveau et à la progression
- IMPORTANT : Réponds UNIQUEMENT avec un objet JSON valide
- Format JSON: {blocks: [{id, type: "lesson"|"exercise", subject, competencyLabel, title, durationMinutes, description}], encouragement: string}`;

  const userPrompt = `Crée le programme du jour pour :
- Âge : ${options.age || 12} ans
- Parcours : ${pathway.type}
- Matières : ${getPathwaySubjects(pathway)}
- Progression actuelle : ${JSON.stringify(progress)}
${pathway.projectTheme ? `- Projet : ${sanitizeInput(pathway.projectTheme)}` : ''}
${profile.interests ? `- Intérêts : ${JSON.stringify(profile.interests)}` : ''}`;

  const text = await generateContent(systemPrompt, userPrompt, { temperature: 0.6 });

  const parsed = extractJSON(text);
  if (parsed && parsed.blocks) return parsed;
  return { blocks: [], encouragement: '' };
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
    reveur: 'Ton doux, patient. Laisse le temps de réflexion. Utilise des images et de l\'imagination.',
    perseverant: 'Ton engagé, valorisant l\'effort et la persévérance. Montre les progrès. Encourage la rigueur et la constance.'
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
