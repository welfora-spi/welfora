/* ═══════════════════════════════════════════════════════════════
   calcolatore.js — Motore di calcolo pensionistico SPI
   Regole INPS vigenti 2026 (contributivo puro / misto)
   Standalone: nessuna dipendenza API. Pronto per integrazione
   con app.spitool.it/api/welfora quando disponibile.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── Coefficienti di trasformazione INPS 2025 ──────────────────
// (da Tabella INPS aggiornata ogni 2 anni)
const COEFF_TRASFORMAZIONE = {
  57: 0.04270, 58: 0.04415, 59: 0.04565, 60: 0.04720,
  61: 0.04890, 62: 0.05060, 63: 0.05240, 64: 0.05450,
  65: 0.05650, 66: 0.05870, 67: 0.06100, 68: 0.06340,
  69: 0.06590, 70: 0.06860, 71: 0.07130,
};

// ── Requisiti pensionistici vigenti 2026 ──────────────────────
const REQUISITI = {
  vecchiaia: { eta: 67, contributi: 20 },
  anticipata_uomo: { contributi: 42.10 },  // 42 anni e 10 mesi
  anticipata_donna: { contributi: 41.10 }, // 41 anni e 10 mesi
  quota41_precoci: { contributi: 41, eta_max: null }, // con un anno prima del 19esimo
  ape_sociale: { eta: 63.5, contributi: 30 },
};

// ── Massimale contributivo 2024 (cresce ~2% annuo) ────────────
const MASSIMALE_2024 = 119650;

// ── Utilità ───────────────────────────────────────────────────
function fmt(n) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}
function fmtPct(n) { return (n * 100).toFixed(1) + '%'; }
function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

function getCoeff(eta) {
  const etaInt = Math.min(Math.max(Math.round(eta), 57), 71);
  return COEFF_TRASFORMAZIONE[etaInt];
}

// ── Calcolo montante contributivo ────────────────────────────
// Se l'utente non fornisce il montante, lo stimiamo dalla storia
function stimaMontante(reddito, anniVersati, aliquota, rivalutazione) {
  // Contributo annuo medio (cap al massimale)
  const redditoCapppato = Math.min(reddito, MASSIMALE_2024);
  const contributoAnnuo = redditoCapppato * (aliquota / 100);
  // Stima retroattiva: anni versati con rivalutazione media 2%
  let montante = 0;
  for (let i = 0; i < anniVersati; i++) {
    // I contributi più vecchi hanno rivalutato di più
    const anniRivalutazione = anniVersati - i;
    montante += contributoAnnuo * Math.pow(1 + rivalutazione / 100 * 0.5, anniRivalutazione);
  }
  return Math.round(montante);
}

// ── Proiezione montante futuro ────────────────────────────────
function proiettaMontante(montanteAttuale, reddito, aliquota, anniRimanenti, rivalutazione) {
  const redditoCapppato = Math.min(reddito, MASSIMALE_2024 * Math.pow(1.02, anniRimanenti / 2));
  const contributoAnnuo = redditoCapppato * (aliquota / 100);
  let montante = montanteAttuale;
  for (let i = 0; i < anniRimanenti; i++) {
    montante = montante * (1 + rivalutazione / 100) + contributoAnnuo;
  }
  return Math.round(montante);
}

// ── Calcola pensione annua lorda da montante ──────────────────
function calcolaPensione(montante, etaUscita) {
  const coeff = getCoeff(etaUscita);
  const pensioneLorda = montante * coeff;
  // Soglia minima INPS (assegno sociale ~550€/mese → ~6600€/anno)
  return Math.max(pensioneLorda, 6600);
}

// ── Determina colore scenario ─────────────────────────────────
function getColoreScenario(tasso) {
  if (tasso >= 0.60) return 'verde';
  if (tasso >= 0.40) return 'arancio';
  return 'rosso';
}

// ── Genera testo raccomandazione ──────────────────────────────
function generaRaccomandazione(input, scenari) {
  const { eta, etaUscita, anniContributi, spesaMensile, tipo } = input;
  const gap = scenari.B.pensioneMensile - spesaMensile;
  const anniMancanti = etaUscita - eta;

  let testo = '';

  if (scenari.B.fattibile) {
    if (gap >= 0) {
      testo = `Con ${anniMancanti} anni di contributi aggiuntivi raggiungi l'obiettivo di uscita a ${etaUscita} anni con una pensione stimata di ${fmt(scenari.B.pensioneMensile)}/mese — superiore alla spesa desiderata. `;
      testo += `Il tasso di sostituzione del ${fmtPct(scenari.B.tassoSostituzione)} è sostenibile.`;
    } else {
      testo = `A ${etaUscita} anni la pensione stimata (${fmt(scenari.B.pensioneMensile)}/mese) è inferiore alla spesa desiderata di ${fmt(spesaMensile)}/mese — gap di ${fmt(Math.abs(gap))}/mese. `;
      testo += `Considera di integrare con previdenza complementare o posticipare l'uscita al ${scenari.A.etaUscita} anni per una posizione più solida.`;
    }
  } else {
    testo = `L'uscita a ${etaUscita} anni non è ancora raggiungibile con i requisiti attuali. `;
    if (scenari.C.etaUscita) {
      testo += `Il percorso di pensione anticipata ti permette di uscire intorno ai ${scenari.C.etaUscita} anni, circa ${scenari.C.etaUscita - eta} anni prima della vecchiaia ordinaria.`;
    } else {
      testo += `Il percorso ordinario prevede l'uscita a ${scenari.A.etaUscita} anni con i 20 anni di contributi richiesti.`;
    }
  }

  if (tipo === 'autonomo' || tipo === 'professionista') {
    testo += ` Attenzione: come ${tipo}, l'aliquota contributiva ridotta (24–26%) genera montanti più bassi a parità di reddito rispetto a un dipendente. La previdenza integrativa è particolarmente importante per te.`;
  }

  return testo;
}

// ── MOTORE PRINCIPALE ─────────────────────────────────────────
function calcolaScenari(input) {
  const {
    eta, anniContributi, reddito, aliquota,
    montanteInput, rivalutazione, etaUscita,
    spesaMensile, risparmi, tipo
  } = input;

  const redditoMensile = reddito / 13.5; // RAL → mensile netto stimato

  // Montante attuale
  const montanteAttuale = montanteInput > 0
    ? montanteInput
    : stimaMontante(reddito, anniContributi, aliquota, rivalutazione);

  // ── Scenario A: Vecchiaia ordinaria (67 anni, min 20 contributi) ──
  const etaVecchiaia = REQUISITI.vecchiaia.eta;
  const anniAlVecchiaia = Math.max(0, etaVecchiaia - eta);
  const anniContribAlVecchiaia = anniContributi + anniAlVecchiaia;
  const montanteVecchiaia = proiettaMontante(montanteAttuale, reddito, aliquota, anniAlVecchiaia, rivalutazione);
  const contributiVecchiaiaOk = anniContribAlVecchiaia >= REQUISITI.vecchiaia.contributi;
  const pensioneAnnuaA = calcolaPensione(montanteVecchiaia, etaVecchiaia);
  const pensioneMensileA = pensioneAnnuaA / 13;
  const tassoA = pensioneMensileA / redditoMensile;
  const gapA = pensioneMensileA - spesaMensile;

  // ── Scenario B: Obiettivo utente ──────────────────────────────
  const anniAllObiettivo = Math.max(0, etaUscita - eta);
  const anniContribObiettivo = anniContributi + anniAllObiettivo;
  const montanteObiettivo = proiettaMontante(montanteAttuale, reddito, aliquota, anniAllObiettivo, rivalutazione);

  // Check requisiti: vecchiaia (67+20) o anticipata (42a10m uomo / 41a10m donna)
  const reqAnticipata = tipo === 'dipendente-pub' ? 42.5 : 42.10; // semplificato
  const fattibileB = (etaUscita >= 67 && anniContribObiettivo >= 20) ||
                     (anniContribObiettivo >= reqAnticipata);

  const pensioneAnnuaB = fattibileB
    ? calcolaPensione(montanteObiettivo, clamp(etaUscita, 57, 71))
    : calcolaPensione(montanteObiettivo, 67);
  const pensioneMensileB = pensioneAnnuaB / 13;
  const tassoB = pensioneMensileB / redditoMensile;
  const gapB = pensioneMensileB - spesaMensile;

  // Calcola quando raggiungerà i requisiti anticipata
  let requisitiB = '';
  if (!fattibileB) {
    const mancanoAnniB = Math.max(0, reqAnticipata - anniContribObiettivo);
    requisitiB = mancanoAnniB > 0
      ? `Mancano ~${mancanoAnniB.toFixed(1)} anni di contributi`
      : 'Requisiti non soddisfatti per età';
  } else {
    requisitiB = etaUscita >= 67 ? 'Vecchiaia ordinaria ✓' : 'Anticipata ✓';
  }

  // ── Scenario C: Pensione anticipata (prima possibile) ─────────
  const reqC = 42.10; // uomo (semplificato)
  let etaAnticipata = null;
  let anniMancanti = 0;

  if (anniContributi >= reqC) {
    // Ha già i requisiti contributivi — uscita immediata (se età > 0)
    etaAnticipata = eta;
    anniMancanti = 0;
  } else {
    // Calcola quando raggiungerà reqC
    const anniDaAccumulare = reqC - anniContributi;
    etaAnticipata = Math.round(eta + anniDaAccumulare);
    anniMancanti = Math.round(anniDaAccumulare);
  }

  const montanteAnticipata = proiettaMontante(montanteAttuale, reddito, aliquota, anniMancanti, rivalutazione);
  const pensioneAnnuaC = calcolaPensione(montanteAnticipata, clamp(etaAnticipata, 57, 71));
  const pensioneMensileC = pensioneAnnuaC / 13;
  const tassoC = pensioneMensileC / redditoMensile;
  const gapC = pensioneMensileC - spesaMensile;

  // ── Contributi futuri stimati ──────────────────────────────────
  const contributoAnnuo = Math.min(reddito, MASSIMALE_2024) * (aliquota / 100);
  const anniLavoroRimanenti = Math.max(0, etaVecchiaia - eta);
  const contributiFuturi = contributoAnnuo * anniLavoroRimanenti;

  return {
    montanteAttuale,
    contributiAnnui: contributoAnnuo,
    contributiFuturi,
    A: {
      etaUscita: etaVecchiaia,
      anniContributi: Math.round(anniContribAlVecchiaia * 10) / 10,
      pensioneAnnua: pensioneAnnuaA,
      pensioneMensile: Math.round(pensioneMensileA),
      tassoSostituzione: tassoA,
      gap: Math.round(gapA),
      fattibile: contributiVecchiaiaOk,
    },
    B: {
      etaUscita,
      anniContributi: Math.round(anniContribObiettivo * 10) / 10,
      pensioneAnnua: pensioneAnnuaB,
      pensioneMensile: Math.round(pensioneMensileB),
      tassoSostituzione: tassoB,
      gap: Math.round(gapB),
      fattibile: fattibileB,
      requisitiNote: requisitiB,
    },
    C: {
      etaUscita: etaAnticipata,
      anniContributi: reqC,
      pensioneAnnua: pensioneAnnuaC,
      pensioneMensile: Math.round(pensioneMensileC),
      tassoSostituzione: tassoC,
      gap: Math.round(gapC),
      anniMancanti,
    },
  };
}

// ── RENDER RISULTATI ──────────────────────────────────────────
function renderRisultati(input, scenari) {
  // Nascondi stato vuoto, mostra risultati
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('resultsContent').style.display = 'block';

  // Summary
  document.getElementById('resMontante').textContent = fmt(scenari.montanteAttuale);
  document.getElementById('resAnniMancanti').textContent = Math.max(0, input.etaUscita - input.eta) + ' anni';
  document.getElementById('resContribFuturi').textContent = fmt(scenari.contributiFuturi);

  // ── Scenario A ────
  const sA = scenari.A;
  const colA = getColoreScenario(sA.tassoSostituzione);
  const elA = document.getElementById('scenarioA');
  elA.className = `result-scenario scenario--${colA}`;
  document.getElementById('sA-eta').textContent = sA.etaUscita + ' anni';
  document.getElementById('sA-etaVal').textContent = sA.etaUscita + ' anni';
  document.getElementById('sA-anni').textContent = sA.anniContributi + ' anni';
  document.getElementById('sA-pensione').textContent = fmt(sA.pensioneMensile) + '/mese';
  document.getElementById('sA-tasso').textContent = fmtPct(sA.tassoSostituzione);
  document.getElementById('sA-gap').textContent = sA.gap >= 0 ? '+' + fmt(sA.gap) + '/mese' : fmt(sA.gap) + '/mese';
  document.getElementById('sA-sost').textContent = sA.fattibile ? '✓ Requisiti ok' : '⚠ Verifica contributi';
  setTimeout(() => {
    document.getElementById('sA-bar').style.width = clamp(sA.tassoSostituzione * 100, 0, 100) + '%';
  }, 100);

  // ── Scenario B ────
  const sB = scenari.B;
  const colB = getColoreScenario(sB.tassoSostituzione);
  const elB = document.getElementById('scenarioB');
  elB.className = `result-scenario scenario--${colB}`;
  document.getElementById('sB-eta').textContent = sB.etaUscita + ' anni';
  document.getElementById('sB-etaVal').textContent = sB.etaUscita + ' anni';
  document.getElementById('sB-anni').textContent = sB.anniContributi + ' anni';
  document.getElementById('sB-pensione').textContent = fmt(sB.pensioneMensile) + '/mese';
  document.getElementById('sB-tasso').textContent = fmtPct(sB.tassoSostituzione);
  document.getElementById('sB-gap').textContent = sB.gap >= 0 ? '+' + fmt(sB.gap) + '/mese' : fmt(sB.gap) + '/mese';
  document.getElementById('sB-requisiti').textContent = sB.requisitiNote;
  setTimeout(() => {
    document.getElementById('sB-bar').style.width = clamp(sB.tassoSostituzione * 100, 0, 100) + '%';
  }, 200);

  // ── Scenario C ────
  const sC = scenari.C;
  const colC = getColoreScenario(sC.tassoSostituzione);
  const elC = document.getElementById('scenarioC');
  elC.className = `result-scenario scenario--${colC}`;
  document.getElementById('sC-eta').textContent = (sC.etaUscita || '—') + (sC.etaUscita ? ' anni' : '');
  document.getElementById('sC-etaVal').textContent = (sC.etaUscita || '—') + (sC.etaUscita ? ' anni' : '');
  document.getElementById('sC-anni').textContent = '42 anni e 10 mesi';
  document.getElementById('sC-pensione').textContent = fmt(sC.pensioneMensile) + '/mese';
  document.getElementById('sC-tasso').textContent = fmtPct(sC.tassoSostituzione);
  document.getElementById('sC-gap').textContent = sC.gap >= 0 ? '+' + fmt(sC.gap) + '/mese' : fmt(sC.gap) + '/mese';
  document.getElementById('sC-mancanti').textContent = sC.anniMancanti > 0 ? sC.anniMancanti + ' anni' : 'Già raggiunti ✓';
  setTimeout(() => {
    document.getElementById('sC-bar').style.width = clamp(sC.tassoSostituzione * 100, 0, 100) + '%';
  }, 300);

  // ── Raccomandazione ────
  const rec = generaRaccomandazione(input, scenari);
  document.getElementById('recText').textContent = rec;

  // Scroll ai risultati su mobile
  if (window.innerWidth < 900) {
    document.getElementById('risultati').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// ── VALIDAZIONE INPUT ─────────────────────────────────────────
function leggiInput() {
  const eta = parseInt(document.getElementById('eta').value);
  const tipo = document.getElementById('tipo').value;
  const anniContributi = parseFloat(document.getElementById('anni-contributi').value);
  const reddito = parseFloat(document.getElementById('reddito').value);
  const montanteInput = parseFloat(document.getElementById('montante').value) || 0;
  const aliquota = parseFloat(document.getElementById('aliquota').value);
  const etaUscita = parseInt(document.getElementById('eta-uscita').value);
  const spesaMensile = parseFloat(document.getElementById('spesa-mensile').value);
  const risparmi = parseFloat(document.getElementById('risparmi').value) || 0;
  const rivalutazione = parseFloat(document.getElementById('rivalutazione').value);

  const errori = [];
  if (!eta || eta < 18 || eta > 80) errori.push('Inserisci un\'età valida (18-80)');
  if (!tipo) errori.push('Seleziona il tipo di lavoratore');
  if (!anniContributi || anniContributi < 0) errori.push('Inserisci gli anni di contributi');
  if (!reddito || reddito < 1000) errori.push('Inserisci il reddito annuo lordo');
  if (!etaUscita || etaUscita < 55 || etaUscita > 75) errori.push('Inserisci un\'età obiettivo valida (55-75)');
  if (!spesaMensile || spesaMensile < 0) errori.push('Inserisci la spesa mensile desiderata');
  if (etaUscita && eta && etaUscita <= eta) errori.push('L\'età obiettivo deve essere maggiore dell\'età attuale');

  return { valido: errori.length === 0, errori, input: { eta, tipo, anniContributi, reddito, montanteInput, aliquota, etaUscita, spesaMensile, risparmi, rivalutazione } };
}

// ── EVENT LISTENER ────────────────────────────────────────────
document.getElementById('btnCalcola').addEventListener('click', () => {
  const { valido, errori, input } = leggiInput();

  if (!valido) {
    alert('Correggi i seguenti campi:\n\n• ' + errori.join('\n• '));
    return;
  }

  const btn = document.getElementById('btnCalcola');
  btn.textContent = 'Calcolo in corso...';
  btn.disabled = true;

  // Piccolo delay per UX
  setTimeout(() => {
    try {
      const scenari = calcolaScenari(input);
      renderRisultati(input, scenari);
    } catch (e) {
      console.error('Errore calcolo:', e);
      alert('Errore durante il calcolo. Verifica i dati inseriti.');
    } finally {
      btn.textContent = 'Ricalcola scenari →';
      btn.disabled = false;
    }
  }, 300);
});

// Aliquota auto-aggiornamento in base al tipo lavoratore
document.getElementById('tipo').addEventListener('change', function () {
  const aliquotaEl = document.getElementById('aliquota');
  const mappa = {
    'dipendente': '33',
    'dipendente-pub': '33',
    'autonomo': '25',
    'commerciante': '25',
    'professionista': '26.23',
  };
  if (mappa[this.value]) aliquotaEl.value = mappa[this.value];
});
