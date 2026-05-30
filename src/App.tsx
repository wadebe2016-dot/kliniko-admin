import { useEffect, useState } from 'react';
import {
  getPatients,
  createPatient,
  CLINIC_ID,
  type Patient,
} from './api';
import './App.css';

function App() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Champs du formulaire
  const [recordNumber, setRecordNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | 'other' | 'unknown'>('unknown');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Charger les patients au démarrage
  async function loadPatients() {
    try {
      setLoading(true);
      const data = await getPatients();
      setPatients(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients();
  }, []);

  // Soumettre le formulaire
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPatient({
        clinicId: CLINIC_ID,
        recordNumber,
        firstName,
        lastName,
        sex,
        phone: phone || undefined,
      });
      // Réinitialiser le formulaire
      setRecordNumber('');
      setFirstName('');
      setLastName('');
      setSex('unknown');
      setPhone('');
      // Recharger la liste
      await loadPatients();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const sexLabel = (s: string) =>
    s === 'M' ? 'Masculin' : s === 'F' ? 'Féminin' : s === 'other' ? 'Autre' : '—';

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark">+</span>
          <h1>Kliniko</h1>
        </div>
        <p className="subtitle">Gestion des patients</p>
      </header>

      <main className="content">
        <section className="card form-card">
          <h2>Ajouter un patient</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label>N° dossier</label>
              <input
                value={recordNumber}
                onChange={(e) => setRecordNumber(e.target.value)}
                placeholder="P-0002"
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
              {submitting ? 'Enregistrement…' : 'Enregistrer le patient'}
            </button>
          </form>
        </section>

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
    </div>
  );
}

export default App;
