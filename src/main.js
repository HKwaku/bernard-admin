// src/main.js
import './styles.css';
import './analytics.css';
import './userGuide.css';
import { initApp } from './app.js';

// Single, central bootstrap
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });
} else {
  initApp();
}
