import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/parent/register', data),
  login: (data) => api.post('/auth/parent/login', data),
  selectChild: (childId) => api.post('/auth/child/select', { childId }),
  me: () => api.get('/auth/me'),
};

// Family
export const familyAPI = {
  getUsers: () => api.get('/family/users'),
  createUser: (data) => api.post('/family/users', data),
  getUser: (id) => api.get(`/family/users/${id}`),
};

// Discovery
export const discoveryAPI = {
  getStatus: (userId) => api.get(`/discovery/status/${userId}`),
  getStep: (userId, stepNumber) => api.get(`/discovery/step/${userId}/${stepNumber}`),
  submitStep: (data) => api.post('/discovery/step', data),
  getResult: (userId) => api.get(`/discovery/result/${userId}`),
};

// Pathways
export const pathwayAPI = {
  create: (data) => api.post('/pathways', data),
  get: (userId) => api.get(`/pathways/${userId}`),
  update: (id, data) => api.put(`/pathways/${id}`, data),
};

// Program
export const programAPI = {
  getToday: (userId) => api.get(`/program/today/${userId}`),
  completeBlock: (data) => api.post('/program/complete-block', data),
  submitMood: (data) => api.post('/program/mood', data),
};

// Content
export const contentAPI = {
  generateLesson: (data) => api.post('/content/generate-lesson', data),
  generateExercises: (data) => api.post('/content/generate-exercises', data),
  getLesson: (id) => api.get(`/content/lesson/${id}`),
};

// Chat
export const chatAPI = {
  sendMessage: (data) => api.post('/chat/message', data),
  getHistory: (userId) => api.get(`/chat/history/${userId}`),
};

// TTS
export const ttsAPI = {
  synthesize: (data) => api.post('/tts/synthesize', data),
};

// Home
export const homeAPI = {
  getFeed: (userId) => api.get(`/home/feed/${userId}`),
  getEvents: () => api.get('/home/events'),
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getProfile: (userId) => api.get(`/admin/profiles/${userId}`),
  updateProfile: (userId, data) => api.put(`/admin/profiles/${userId}`, data),
  getChatHistory: (userId) => api.get(`/admin/chat-history/${userId}`),
  getAnalytics: () => api.get('/admin/analytics'),
};

export default api;
