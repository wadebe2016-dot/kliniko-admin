import { useEffect, useState } from 'react';
import {
  getPatients,
  createPatient,
  login,
  logout,
  aPermission,
  type Patient,
  type Utilisateur,
} from './api';
import Agenda from './Agenda';
import Factures from './Factures';
import Consultations from './Consultations';
import Utilisateurs from './Utilisateurs';
import MonCompte from './MonCompte';
import Ordonnances from './Ordonnances';
import Disponibilites from './Disponibilites';
import TableauDeBord from './TableauDeBord';
import './App.css';

type Vue =
  | 'tableau'
  | 'patients'
  | 'agenda'
  | 'consultations'
  | 'ordonnances'
  | 'factures'
  | 'disponibilites'
  | 'utilisateurs'
  | 'compte';

const TITRES: Record<Vue, string> = {
  tableau: 'Tableau de bord',
  patients: 'Patients',
  agenda: 'Agenda des rendez-vous',
  consultations: 'Consultations et dossier médical',
  ordonnances: 'Ordonnances et prescriptions',
  factures: 'Facturation et caisse',
  disponibilites: 'Horaires et disponibilités',
  utilisateurs: 'Utilisateurs et rôles',
  compte: 'Mon compte',
};

// La navigation de la barre laterale, groupee par domaine.
// perm absente = visible par tous les connectes.
const GROUPES: {
  libelle: string;
  entrees: { vue: Vue; libelle: string; perm?: string }[];
}[] = [
  {
    libelle: 'Pilotage',
    entrees: [{ vue: 'tableau', libelle: 'Tableau de bord' }],
  },
  {
    libelle: 'Parcours patient',
    entrees: [
      { vue: 'patients', libelle: 'Patients', perm: 'patient.lire' },
      { vue: 'agenda', libelle: 'Agenda', perm: 'rdv.lire' },
      { vue: 'consultations', libelle: 'Consultations', perm: 'consultation.lire' },
      { vue: 'ordonnances', libelle: 'Ordonnances', perm: 'ordonnance.lire' },
    ],
  },
  {
    libelle: 'Finances',
    entrees: [{ vue: 'factures', libelle: 'Facturation', perm: 'facture.lire' }],
  },
  {
    libelle: 'Organisation',
    entrees: [
      { vue: 'disponibilites', libelle: 'Disponibilités', perm: 'rdv.lire' },
      { vue: 'utilisateurs', libelle: 'Utilisateurs', perm: 'utilisateur.gerer' },
    ],
  },
];

