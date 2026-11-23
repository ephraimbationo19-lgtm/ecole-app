// Gestion d'école — serveur Node + node:sqlite + interface Web (HTML/CSS/JS sans build)
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const APP = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(APP, 'public');
const db = new DatabaseSync(join(APP, 'ecole.db'), { open: true });

db.exec(`
CREATE TABLE IF NOT EXISTS eleves (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, prenom TEXT NOT NULL,
  naissance TEXT, niveau TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS enseignants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nom TEXT NOT NULL, prenom TEXT NOT NULL,
  matiere TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seances (
  id INTEGER PRIMARY KEY AUTOINCREMENT, matiere TEXT NOT NULL,
  enseignant_id INTEGER REFERENCES enseignants(id), classe TEXT NOT NULL,
  jour TEXT NOT NULL, heure_debut TEXT, heure_fin TEXT
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, seance_id INTEGER REFERENCES seances(id),
  eleve_id INTEGER REFERENCES eleves(id), valeur REAL NOT NULL, date TEXT
);
CREATE TABLE IF NOT EXISTS presences (
  id INTEGER PRIMARY KEY AUTOINCREMENT, seance_id INTEGER REFERENCES seances(id),
  eleve_id INTEGER REFERENCES eleves(id), etat TEXT NOT NULL DEFAULT 'présent', date TEXT
);`);

const ok = (data) => [200, data];

function insert(table, body, fields) {
  const cols = fields.map((f) => `"${f}"`).join(', ');
  const ph = fields.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${ph})`);
  const r = stmt.run(...fields.map((f) => body[f] ?? null));
  return [201, { id: Number(r.lastInsertRowid) }];
}

function del(table, id) {
  db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(Number(id));
  return ok({ deleted: Number(id) });
}

function api(method, path, body) {
  const [, ns, res, id] = path.split('/');
  if (ns !== 'api') return null;

  switch (`${method} ${res}${id ? '#id' : ''}`) {
    case 'GET eleves':
      return ok(db.prepare('SELECT * FROM eleves ORDER BY nom, prenom').all());
    case 'POST eleves':
      return insert('eleves', body, ['nom', 'prenom', 'naissance', 'niveau']);
    case 'DELETE eleves#id':
      return del('eleves', id);

    case 'GET enseignants':
      return ok(db.prepare('SELECT * FROM enseignants ORDER BY nom, prenom').all());
    case 'POST enseignants':
      return insert('enseignants', body, ['nom', 'prenom', 'matiere']);
    case 'DELETE enseignants#id':
      return del('enseignants', id);

    case 'GET seances':
      return ok(db.prepare(`SELECT s.*, e.nom AS en_nom, e.prenom AS en_prenom
        FROM seances s LEFT JOIN enseignants e ON e.id = s.enseignant_id
        ORDER BY s.jour DESC, s.heure_debut`).all());
    case 'POST seances':
      return insert('seances', body, ['matiere', 'enseignant_id', 'classe', 'jour', 'heure_debut', 'heure_fin']);
    case 'DELETE seances#id':
      return del('seances', id);

    case 'GET notes':
      return ok(db.prepare(`SELECT n.*, e.nom, e.prenom, s.classe, s.matiere
        FROM notes n LEFT JOIN eleves e ON e.id = n.eleve_id
        LEFT JOIN seances s ON s.id = n.seance_id ORDER BY n.date DESC, n.id DESC`).all());
    case 'POST notes':
      return insert('notes', { ...body, valeur: Number(body.valeur || 0) }, ['seance_id', 'eleve_id', 'valeur', 'date']);
    case 'PUT notes#id':
      db.prepare('UPDATE notes SET valeur = ? WHERE id = ?').run(Number(body.valeur), Number(id));
      return ok({ id: Number(id) });
    case 'DELETE notes#id':
      return del('notes', id);

    case 'GET presences':
      return ok(db.prepare(`SELECT p.*, e.nom, e.prenom, s.classe
        FROM presences p LEFT JOIN eleves e ON e.id = p.eleve_id
        LEFT JOIN seances s ON s.id = p.seance_id ORDER BY p.date DESC, p.id DESC`).all());
    case 'POST presences':
      return insert('presences', body, ['seance_id', 'eleve_id', 'etat', 'date']);
    case 'DELETE presences#id':
      return del('presences', id);

    case 'GET stats': {
      const stats = {
        eleves: Number(db.prepare('SELECT COUNT(*) c FROM eleves').get().c),
        enseignants: Number(db.prepare('SELECT COUNT(*) c FROM enseignants').get().c),
        seances: Number(db.prepare('SELECT COUNT(*) c FROM seances').get().c),
        absences: Number(db.prepare("SELECT COUNT(*) c FROM presences WHERE etat = 'absent'").get().c),
      };
      stats.moyenneNotes = db.prepare('SELECT AVG(valeur) m FROM notes').get().m ?? 0;
      return ok(stats);
    }
    default:
      return null;
  }
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function serveStatic(res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  try {
    const data = readFileSync(join(PUBLIC, file));
    const ext = file.slice(file.indexOf('.'));
    res.writeHead(200, { 'Content-Type': `${MIME[ext] || 'text/plain'}; charset=utf-8` });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, [status, data]) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

createServer(async (req, res) => {
  const { method } = req;
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const body = method === 'GET' ? null : await readBody(req);
  try {
    const out = api(method, pathname, body);
    if (out) return send(res, out);
    if (method === 'GET') return serveStatic(res, pathname);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message || String(e) }));
  }
}).listen(3000, () => console.log('Gestion \'école\' : http://localhost:3000'));
