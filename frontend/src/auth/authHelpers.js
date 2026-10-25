/**
 * Authentication storage and token helper utilities.
 * Conforms to API_CONTRACT.md: Authorization: Bearer <JWT>
 */

const TOKEN_KEY = 'marque_auth_token';
const USER_KEY = 'marque_auth_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.error('Failed to set auth token in localStorage', err);
  }
}

export function removeToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to remove auth token', err);
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  } catch (err) {
    console.error('Failed to set user in localStorage', err);
  }
}

export function removeUser() {
  try {
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to remove user', err);
  }
}

export function clearAuth() {
  removeToken();
  removeUser();
}

export function getAuthHeaders() {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
