import { useEffect, useState } from 'react';
import {
  aPermission,
  annulerRendezVous,
  changerStatutRendezVous,
  createRendezVous,
  getPatients,
  getRendezVous,
  type Patient,
  type RendezVous,
  type StatutRdv,
} from './api';

const STATUT_LABEL: Record<StatutRdv, string> = {
  planifie: 'Planifié',
  confirme: 'Confirmé',
  honore: 'Honoré',
  annule: 'Annulé',
  absent: 'Absent',
};

const STATUT_FOND: Record<StatutRdv, string> = {
  planifie: '#e2ecfb',
  confirme: '#d9f2e5',
  honore: '#c5e8d2',
  annule: '#f8d9dc',
  absent: '#f6e7c9',
};

type Props = {
  onSessionExpiree: () => void;
};

function Agenda({ onSessionExpiree }: Props) {
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de creation
  const [patientId, setPatientId] = useState('');
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('09:00');
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function gererErreur(e: Error, poserErreur: (m: string) => void) {
    if (e.message.includes('reconnecter')) {
      onSessionExpiree();
    } else {
      poserErreur(e.message);
    }
  }

  async function charger() {
    try {
      setLoading(true);
      const [listeRdv, listePatients] = await Promise.all([
        getRendezVous(),
        getPatients(),
      ]);
      setRdvs(listeRdv);
      setPatients(listePatients);
      setError(null);
    } catch (e) {
      gererErreur(e as Error, setError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createRendezVous({
        patientId,
        // Le navigateur convertit l'heure locale en heure universelle
        debut: new Date(`${date}T${heure}`).toISOString(),
        motif: motif || undefined,
      });
      setPatientId('');
      setDate('');
      setHeure('09:00');
      setMotif('');
      await charger();
    } catch (err) {
      gererErreur(err as Error, setFormError);
    } finally {
      setSubmitting(false);
    }
  }

  async function changerStatut(id: string, statut: StatutRdv) {
    try {
      await changerStatutRendezVous(id, statut);
      await charger();
    } catch (e) {
      gererErreur(e as Error, setError);
    }
  }

  async function annuler(id: string) {
    try {
      await annulerRendezVous(id);
      await charger();
    } catch (e) {
      gererErreur(e as Error, setError);
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const boutonStyle: React.CSSProperties = {
    padding: '2px 8px',
    marginRight: 4,
    cursor: 'pointer',
    fontSize: '0.8em',
  };

  const peutModifier = aPermission('rdv.modifier');
  const peutAnnuler = aPermission('rdv.annuler');

  return (
    <>
      {aPermission('rdv.creer') && (
        <section className="card form-card">
          <h2>Planifier un rendez-vous</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label>Patient</label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
              >
                <option value="">Choisir un patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.recordNumber} — {p.lastName} {p.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="field">
                <label>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label>Heure</label>
                <input
                  type="time"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Motif</label>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Consultation de suivi"
              />
            </div>
            {formError && <p className="error">{formError}</p>}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Enregistrement…' : 'Planifier'}
            </button>
          </form>
        </section>
      )}
      <section className="card list-card">
        <div className="list-header">
          <h2>Rendez-vous</h2>
          <span className="count">{rdvs.length}</span>
        </div>
        {loading && <p className="muted">Chargement…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && rdvs.length === 0 && (
          <p className="muted">Aucun rendez-vous pour le moment.</p>
        )}
        {!loading && !error && rdvs.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Motif</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rdvs.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{formatDate(r.debut)}</td>
                  <td>
                    {r.patient.nom} {r.patient.prenom ?? ''}
                    <span className="muted"> ({r.patient.numeroDossier})</span>
                  </td>
                  <td>{r.motif || '—'}</td>
                  <td>
                    <span
                      style={{
                        background: STATUT_FOND[r.statut],
                        borderRadius: 10,
                        padding: '2px 10px',
                        fontSize: '0.85em',
                      }}
                    >
                      {STATUT_LABEL[r.statut]}
                    </span>
                  </td>
                  <td>
                    {peutModifier && r.statut === 'planifie' && (
                      <button
                        type="button"
                        style={boutonStyle}
                        onClick={() => changerStatut(r.id, 'confirme')}
                      >
                        Confirmer
                      </button>
                    )}
                    {peutModifier &&
                      (r.statut === 'planifie' || r.statut === 'confirme') && (
                        <>
                          <button
                            type="button"
                            style={boutonStyle}
                            onClick={() => changerStatut(r.id, 'honore')}
                          >
                            Honoré
                          </button>
                          <button
                            type="button"
                            style={boutonStyle}
                            onClick={() => changerStatut(r.id, 'absent')}
                          >
                            Absent
                          </button>
                        </>
                      )}
                    {peutAnnuler && r.statut !== 'annule' && (
                      <button
                        type="button"
                        style={boutonStyle}
                        onClick={() => annuler(r.id)}
                      >
                        Annuler
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default Agenda;
