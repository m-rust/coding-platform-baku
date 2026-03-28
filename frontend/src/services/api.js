import axios from 'axios';
import { useAuthStore } from '../store/authStore.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();

  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

let isRefreshing = false;
let pendingRequests = [];

const processQueue = (error, token = null) => {
  pendingRequests.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  pendingRequests = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.log('Axios error in interceptor:', error);
    console.log('error.config:', error.config);
    console.log('error.response:', error.response);
    console.log('error.message:', error.message);
    
    // return;

    const originalRequest = error.config;

    if (!error.response || error.response.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const { refreshToken, user, clearAuth, setAuth } = useAuthStore.getState();

    if (!refreshToken) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingRequests.push({
          resolve: (token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            resolve(api(originalRequest));
          },
          reject,
        });
      });
    }

    isRefreshing = true;

    try {
      const response = await refreshClient.post('/auth/refresh', { refreshToken });
      const newAccessToken = response.data.accessToken;
      const newRefreshToken = response.data.refreshToken;

      setAuth({
        user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      processQueue(null, newAccessToken);

      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      }

      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuth();

      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;