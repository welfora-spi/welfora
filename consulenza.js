/* ═══════════════════════════════════════════════════════════════
   consulenza.js — logica pagina prenotazione
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Mappa servizi ─────────────────────────────────────────────
const SERVIZI = {
  'report':           { nome: 'Report Pensionistico',  prezzo: '€49' },
  'video-report':     { nome: 'Video per Report',      prezzo: '€89' },
  'video-consulenza': { nome: 'Video Consulenza',      prezzo: '€149' },
  'protocollo':       { nome: 'Protocollo Welfora',    prezzo: '€299/anno' },
};

// ── Pre-selezione da URL param (?servizio=xxx) ────────────────
function preselezioneServizio() {
  const param = window.WelforaAPI?.getParam('servizio') ||
    new URLSearchParams(window.location.search).get('servizio');

  if (!param || !SERVIZI[param]) return;

  // Seleziona il radio corretto
  const radio = document.querySelector(`input[name="servizio"][value="${param}"]`);
  if (radio) {
    radio.checked = true;
    aggiornaPreview(param);
    // Scroll gentile alla card se su mobile
    if (window.innerWidth < 960) {
      setTimeout(() => {
        document.querySelector(`[data-servizio="${param}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }
}

// ── Aggiorna preview servizio selezionato ─────────────────────
function aggiornaPreview(valore) {
  const preview = document.getElementById('servizioPreview');
  const nome = document.getElementById('servizioNome');
  const prezzo = document.getElementById('servizioPrezzo');

  if (valore && SERVIZI[valore]) {
    nome.textContent = SERVIZI[valore].nome;
    prezzo.textContent = SERVIZI[valore].prezzo;
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
  }
}

// ── Listener cambio radio ─────────────────────────────────────
document.querySelectorAll('input[name="servizio"]').forEach(radio => {
  radio.addEventListener('change', function () {
    aggiornaPreview(this.value);
  });
});

// ── Validazione form ──────────────────────────────────────────
function validaForm() {
  const servizio = document.querySelector('input[name="servizio"]:checked')?.value;
  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const privacy = document.getElementById('privacy').checked;

  const errori = [];
  if (!servizio) errori.push('Seleziona un servizio');
  if (!nome) errori.push('Inserisci nome e cognome');
  if (!email || !email.includes('@')) errori.push('Inserisci un\'email valida');
  if (!privacy) errori.push('Accetta la privacy policy per procedere');

  return { valido: errori.length === 0, errori };
}

// ── Submit form ───────────────────────────────────────────────
document.getElementById('btnInvia').addEventListener('click', function () {
  const { valido, errori } = validaForm();

  if (!valido) {
    alert('Correggi i seguenti campi:\n\n• ' + errori.join('\n• '));
    return;
  }

  const btn = this;
  btn.textContent = 'Invio in corso...';
  btn.disabled = true;

  // Raccoglie dati form
  const payload = {
    servizio:     document.querySelector('input[name="servizio"]:checked')?.value,
    nome:         document.getElementById('nome').value.trim(),
    email:        document.getElementById('email').value.trim(),
    telefono:     document.getElementById('telefono').value.trim(),
    eta:          document.getElementById('eta-form').value,
    tipo:         document.getElementById('tipo-form').value,
    situazione:   document.getElementById('situazione').value.trim(),
    fonte:        document.getElementById('come-hai-trovato').value,
    timestamp:    new Date().toISOString(),
  };

  // ── Integrazione API (attiva quando endpoint pronto) ──────
  // Decommenta quando app.spitool.it/api/welfora/lead è disponibile:
  //
  // try {
  //   await window.WelforaAPI.call('/lead', payload);
  // } catch(e) {
  //   console.warn('API non disponibile, fallback locale', e);
  // }

  // Simulazione invio (sostituire con chiamata API reale)
  console.log('Lead Welfora:', payload);

  setTimeout(() => {
    // Mostra stato successo
    document.getElementById('formContent').style.display = 'none';
    document.getElementById('successState').style.display = 'block';

    // Scroll al top del form
    document.getElementById('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 600);
});

// ── Init ──────────────────────────────────────────────────────
preselezioneServizio();
