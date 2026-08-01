import { useCallback, useEffect, useState } from 'react';
import {
  aPermission,
  annulerRendezVous,
  changerStatutRendezVous,
  createRendezVous,
  getPatients,
  getPraticiens,
  getDisponibilites,
  getRendezVous,
  type Patient,
  type Praticien,
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

type Creneau = { debut: string; fin: string; heure: string };

type Props = {
  onSessionExpiree: () => void;
};

function Agenda({ onSessionExpiree }: Props) {
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [praticiens, setPraticiens] = useState<Praticien[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [praticienId, setPraticienId] = useState('');
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('09:00');
  const [creneaux, setCreneaux] = useState<Creneau[]>([]);
  const [creneauChoisi, setCreneauChoisi] = useState<Creneau | null>(null);
  const [chargeCreneaux, setChargeCreneaux] = useState(false);
  const [motif, setMotif] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const gererErreur = useCallback(
    (e: Error, poserErreur: (m: string) => void) => {
      if (e.message.includes('reconnecter')) {
        onSessionExpiree();
      } else {
        poserErreur(e.message);
      }
    },
    [onSessionExpiree],
  );

  async function charger() {
    try {
      setLoading(true);
      const [listeRdv, listePatients, listePraticiens] = await Promise.all([
        getRendezVous(),
        getPatients(),
        getPraticiens(),
      ]);
      setRdvs(listeRdv);
      setPatients(listePatients);
      setPraticiens(listePraticiens);
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

  // Des qu'un praticien ET une date sont choisis, on va chercher ses
  // creneaux libres du jour. Le choix se fait alors par pastille.
  useEffect(() => {
    setCreneauChoisi(null);
    if (!praticienId || !date) {
      setCreneaux([]);
      return;
    }
    let annule = false;
    setChargeCreneaux(true);
    getDisponibilites(praticienId, date, date)
      .then((d) => {
        if (!annule) setCreneaux(d.jours[0]?.creneaux ?? []);
      })
      .catch((e) => {
        if (!annule) gererErreur(e as Error, setFormError);
      })
      .finally(() => {
        if (!annule) setChargeCreneaux(false);
      });
    return () => {
      annule = true;
    };
  }, [praticienId, date, gererErreur]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (praticienId && creneauChoisi) {
        await createRendezVous({
          patientId,
          praticienId,
          debut: creneauChoisi.debut,
          fin: creneauChoisi.fin,
          motif: motif || undefined,
        });
      } else {
        await createRendezVous({
          patientId,
          praticienId: praticienId || undefined,
          debut: new Date(`${date}T${heure}`).toISOString(),
          motif: motif || undefined,
        });
      }
      setPatientId('');
      setDate('');
      setHeure('09:00');
      setMotif('');
      setCreneauChoisi(null);
      setCreneaux([]);
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

  const pastille = (actif: boolean): React.CSSProperties => ({
    border: actif ? '2px solid #0f766e' : '1px solid #0f766e',
    background: actif ? '#0f766e' : 'transparent',
    color: actif ? '#fff' : '#0f766e',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: '0.85em',
    cursor: 'pointer',
  });

  const peutModifier = aPermission('rdv.modifier');
  const peutAnnuler = aPermission('rdv.annuler');
  const modeCreneaux = praticienId !== '' && creneaux.length > 0;

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
            <div className="field">
              <label>Praticien</label>
              <select
                value={praticienId}
                onChange={(e) => setPraticienId(e.target.value)}
              >
                <option value="">Sans praticien désigné</option>
                {praticiens.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.prenom} {p.nom}
                    {p.specialite ? ` — ${p.specialite}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {modeCreneaux && (
              <div className="field">
                <label>Créneaux libres</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {creneaux.map((c) => (
                    <button
                      key={c.debut}
                      type="button"
                      style={pastille(creneauChoisi?.debut === c.debut)}
                      onClick={() => setCreneauChoisi(c)}
                    >
                      {c.heure}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {praticienId && date && !chargeCreneaux && creneaux.length === 0 && (
              <p className="muted">
                Aucun créneau libre ce jour (horaires non déclarés, congé ou
                journée complète) — saisie manuelle de l'heure :
              </p>
            )}
            {chargeCreneaux && <p className="muted">Recherche des créneaux…</p>}

            {!modeCreneaux && (
              <div className="field">
                <label>Heure</label>
                <input
                  type="time"
                  value={heure}
                  onChange={(e) => setHeure(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="field">
              <label>Motif</label>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Consultation de suivi"
              />
            </div>
            {formError && <p className="error">{formError}</p>}
            <button
              type="submit"
              disabled={submitting || (modeCreneaux && !creneauChoisi)}
              className="btn-primary"
            >
              {submitting
                ? 'Enregistrement…'
                : modeCreneaux && !creneauChoisi
                  ? 'Choisissez un créneau'
                  : 'Planifier'}
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
