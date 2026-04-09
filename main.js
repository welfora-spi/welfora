/* ═══════════════════════════════════════════════════════════════
   main.js — Welfora shared JS
   ═══════════════════════════════════════════════════════════════ */

// ── Config ───────────────────────────────────────────────────────
const API_BASE = 'https://app.spitool.it/api/welfora';

// ── Nav burger (mobile) ──────────────────────────────────────────
const burger = document.getElementById('burger');
const navMobile = document.getElementById('navMobile');
if (burger && navMobile) {
  burger.addEventListener('click', () => {
    navMobile.classList.toggle('open');
  });
  // Chiudi cliccando fuori
  document.addEventListener('click', (e) => {
    if (!burger.contains(e.target) && !navMobile.contains(e.target)) {
      navMobile.classList.remove('open');
    }
  });
}

// ── Nav scroll opacity ───────────────────────────────────────────
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.style.borderBottomColor = window.scrollY > 40
      ? 'rgba(201,168,76,0.25)'
      : 'rgba(201,168,76,0.15)';
  }, { passive: true });
}

// ── Pre-selezione servizio da URL param ──────────────────────────
// Usato da consulenza.html per pre-selezionare il servizio
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ── Helper API call ──────────────────────────────────────────────
async function apiCall(endpoint, data) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

// Esporta per uso nei file specifici
window.WelforaAPI = { base: API_BASE, call: apiCall, getParam };
