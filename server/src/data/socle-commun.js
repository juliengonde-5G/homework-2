/**
 * Socle Commun de Connaissances, de Competences et de Culture
 * 5 domaines officiels de l'Education Nationale francaise
 */
const SOCLE_COMMUN = {
  domains: [
    {
      id: 1,
      code: 'D1',
      label: 'Les langages pour penser et communiquer',
      subDomains: [
        { code: 'D1.1', label: 'Comprendre, s\'exprimer en utilisant la langue française à l\'oral et à l\'écrit', subjects: ['francais'] },
        { code: 'D1.2', label: 'Comprendre, s\'exprimer en utilisant une langue étrangère', subjects: ['anglais', 'espagnol', 'allemand'] },
        { code: 'D1.3', label: 'Comprendre, s\'exprimer en utilisant les langages mathématiques, scientifiques et informatiques', subjects: ['mathematiques', 'physique-chimie', 'svt', 'technologie', 'nsi'] },
        { code: 'D1.4', label: 'Comprendre, s\'exprimer en utilisant les langages des arts et du corps', subjects: ['arts-plastiques', 'musique', 'eps'] }
      ]
    },
    {
      id: 2,
      code: 'D2',
      label: 'Les méthodes et outils pour apprendre',
      subDomains: [
        { code: 'D2.1', label: 'Organisation du travail personnel', subjects: ['all'] },
        { code: 'D2.2', label: 'Coopération et réalisation de projets', subjects: ['all'] },
        { code: 'D2.3', label: 'Médias, démarches de recherche et de traitement de l\'information', subjects: ['all'] },
        { code: 'D2.4', label: 'Outils numériques pour échanger et communiquer', subjects: ['technologie', 'nsi'] }
      ]
    },
    {
      id: 3,
      code: 'D3',
      label: 'La formation de la personne et du citoyen',
      subDomains: [
        { code: 'D3.1', label: 'Expression de la sensibilité et des opinions, respect des autres', subjects: ['emc', 'francais'] },
        { code: 'D3.2', label: 'La règle et le droit', subjects: ['emc', 'histoire-geographie'] },
        { code: 'D3.3', label: 'Réflexion et discernement', subjects: ['emc', 'philosophie'] },
        { code: 'D3.4', label: 'Responsabilité, sens de l\'engagement et de l\'initiative', subjects: ['emc', 'all'] }
      ]
    },
    {
      id: 4,
      code: 'D4',
      label: 'Les systèmes naturels et les systèmes techniques',
      subDomains: [
        { code: 'D4.1', label: 'Démarches scientifiques', subjects: ['physique-chimie', 'svt', 'mathematiques'] },
        { code: 'D4.2', label: 'Conception, création, réalisation', subjects: ['technologie', 'arts-plastiques'] },
        { code: 'D4.3', label: 'Responsabilités individuelles et collectives', subjects: ['svt', 'emc'] }
      ]
    },
    {
      id: 5,
      code: 'D5',
      label: 'Les représentations du monde et l\'activité humaine',
      subDomains: [
        { code: 'D5.1', label: 'L\'espace et le temps', subjects: ['histoire-geographie'] },
        { code: 'D5.2', label: 'Organisations et représentations du monde', subjects: ['histoire-geographie', 'ses'] },
        { code: 'D5.3', label: 'Invention, élaboration, production d\'un univers artistique', subjects: ['francais', 'arts-plastiques', 'musique'] }
      ]
    }
  ],

  // Map subjects to their Socle Commun domain codes
  getDomainsForSubject(subject) {
    const domains = [];
    for (const domain of this.domains) {
      for (const sub of domain.subDomains) {
        if (sub.subjects.includes(subject) || sub.subjects.includes('all')) {
          domains.push({ domainCode: domain.code, domainLabel: domain.label, subCode: sub.code, subLabel: sub.label });
        }
      }
    }
    return domains;
  },

  // Get all subjects for a cycle
  getSubjectsForCycle(cycle) {
    const cycleSubjects = {
      cycle3: ['francais', 'mathematiques', 'anglais', 'histoire-geographie', 'sciences', 'arts-plastiques', 'musique', 'eps', 'emc'],
      cycle4: ['francais', 'mathematiques', 'anglais', 'histoire-geographie', 'physique-chimie', 'svt', 'technologie', 'arts-plastiques', 'musique', 'eps', 'emc', 'espagnol', 'allemand', 'latin', 'grec'],
      lycee: ['francais', 'mathematiques', 'anglais', 'histoire-geographie', 'physique-chimie', 'svt', 'ses', 'philosophie', 'nsi', 'espagnol', 'allemand', 'arts-plastiques', 'musique', 'eps', 'emc']
    };
    return cycleSubjects[cycle] || cycleSubjects.cycle4;
  }
};

module.exports = SOCLE_COMMUN;
