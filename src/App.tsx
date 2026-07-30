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
import './App.css';

function App() {
  // Utilisateur connecté (null = écran de connexion)
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null);

  // Champs de l'écran de connexion
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Champs du formulaire patient
  const [recordNumber, setRecordNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | 'other' | 'unknown'>('unknown');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Charger les patients (une fois connecté)
  async function loadPatients() {
    try {
      setLoading(true);
      const data = await getPatients();
      setPatients(data);
      setError(null);
    } catch (e) {
      const message = (e as Error).message;
      // Jeton expiré : retour à l'écran de connexion
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
    if (utilisateur) {
      loadPatients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur]);

  // Connexion
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const u = await login(email, motDePasse);
      setMotDePasse('');
      setUtilisateur(u);
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoggingIn(false);
    }
  }

  // Déconnexion
  function handleLogout() {
    logout();
    setUtilisateur(null);
    setPatients([]);
    setEmail('');
    setMotDePasse('');
  }

  // Soumettre le formulaire patient
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

  // Écran de connexion
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
                {loggingIn ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>
          </section>
        </main>
      </div>
    );
  }

  // Application (utilisateur connecté)
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">+</span>
          <h1>Kliniko</h1>
        </div>
        <p className="subtitle">Gestion des patients</p>
        <p className="muted" style={{ marginTop: 4 }}>
          Connecté : {utilisateur.prenom} {utilisateur.nom} (
          {utilisateur.roles.join(', ')}){' '}
          <button
            type="button"
            onClick={handleLogout}
            style={{
              marginLeft: 8,
              padding: '2px 10px',
              cursor: 'pointer',
              fontSize: '0.85em',
            }}
          >
            Se déconnecter
          </button>
        </p>
      </header>
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
                  placeholder="P-0005"
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
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? 'Enregistrement...' : 'Enregistrer le patient'}
              </button>
            </form>
          </section>
        )}
        <section className="card list-card">
          <div className="list-header">
            <h2>Patients</h2>
            <span className="count">{patients.length}</span>
          </div>
          {loading && <p className="muted">Chargement...</p>}
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
                    <td>{p.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