function App() {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);
  const [vue, setVue] = useState<Vue>('tableau');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordNumber, setRecordNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | 'other' | 'unknown'>('unknown');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadPatients() {
    try {
      setLoading(true);
      const data = await getPatients();
      setPatients(data);
      setError(null);
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes('reconnecter')) {
        setUtilisateur(null);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (utilisateur && vue === 'patients') {
      loadPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur, vue]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const u = await login(email, motDePasse);
      setMotDePasse('');
      setVue('tableau');
      setUtilisateur(u);
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    logout();
    setUtilisateur(null);
    setPatients([]);
    setEmail('');
    setMotDePasse('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPatient({
        recordNumber,
        firstName,
        lastName,
        sex,
        phone: phone || undefined,
      });
      setRecordNumber('');
      setFirstName('');
      setLastName('');
      setSex('unknown');
      setPhone('');
      await loadPatients();
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('reconnecter')) {
        setUtilisateur(null);
      } else {
        setFormError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const sexLabel = (s: string) =>
    s === 'M' ? 'Masculin' : s === 'F' ? 'Féminin' : s === 'other' ? 'Autre' : '—';

  if (!utilisateur) {
    return (
      <div className="app">
        <header className="header">
          <div className="brand">
            <span className="brand-mark">+</span>
            <h1>Kliniko</h1>
          </div>
          <p className="subtitle">Connexion</p>
        </header>
        <main className="content" style={{ maxWidth: 430, margin: '0 auto' }}>
          <section className="card form-card">
            <h2>Se connecter</h2>
            <form onSubmit={handleLogin} className="form">
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kliniko.cm"
                  autoFocus
                  required
                />
              </div>
              <div className="field">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                />
              </div>
              {loginError && <p className="error">{loginError}</p>}
              <button type="submit" disabled={loggingIn} className="btn-primary">
                {loggingIn ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="coquille">
      {/* ------------------- Barre laterale ------------------- */}
      <aside className="side">
        <div className="side-brand">
          <span className="brand-mark">+</span>
          <b>Kliniko</b>
        </div>
        {GROUPES.map((groupe) => {
          const visibles = groupe.entrees.filter(
            (e) => !e.perm || aPermission(e.perm),
          );
          if (visibles.length === 0) return null;
          return (
            <div key={groupe.libelle}>
              <div className="nav-label">{groupe.libelle}</div>
              {visibles.map((e) => (
                <button
                  key={e.vue}
                  type="button"
                  className={`nav-item ${vue === e.vue ? 'on' : ''}`}
                  onClick={() => setVue(e.vue)}
                >
                  {e.libelle}
                </button>
              ))}
            </div>
          );
        })}
        <div className="side-pied">
          <button
            type="button"
            className={`nav-item ${vue === 'compte' ? 'on' : ''}`}
            onClick={() => setVue('compte')}
          >
            Mon compte
          </button>
          <button type="button" className="side-deco" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ------------------- Zone principale ------------------- */}
      <div className="principal">
        <header className="topbar">
          <h1>{TITRES[vue]}</h1>
          <div className="qui">
            <b>
              {utilisateur.prenom} {utilisateur.nom}
            </b>
            {utilisateur.roles.join(', ')}
          </div>
        </header>
        <div className="zone">
          {vue === 'tableau' ? (
            <TableauDeBord
              onSessionExpiree={() => setUtilisateur(null)}
              onAller={(v) => setVue(v as Vue)}
            />
          ) : vue === 'agenda' ? (
            <Agenda onSessionExpiree={() => setUtilisateur(null)} />
          ) : vue === 'disponibilites' ? (
            <Disponibilites onSessionExpiree={() => setUtilisateur(null)} />
          ) : vue === 'ordonnances' ? (
            <Ordonnances onSessionExpiree={() => setUtilisateur(null)} />
          ) : vue === 'factures' ? (
            <Factures onSessionExpiree={() => setUtilisateur(null)} />
          ) : vue === 'consultations' ? (
            <Consultations onSessionExpiree={() => setUtilisateur(null)} />
          ) : vue === 'utilisateurs' ? (
            <Utilisateurs onSessionExpiree={() => setUtilisateur(null)} />
          ) : vue === 'compte' ? (
            <MonCompte onSessionExpiree={() => setUtilisateur(null)} />
          ) : (
            <main className="content">
              {aPermission('patient.creer') && (
                <section className="card form-card">
                  <h2>Ajouter un patient</h2>
                  <form onSubmit={handleSubmit} className="form">
                    <div className="field">
                      <label>N° dossier</label>
                      <input
                        value={recordNumber}
                        onChange={(e) => setRecordNumber(e.target.value)}
                        placeholder="P-0006"
                        required
                      />
                    </div>
                    <div className="row">
                      <div className="field">
                        <label>Prénom</label>
                        <input
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Aïcha"
                          required
                        />
                      </div>
                      <div className="field">
                        <label>Nom</label>
                        <input
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Etoa"
                          required
                        />
                      </div>
                    </div>
                    <div className="row">
                      <div className="field">
                        <label>Sexe</label>
                        <select
                          value={sex}
                          onChange={(e) => setSex(e.target.value as typeof sex)}
                        >
                          <option value="unknown">Non précisé</option>
                          <option value="F">Féminin</option>
                          <option value="M">Masculin</option>
                          <option value="other">Autre</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Téléphone</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+237 6 00 00 00 00"
                        />
                      </div>
                    </div>
                    {formError && <p className="error">{formError}</p>}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary"
                    >
                      {submitting ? 'Enregistrement…' : 'Enregistrer le patient'}
                    </button>
                  </form>
                </section>
              )}
              <section className="card list-card">
                <div className="list-header">
                  <h2>Patients</h2>
                  <span className="count">{patients.length}</span>
                </div>
                {loading && <p className="muted">Chargement…</p>}
                {error && <p className="error">{error}</p>}
                {!loading && !error && patients.length === 0 && (
                  <p className="muted">Aucun patient pour le moment.</p>
                )}
                {!loading && !error && patients.length > 0 && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>N° dossier</th>
                        <th>Nom</th>
                        <th>Sexe</th>
                        <th>Téléphone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {patients.map((p) => (
                        <tr key={p.id}>
                          <td className="mono">{p.recordNumber}</td>
                          <td>
                            {p.lastName} {p.firstName}
                          </td>
                          <td>{sexLabel(p.sex)}</td>
                          <td>{p.phone || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </main>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
