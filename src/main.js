// src/main.js
import './styles.css';
import './analytics.css';
import './userGuide.css';
import { initApp } from './app.js';
import { getSession, renderLoginScreen } from './auth.js';

async function boot() {
  const session = await getSession();
  if (session) {
    initApp();
  } else {
    renderLoginScreen(() => initApp());
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
