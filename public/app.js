// Gestion d'école — interface Web (vanilla JS)
'use strict';

const app = document.getElementById('app');

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const del = (url) => `<button class="del" data-url="${url}">✕</button>`;
const rows = (list, fn) => list.map(fn).join('');

function addForm(action, fields) {
  const html = fields.map((f) => {
    const value = f.value ? ` value="${f.value}"` : '';
    if (f.select) {
      const opts = f.select.map((o) => `<option value="${o}">${o}</option>`).join('');
      return `<select name="${f.name}"${value}${f.required ? ' required' : ''}>${opts}</select>`;
    }
    return `<input name="${f.name}" placeholder="${f.label}"${value}${f.required ? ' required' : ''}>`;
  }).join('');
  return `<form data-action="${action}" class="row">${html}<button>Ajouter</button></form>`;
}

const tabs = {
  async eleves() {
    const list = await api('GET', '/api/eleves');
    return `<section><h2>Élèves</h2>
      ${addForm('eleves', [
        { name: 'nom', label: 'Nom', required: true },
        { name: 'prenom', label: 'Prénom', required: true },
        { name: 'naissance', label: 'Naissance', value: '' },
        { name: 'niveau', label: 'Niveau', value: '' },
      ])}
      <table><thead><tr><th>Nom</th><th>Prénom</th><th>Naissance</th><th>Niveau</th><th></th></tr></thead>
      <tbody>${rows(list, (e) => `<tr><td>${e.nom}</td><td>${e.prenom}</td><td>${e.naissance}</td><td>${e.niveau}</td><td>${del(`eleves/${e.id}`)}</td></tr>`)}</tbody></table></section>`;
  },

  async enseignants() {
    const list = await api('GET', '/api/enseignants');
    return `<section><h2>Enseignants</h2>
      ${addForm('enseignants', [
        { name: 'nom', label: 'Nom', required: true },
        { name: 'prenom', label: 'Prénom', required: true },
        { name: 'matiere', label: 'Matière', required: true },
      ])}
      <table><thead><tr><th>Nom</th><th>Prénom</th><th>Matière</th><th></th></tr></thead>
      <tbody>${rows(list, (s) => `<tr><td>${s.nom}</td><td>${s.prenom}</td><td>${s.matiere}</td><td>${del(`enseignants/${s.id}`)}</td></tr>`)}</tbody></table></section>`;
  },

  async seances() {
    const list = await api('GET', '/api/seances');
    return `<section><h2>Séances</h2>
      ${addForm('seances', [
        { name: 'matiere', label: 'Matière', required: true },
        { name: 'enseignant_id', label: 'Enseignant (id)' },
        { name: 'classe', label: 'Classe', required: true },
        { name: 'jour', label: 'Jour', required: true },
        { name: 'heure_debut', label: 'Début', value: '' },
        { name: 'heure_fin', label: 'Fin', value: '' },
      ])}
      <table><thead><tr><th>Matière</th><th>Enseignant</th><th>Classe</th><th>Jour</th><th>Début</th><th>Fin</th><th></th></tr></thead>
      <tbody>${rows(list, (s) => `<tr><td>${s.matiere}</td><td>${s.en_prenom} ${s.en_nom}</td><td>${s.classe}</td><td>${s.jour}</td><td>${s.heure_debut}</td><td>${s.heure_fin}</td><td>${del(`seances/${s.id}`)}</td></tr>`)}</tbody></table></section>`;
  },

  async notes() {
    const list = await api('GET', '/api/notes');
    return `<section><h2>Notes</h2>
      ${addForm('notes', [
        { name: 'seance_id', label: 'Séance (id)' },
        { name: 'eleve_id', label: 'Élève (id)', required: true },
        { name: 'valeur', label: 'Note', required: true },
        { name: 'date', label: 'Date', value: new Date().toISOString().slice(0, 10) },
      ])}
      <table><thead><tr><th>Élève</th><th>Classe</th><th>Note</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows(list, (n) => `<tr><td>${n.prenom} ${n.nom}</td><td>${n.classe}</td><td>${n.valeur}</td><td>${n.date}</td><td>${del(`notes/${n.id}`)}</td></tr>`)}</tbody></table></section>`;
  },

  async presences() {
    const list = await api('GET', '/api/presences');
    return `<section><h2>Présences</h2>
      ${addForm('presences', [
        { name: 'seance_id', label: 'Séance (id)' },
        { name: 'eleve_id', label: 'Élève (id)', required: true },
        { name: 'etat', label: 'État', select: ['présent', 'absent'], required: true },
        { name: 'date', label: 'Date', value: new Date().toISOString().slice(0, 10) },
      ])}
      <table><thead><tr><th>Élève</th><th>Classe</th><th>État</th><th>Date</th><th></th></tr></thead>
      <tbody>${rows(list, (p) => `<tr><td>${p.prenom} ${p.nom}</td><td>${p.classe}</td><td>${p.etat}</td><td>${p.date}</td><td>${del(`presences/${p.id}`)}</td></tr>`)}</tbody></table></section>`;
  },
};

let current = null;

async function switchTab(name) {
  current = name;
  document.querySelectorAll('[data-tab]').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === name),
  );
  app.innerHTML = '<div class="loading">Chargement…</div>';
  app.innerHTML = await tabs[name]();
  refreshStats();
}

async function refreshStats() {
  const s = await api('GET', '/api/stats');
  const fmt = (v) => (v == null ? '—' : v.toFixed(2));
  document.getElementById('stats').textContent =
    `Élèves : ${s.eleves} · Enseignants : ${s.enseignants} · Séances : ${s.seances} · Absences : ${s.absences} · Moyenne notes : ${fmt(s.moyenneNotes)}`;
}

document.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  await api('POST', `/api/${e.target.dataset.action}`, body);
  await switchTab(current);
});

document.addEventListener('click', async (e) => {
  const tabBtn = e.target.closest('[data-tab]');
  if (tabBtn) return switchTab(tabBtn.dataset.tab);
  const btn = e.target.closest('[data-url]');
  if (btn) {
    await api('DELETE', `/api/${btn.dataset.url}`);
    await switchTab(current);
  }
});

switchTab('eleves');
