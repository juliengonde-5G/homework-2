import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { discoveryAPI } from '../services/api';

export default function Discovery() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [currentStepData, setCurrentStepData] = useState(null);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadStatus();
  }, [userId]);

  const loadStatus = async () => {
    try {
      setError(null);
      const res = await discoveryAPI.getStatus(userId);
      setStatus(res.data);

      if (res.data.discoveryCompleted) {
        const resultRes = await discoveryAPI.getResult(userId);
        setResult(resultRes.data);
        setShowResult(true);
      } else if (res.data.currentStep) {
        const stepRes = await discoveryAPI.getStep(userId, res.data.currentStep.stepNumber);
        setCurrentStepData(stepRes.data);
      }
    } catch (err) {
      console.error(err);
      setError('Erreur lors du chargement de l\'étape. Réessaye.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!status?.currentStep) return;
    setSubmitting(true);

    try {
      const res = await discoveryAPI.submitStep({
        userId: parseInt(userId),
        stepNumber: status.currentStep.stepNumber,
        responses
      });

      if (res.data.allCompleted) {
        setResult(res.data.profileResult);
        setShowResult(true);
      } else {
        setResponses({});
        await loadStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mascot text-4xl w-20 h-20 animate-bounce-slow">🦉</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center py-8">
        <p className="text-red-500 mb-2">{error}</p>
        <button type="button" onClick={() => { setError(null); loadStatus(); }} className="btn-secondary text-sm">
          Réessayer
        </button>
      </div>
    </div>
  );

  // Show profile result
  if (showResult && result) {
    return <DiscoveryResult result={result} userId={userId} navigate={navigate} />;
  }

  if (!currentStepData) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card text-center max-w-md">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="font-display text-xl font-bold mb-2">Phase de découverte terminée !</h2>
        <button type="button" onClick={() => navigate(`/home/${userId}`)} className="btn-primary mt-4">
          Commencer mon parcours
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Progress bar */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10 px-4 py-3">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between items-center mb-2">
            <h1 className="font-display text-lg font-bold text-primary-800">Phase de découverte</h1>
            <span className="text-sm font-medium text-primary-600">
              Étape {status.currentStep.stepNumber}/{status.totalSteps}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <motion.div
              className="h-2 bg-primary-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(status.completedSteps.length / status.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStepData.stepNumber}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <h2 className="font-display text-2xl font-bold text-primary-800 mb-2">
              {currentStepData.title}
            </h2>
            <p className="text-gray-500 mb-6">{currentStepData.description}</p>

            {/* Render step content based on type */}
            <StepContent
              content={currentStepData.content}
              responses={responses}
              setResponses={setResponses}
              age={status.age}
            />

            {/* Submit button */}
            <div className="mt-8 text-center">
              <button
                onClick={handleSubmit}
                disabled={submitting || !isStepValid(currentStepData.content, responses)}
                className="btn-primary px-10"
              >
                {submitting ? 'Analyse en cours...' :
                 status.currentStep.stepNumber === status.totalSteps ? 'Terminer' : 'Suivant →'}
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepContent({ content, responses, setResponses, age }) {
  if (!content) return null;

  switch (content.type) {
    case 'multi_select':
      return <MultiSelectStep content={content} responses={responses} setResponses={setResponses} />;
    case 'rating':
      return <RatingStep content={content} responses={responses} setResponses={setResponses} age={age} />;
    case 'pcm_quiz':
      return <PcmQuizStep content={content} responses={responses} setResponses={setResponses} />;
    case 'pathway_select':
      return <PathwaySelectStep content={content} responses={responses} setResponses={setResponses} />;
    case 'career_explorer':
      return <CareerExplorerStep content={content} responses={responses} setResponses={setResponses} />;
    default:
      return <p className="text-gray-500">Type d'étape inconnu</p>;
  }
}

function MultiSelectStep({ content, responses, setResponses }) {
  const selected = responses.selected || [];

  const toggle = (id) => {
    const newSelected = selected.includes(id)
      ? selected.filter(s => s !== id)
      : selected.length < (content.maxSelect || 99)
        ? [...selected, id]
        : selected;
    setResponses({ ...responses, selected: newSelected });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{content.instruction}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {content.categories.map(cat => (
          <motion.button
            key={cat.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => toggle(cat.id)}
            className={`p-4 rounded-2xl text-center transition-all border-2 ${
              selected.includes(cat.id)
                ? 'border-primary-400 bg-primary-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-3xl mb-2">{cat.icon}</div>
            <p className="text-sm font-medium">{cat.label}</p>
          </motion.button>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2 text-center">
        {selected.length}/{content.minSelect} minimum sélectionné(s)
      </p>
    </div>
  );
}

function RatingStep({ content, responses, setResponses, age }) {
  const ratings = responses.ratings || {};

  const setRating = (id, value) => {
    setResponses({ ...responses, ratings: { ...ratings, [id]: value } });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{content.instruction}</p>
      <div className="space-y-6">
        {content.scenarios.map(scenario => (
          <div key={scenario.id} className="card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{scenario.icon}</span>
              <div>
                <p className="font-medium">{scenario.label}</p>
                <p className="text-sm text-gray-400">{scenario.question}</p>
              </div>
            </div>
            <div className="flex justify-center gap-2">
              {Array.from({ length: content.scale.max }, (_, i) => i + 1).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setRating(scenario.id, val)}
                  className={`w-12 h-12 rounded-xl font-bold transition-all ${
                    ratings[scenario.id] === val
                      ? 'bg-primary-500 text-white scale-110 shadow-lg'
                      : ratings[scenario.id] > val
                        ? 'bg-primary-200 text-primary-700'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {age <= 10 ? content.scale.labels[val - 1] : val}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PcmQuizStep({ content, responses, setResponses }) {
  const answers = responses.answers || {};

  const setAnswer = (qId, value) => {
    setResponses({ ...responses, answers: { ...answers, [qId]: value } });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{content.instruction}</p>
      <div className="space-y-6">
        {content.questions.map((q, qi) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: qi * 0.1 }}
            className="card"
          >
            <p className="font-medium mb-3">{q.question}</p>
            <div className="space-y-2">
              {q.options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswer(q.id, opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                    answers[q.id] === opt.value
                      ? 'bg-primary-100 border-2 border-primary-400 font-medium'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function PathwaySelectStep({ content, responses, setResponses }) {
  const [extraInput, setExtraInput] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState([]);

  const selectPathway = (id) => {
    setResponses({
      ...responses,
      pathwayType: id,
      targetSubjects: id === 'oriented' ? selectedSubjects : undefined,
      projectTheme: id === 'project' ? extraInput : undefined
    });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{content.instruction}</p>
      <div className="space-y-4">
        {content.pathways.map(p => (
          <motion.div key={p.id} whileTap={{ scale: 0.98 }}>
            <button
              type="button"
              onClick={() => selectPathway(p.id)}
              className={`w-full text-left card transition-all ${
                responses.pathwayType === p.id
                  ? 'ring-2 ring-primary-400 shadow-md'
                  : 'hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl" style={{ filter: `drop-shadow(0 0 8px ${p.color}40)` }}>
                  {p.icon}
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg">{p.label}</h3>
                  <p className="text-sm text-gray-500">{p.description}</p>
                </div>
              </div>
            </button>

            {/* Extra input for oriented/project */}
            {responses.pathwayType === p.id && p.requiresInput && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="mt-3 ml-4"
              >
                <label className="text-sm font-medium text-gray-600">{p.inputLabel}</label>
                {p.inputType === 'multi_select' ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.inputOptions.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const newSel = selectedSubjects.includes(opt)
                            ? selectedSubjects.filter(s => s !== opt)
                            : [...selectedSubjects, opt];
                          setSelectedSubjects(newSel);
                          setResponses({ ...responses, pathwayType: p.id, targetSubjects: newSel });
                        }}
                        className={`badge-pill transition-all ${
                          selectedSubjects.includes(opt)
                            ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={extraInput}
                    onChange={e => {
                      setExtraInput(e.target.value);
                      setResponses({ ...responses, pathwayType: p.id, projectTheme: e.target.value });
                    }}
                    className="input-field mt-2"
                    placeholder="Ex: Robotique, Géopolitique, Arts..."
                  />
                )}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CareerExplorerStep({ content, responses, setResponses }) {
  const selected = responses.sectors || [];
  const [customInput, setCustomInput] = useState('');

  const toggle = (id) => {
    const newSelected = selected.includes(id)
      ? selected.filter(s => s !== id)
      : selected.length < content.maxSelect
        ? [...selected, id]
        : selected;
    setResponses({
      ...responses,
      sectors: newSelected,
      careerFocus: newSelected,
      careerOrientation: { sectors: newSelected, custom: customInput || undefined }
    });
  };

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{content.instruction}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {content.sectors.map(sector => (
          <motion.button
            key={sector.id}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => toggle(sector.id)}
            className={`p-4 rounded-2xl text-center transition-all border-2 ${
              selected.includes(sector.id)
                ? 'border-primary-400 bg-primary-50 shadow-md'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="text-3xl mb-1">{sector.icon}</div>
            <p className="text-sm font-medium">{sector.label}</p>
            <p className="text-xs text-gray-400 mt-1">
              {sector.examples.slice(0, 2).join(', ')}
            </p>
          </motion.button>
        ))}
      </div>

      {content.allowCustom && (
        <div className="mt-4">
          <input
            type="text"
            value={customInput}
            onChange={e => {
              setCustomInput(e.target.value);
              setResponses({
                ...responses,
                sectors: selected,
                careerOrientation: { sectors: selected, custom: e.target.value }
              });
            }}
            className="input-field"
            placeholder="Autre métier ou domaine qui t'intéresse..."
          />
        </div>
      )}
    </div>
  );
}

function DiscoveryResult({ result, userId, navigate }) {
  const pcmLabels = {
    promoteur: { label: 'Promoteur', emoji: '🚀', color: 'bg-red-100 text-red-700' },
    rebelle: { label: 'Rebelle', emoji: '🎸', color: 'bg-purple-100 text-purple-700' },
    imagineur: { label: 'Imagineur', emoji: '🎨', color: 'bg-pink-100 text-pink-700' },
    analyseur: { label: 'Analyseur', emoji: '🔬', color: 'bg-blue-100 text-blue-700' },
    empathique: { label: 'Empathique', emoji: '💚', color: 'bg-green-100 text-green-700' },
    reveur: { label: 'Rêveur', emoji: '☁️', color: 'bg-cyan-100 text-cyan-700' },
  };

  const pcm = pcmLabels[result?.profileType] || pcmLabels.empathique;
  const tips = result?.adviceTips || {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white px-4 py-8">
      <div className="max-w-lg mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="text-6xl mb-4">{pcm.emoji}</div>
          <h1 className="font-display text-3xl font-bold text-primary-800">Ton profil est prêt !</h1>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card">
          <h3 className="font-display font-semibold mb-2">Ta personnalité d'apprentissage</h3>
          <span className={`badge-pill ${pcm.color} text-lg px-4 py-2`}>
            {pcm.emoji} {pcm.label}
          </span>
          {result?.summary && <p className="text-gray-600 mt-3 text-sm">{result.summary}</p>}
        </motion.div>

        {result?.learningModalities && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card">
            <h3 className="font-display font-semibold mb-3">Comment tu apprends le mieux</h3>
            <div className="space-y-2">
              {Object.entries(result.learningModalities).map(([key, value]) => {
                const labels = { lecture: '📖 Lecture', oral: '🎧 Oral', image: '🖼️ Visuel', kinesthesique: '🤲 Pratique' };
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-24">{labels[key] || key}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full">
                      <div className="h-3 bg-primary-400 rounded-full transition-all"
                        style={{ width: `${(value / 5) * 100}%` }} />
                    </div>
                    <span className="text-sm text-gray-400">{value}/5</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {tips.tips && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="card bg-accent-green/5 border-accent-green/20">
            <h3 className="font-display font-semibold mb-3">💡 Mes conseils pour toi</h3>
            {tips.strengths && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-600">Tes forces :</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tips.strengths.map((s, i) => (
                    <span key={i} className="badge-pill bg-green-100 text-green-700 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
            <ul className="space-y-1">
              {tips.tips.map((tip, i) => (
                <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-accent-green">✓</span> {tip}
                </li>
              ))}
            </ul>
            {tips.encouragement && (
              <p className="mt-3 text-sm font-medium text-primary-600 italic">{tips.encouragement}</p>
            )}
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="text-center pb-8">
          <button type="button" onClick={() => navigate(`/home/${userId}`)} className="btn-primary text-lg px-10 py-4">
            Commencer mon parcours ! 🚀
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function isStepValid(content, responses) {
  if (!content) return false;
  switch (content.type) {
    case 'multi_select':
      return (responses.selected || []).length >= (content.minSelect || 1);
    case 'rating':
      return content.scenarios.every(s => (responses.ratings || {})[s.id] !== undefined);
    case 'pcm_quiz':
      return content.questions.every(q => (responses.answers || {})[q.id]);
    case 'pathway_select':
      return !!responses.pathwayType;
    case 'career_explorer':
      return (responses.sectors || []).length > 0;
    default:
      return true;
  }
}
