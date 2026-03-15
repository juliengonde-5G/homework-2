import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { programAPI, contentAPI, chatAPI } from '../services/api';
import { useTimer } from '../hooks/useTimer';
import { useTTS } from '../hooks/useTTS';

export default function Session() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const timer = useTimer(45);
  const tts = useTTS();

  const [program, setProgram] = useState(null);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [blockContent, setBlockContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  // Exercise state
  const [answers, setAnswers] = useState({});
  const [showCorrection, setShowCorrection] = useState(false);
  const [score, setScore] = useState(null);

  useEffect(() => {
    loadProgram();
  }, [userId]);

  const loadProgram = async () => {
    try {
      const res = await programAPI.getToday(userId);
      setProgram(res.data);
      const blocks = Array.isArray(res.data.blocks) ? res.data.blocks : [];
      const nextBlock = blocks.find(b => !b.completed);
      if (nextBlock) selectBlock(nextBlock);
      timer.start();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectBlock = async (block) => {
    setCurrentBlock(block);
    setBlockContent(null);
    setAnswers({});
    setShowCorrection(false);
    setScore(null);

    try {
      if (block.type === 'lesson') {
        const res = await contentAPI.generateLesson({
          userId: parseInt(userId),
          subject: block.subject,
          competencyLabel: block.competencyLabel || block.title
        });
        setBlockContent(res.data);
      } else {
        const res = await contentAPI.generateExercises({
          userId: parseInt(userId),
          subject: block.subject,
          competencyLabel: block.competencyLabel || block.title
        });
        setBlockContent(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteBlock = async () => {
    if (!program || !currentBlock) return;
    try {
      await programAPI.completeBlock({
        programId: program.id,
        blockId: currentBlock.id,
        answers,
        score: score || 0
      });

      // Move to next block
      const blocks = Array.isArray(program.blocks) ? program.blocks : [];
      const currentIndex = blocks.findIndex(b => b.id === currentBlock.id);
      const nextBlock = blocks[currentIndex + 1];

      if (nextBlock) {
        selectBlock(nextBlock);
      } else {
        setCurrentBlock(null);
        setBlockContent(null);
      }

      await loadProgram();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckAnswers = () => {
    if (!blockContent?.exercises) return;
    let correct = 0;
    const total = blockContent.exercises.length;

    blockContent.exercises.forEach(ex => {
      if (answers[ex.id] === ex.correctAnswer) correct++;
    });

    setScore(Math.round((correct / total) * 100));
    setShowCorrection(true);
  };

  const sendChat = async () => {
    if (!chatInput.trim() || sendingChat) return;
    const message = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: message }]);
    setSendingChat(true);

    try {
      const res = await chatAPI.sendMessage({
        userId: parseInt(userId),
        message,
        context: {
          currentSubject: currentBlock?.subject,
          currentLesson: currentBlock?.title
        }
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.data.content }]);
    } catch (err) {
      console.error(err);
    } finally {
      setSendingChat(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="mascot text-4xl w-20 h-20 animate-bounce-slow">🦉</div>
    </div>
  );

  const timerClass = timer.status === 'overtime' ? 'timer-overtime' :
                     timer.status === 'warning' ? 'timer-warning' : 'timer-normal';

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky header with timer */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-20 px-4 py-2">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate(`/home/${userId}`)} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Accueil
          </button>

          <div className={timerClass}>
            ⏱ {timer.status === 'overtime' ? `+${timer.display}` : timer.remainingDisplay}
          </div>

          <button
            onClick={() => setShowChat(!showChat)}
            className="relative p-2 rounded-full hover:bg-gray-100"
          >
            <span className="text-xl">🦉</span>
            {showChat && <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary-500 rounded-full" />}
          </button>
        </div>

        {/* Progress bar */}
        <div className="max-w-3xl mx-auto mt-2">
          <div className="h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-1.5 bg-primary-500 rounded-full transition-all duration-500"
              style={{ width: `${timer.progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Block navigation */}
        {program && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
            {(Array.isArray(program.blocks) ? program.blocks : []).map((block, i) => (
              <button
                key={i}
                onClick={() => selectBlock(block)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  currentBlock?.id === block.id
                    ? 'bg-primary-600 text-white shadow-lg'
                    : block.completed
                      ? 'bg-green-100 text-green-700'
                      : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {block.completed ? '✓ ' : ''}{block.type === 'lesson' ? '📖' : '✏️'} {block.subject}
              </button>
            ))}
          </div>
        )}

        {/* Block content */}
        {currentBlock && blockContent ? (
          <div className="space-y-6">
            {currentBlock.type === 'lesson' ? (
              <LessonView content={blockContent} tts={tts} />
            ) : (
              <ExerciseView
                content={blockContent}
                answers={answers}
                setAnswers={setAnswers}
                showCorrection={showCorrection}
                score={score}
                onCheck={handleCheckAnswers}
              />
            )}

            <div className="text-center">
              <button onClick={handleCompleteBlock} className="btn-accent">
                {currentBlock.type === 'lesson' ? 'J\'ai compris ! →' : 'Bloc suivant →'}
              </button>
            </div>
          </div>
        ) : currentBlock ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">⚡</div>
              <p className="text-gray-500">Génération du contenu...</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="font-display text-2xl font-bold text-primary-800">Session terminée !</h2>
            <p className="text-gray-500 mt-2">Bravo, tu as fait du super travail aujourd'hui !</p>
            <button onClick={() => navigate(`/home/${userId}`)} className="btn-primary mt-6">
              Retour à l'accueil
            </button>
          </div>
        )}
      </div>

      {/* Chat panel */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-white shadow-2xl z-30 flex flex-col"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="mascot text-sm w-8 h-8">🦉</span>
                <span className="font-display font-semibold">Assistant</span>
              </div>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400">Pose-moi une question !</p>
                  <p className="text-xs text-gray-300 mt-1">Je suis là pour t'aider à comprendre</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'chat-user' : 'chat-assistant'}>
                  {msg.content}
                </div>
              ))}
              {sendingChat && (
                <div className="chat-assistant animate-pulse">
                  <span className="text-gray-400">...</span>
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  className="input-field flex-1"
                  placeholder="Ta question..."
                />
                <button onClick={sendChat} disabled={sendingChat} className="btn-primary px-4">
                  →
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LessonView({ content, tts }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-primary-800">
          {content.title}
        </h2>
        <button
          onClick={() => {
            const text = content.sections?.map(s => s.content).join('. ') || '';
            tts.speak(text, content.language || 'fr');
          }}
          className={`p-3 rounded-full transition-all ${
            tts.isPlaying ? 'bg-primary-100 text-primary-600 animate-pulse' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          {tts.isPlaying ? '⏸' : '🔊'}
        </button>
      </div>

      {content.sections?.map((section, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.15 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-lg">{section.title}</h3>
            <button
              onClick={() => tts.speak(section.content, content.language || 'fr')}
              className="text-sm text-gray-400 hover:text-primary-500"
            >
              🔊
            </button>
          </div>
          <div className="text-gray-600 leading-relaxed whitespace-pre-wrap">
            {section.content}
          </div>
          {section.keyPoints?.length > 0 && (
            <div className="mt-3 p-3 bg-primary-50 rounded-xl">
              <p className="text-xs font-semibold text-primary-600 mb-1">Points clés :</p>
              <ul className="text-sm text-primary-700 space-y-1">
                {section.keyPoints.map((kp, j) => (
                  <li key={j}>• {kp}</li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
      ))}

      {content.vocabulary?.length > 0 && (
        <div className="card bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold text-yellow-800 mb-2">📝 Vocabulaire</h3>
          <div className="space-y-1">
            {content.vocabulary.map((v, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="font-medium text-yellow-700">{v.term} :</span>
                <span className="text-yellow-600">{v.definition}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.summary && (
        <div className="card bg-green-50 border-green-200">
          <h3 className="font-semibold text-green-800 mb-1">📌 À retenir</h3>
          <p className="text-sm text-green-700">{content.summary}</p>
        </div>
      )}
    </div>
  );
}

function ExerciseView({ content, answers, setAnswers, showCorrection, score, onCheck }) {
  if (!content?.exercises) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold text-primary-800">Exercices</h2>
        {score !== null && (
          <span className={`badge-pill text-lg ${
            score >= 70 ? 'bg-green-100 text-green-700' :
            score >= 40 ? 'bg-orange-100 text-orange-700' :
            'bg-red-100 text-red-700'
          }`}>
            {score}%
          </span>
        )}
      </div>

      {content.exercises.map((ex, i) => (
        <motion.div
          key={ex.id || i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`card ${
            showCorrection
              ? answers[ex.id] === ex.correctAnswer
                ? 'ring-2 ring-green-400'
                : 'ring-2 ring-red-300'
              : ''
          }`}
        >
          <div className="flex items-start gap-2 mb-3">
            <span className={`badge-pill text-xs ${
              ex.difficulty === 1 ? 'bg-green-100 text-green-600' :
              ex.difficulty === 2 ? 'bg-orange-100 text-orange-600' :
              'bg-red-100 text-red-600'
            }`}>
              {'★'.repeat(ex.difficulty || 1)}
            </span>
            <span className="text-xs text-gray-400">{ex.points} pts</span>
          </div>

          <p className="font-medium mb-3">{ex.question}</p>

          {ex.type === 'qcm' && ex.options && (
            <div className="space-y-2">
              {ex.options.map((opt, j) => (
                <button
                  key={j}
                  onClick={() => !showCorrection && setAnswers({ ...answers, [ex.id]: opt })}
                  disabled={showCorrection}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all text-sm ${
                    showCorrection
                      ? opt === ex.correctAnswer
                        ? 'bg-green-100 border-2 border-green-400'
                        : answers[ex.id] === opt
                          ? 'bg-red-100 border-2 border-red-300'
                          : 'bg-gray-50'
                      : answers[ex.id] === opt
                        ? 'bg-primary-100 border-2 border-primary-400'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {ex.type === 'vrai_faux' && (
            <div className="flex gap-3">
              {['Vrai', 'Faux'].map(opt => (
                <button
                  key={opt}
                  onClick={() => !showCorrection && setAnswers({ ...answers, [ex.id]: opt })}
                  disabled={showCorrection}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all ${
                    showCorrection
                      ? opt === ex.correctAnswer
                        ? 'bg-green-100 text-green-700 border-2 border-green-400'
                        : answers[ex.id] === opt
                          ? 'bg-red-100 text-red-700 border-2 border-red-300'
                          : 'bg-gray-50'
                      : answers[ex.id] === opt
                        ? 'bg-primary-100 text-primary-700 border-2 border-primary-400'
                        : 'bg-gray-100 hover:bg-gray-200 border-2 border-transparent'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {ex.type === 'texte_libre' && (
            <textarea
              value={answers[ex.id] || ''}
              onChange={e => !showCorrection && setAnswers({ ...answers, [ex.id]: e.target.value })}
              disabled={showCorrection}
              className="input-field min-h-[80px]"
              placeholder="Ta réponse..."
            />
          )}

          {showCorrection && ex.explanation && (
            <div className="mt-3 p-3 bg-blue-50 rounded-xl">
              <p className="text-sm text-blue-700">💡 {ex.explanation}</p>
            </div>
          )}
        </motion.div>
      ))}

      {!showCorrection && (
        <div className="text-center">
          <button onClick={onCheck} className="btn-primary">
            Vérifier mes réponses
          </button>
        </div>
      )}
    </div>
  );
}
