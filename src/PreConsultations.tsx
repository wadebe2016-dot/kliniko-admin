import { useEffect, useState } from 'react';
import {
  aPermission,
  createPreConsultation,
  getPatients,
  getPreConsultations,
  getRendezVous,
  type Patient,
  type PreConsultation,
  type RendezVous,
} from './api';

const fmtHeure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtMontant = (n: string | number) => Number(n).toLocaleString('fr-FR');

// L'etat caisse d'un rendez-vous : deduit de sa facture, jamais stocke.
function etatCaisse(
  r: RendezVous,
): { pret: boolean; texte: string; fond: string } | null {
  if (r.facture && r.facture.statut !== 'annulee') {
    if (r.facture.statut === 'reglee') {
      return { pret: true, texte: '✓ Payé — prêt', fond: '#c5e8d2' };
    }
    const paye = Number(r.facture.montantPaye);
    return {
      pret: false,
      texte:
        paye > 0
          ? `En attente caisse (${fmtMontant(paye)} / ${fmtMontant(r.facture.montantTotal)})`
          : 'En attente caisse',
      fond: '#f6e7c9',
    };
  }
  if (r.montantPrevu != null) {
    return { pret: false, texte: 'Facture à la confirmation', fond: '#e2ecfb' };
  }
  return null;
}

// Resume lisible des constantes d'une prise
function resumeConstantes(p: PreConsultation): string {
  const parts: string[] = [];
  if (p.tensionSys != null && p.tensionDia != null) {
    parts.push(`TA ${p.tensionSys}/${p.tensionDia}`);
  }
  if (p.temperature != null) parts.push(`${Number(p.temperature)} °C`);
  if (p.poids != null) parts.push(`${Number(p.poids)} kg`);
  if (p.taille != null) parts.push(`${p.taille} cm`);
  if (p.pouls != null) parts.push(`${p.pouls} bpm`);
  if (p.saturation != null) parts.push(`SpO2 ${p.saturation} %`);
  return parts.join(' · ') || '—';
}

type Props = {
  onSessionExpiree: () => void;
};

function PreConsultations({ onSessionExpiree }: Props) {
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [prises, setPrises] = useState<PreConsultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de prise : pre-rempli depuis la file, ou patient de passage
  const [formOuvert, setFormOuvert] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [rendezVousId, setRendezVousId] = useState('');
  const [enTete, setEnTete] = useState(''); // rappel patient/heure dans le titre
  const [tensionSys, setTensionSys] = useState('');
  const [tensionDia, setTensionDia] = useState('');
  const [temperature, setTemperature] = useState('');
  const [poids, setPoids] = useState('');
  const [taille, setTaille] = useState('');
  const [pouls, setPouls] = useState('');
  const [saturation, setSaturation] = useState('');
  const [notes, setNotes] = useState('');
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
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);
      const finJour = new Date();
      finJour.setHours(23, 59, 59, 999);
      const [listeRdv, listePrises, listePatients] = await Promise.all([
        getRendezVous(debutJour.toISOString(), finJour.toISOString()),
        getPreConsultations(undefined, debutJour.toISOString(), finJour.toISOString()),
        getPatients(),
      ]);
      setRdvs(listeRdv);
      setPrises(listePrises);
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

  // La file du jour : les rendez-vous confirmes, dans l'ordre des heures
  const fileDuJour = rdvs
    .filter((r) => r.statut === 'confirme')
    .sort((a, b) => a.debut.localeCompare(b.debut));

  const dejaPrise = (rdvId: string) =>
    prises.some((p) => p.rendezVousId === rdvId);

  function ouvrirDepuisRdv(r: RendezVous) {
    setPatientId(r.patientId);
    setRendezVousId(r.id);
    setEnTete(
      `${r.patient.nom} ${r.patient.prenom ?? ''} (${r.patient.numeroDossier}) — RDV de ${fmtHeure(r.debut)}`,
    );
    viderConstantes();
    setFormOuvert(true);
    window.scrollTo(0, 0);
  }

  function ouvrirSansRdv() {
    setPatientId('');
    setRendezVousId('');
    setEnTete('');
    viderConstantes();
    setFormOuvert(true);
    window.scrollTo(0, 0);
  }

  function viderConstantes() {
    setTensionSys('');
    setTensionDia('');
    setTemperature('');
    setPoids('');
    setTaille('');
    setPouls('');
    setSaturation('');
    setNotes('');
    setFormError(null);
  }

  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createPreConsultation({
        patientId,
        rendezVousId: rendezVousId || undefined,
        tensionSys: num(tensionSys),
        tensionDia: num(tensionDia),
        temperature: num(temperature),
        poids: num(poids),
        taille: num(taille),
        pouls: num(pouls),
        saturation: num(saturation),
        notes: notes.trim() || undefined,
      });
      setFormOuvert(false);
      await charger();
    } catch (err) {
      gererErreur(err as Error, setFormError);
    } finally {
      setSubmitting(false);
    }
  }

  const champNum = (
    label: string,
    valeur: string,
    poser: (v: string) => void,
    placeholder: string,
    step = '1',
  ) => (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step={step}
        value={valeur}
        onChange={(e) => poser(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <>
      {/* ------------------ Formulaire de prise ------------------ */}
      {aPermission('preconsultation.creer') && formOuvert && (
        <section className="card form-card">
          <h2>
            Prise des paramètres
            {enTete ? ` — ${enTete}` : ''}
          </h2>
          <form onSubmit={handleSubmit} className="form">
            {!rendezVousId && (
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
            )}
            <div className="row">
              {champNum('Tension systolique (mmHg)', tensionSys, setTensionSys, '120')}
              {champNum('Tension diastolique (mmHg)', tensionDia, setTensionDia, '80')}
            </div>
            <div className="row">
              {champNum('Température (°C)', temperature, setTemperature, '37.0', '0.1')}
              {champNum('Pouls (bpm)', pouls, setPouls, '72')}
            </div>
            <div className="row">
              {champNum('Poids (kg)', poids, setPoids, '70', '0.1')}
              {champNum('Taille (cm)', taille, setTaille, '170')}
            </div>
            <div className="row">
              {champNum('Saturation SpO2 (%)', saturation, setSaturation, '98')}
              <div className="field">
                <label>Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observation de l'infirmière…"
                />
              </div>
            </div>
            {formError && <p className="error">{formError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="submit"
                disabled={submitting || !patientId}
                className="btn-primary"
              >
                {submitting ? 'Enregistrement…' : 'Enregistrer les paramètres'}
              </button>
              <button
                type="button"
                style={{ padding: '2px 12px', cursor: 'pointer' }}
                onClick={() => setFormOuvert(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ------------------ File du jour ------------------ */}
      <section className="card list-card">
        <div className="list-header">
          <h2>File du jour — rendez-vous confirmés</h2>
          <span className="count">{fileDuJour.length}</span>
          {aPermission('preconsultation.creer') && (
            <button
              type="button"
              className="btn-primary"
              style={{ marginLeft: 'auto', padding: '4px 14px' }}
              onClick={ouvrirSansRdv}
            >
              + Patient sans rendez-vous
            </button>
          )}
        </div>
        {loading && <p className="muted">Chargement…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && fileDuJour.length === 0 && (
          <p className="muted">
            Aucun rendez-vous confirmé aujourd'hui. Les patients de passage
            se prennent avec le bouton ci-dessus.
          </p>
        )}
        {!loading && !error && fileDuJour.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Patient</th>
                <th>Prestation</th>
                <th>Caisse</th>
                <th>Paramètres</th>
              </tr>
            </thead>
            <tbody>
              {fileDuJour.map((r) => {
                const caisse = etatCaisse(r);
                const faite = dejaPrise(r.id);
                return (
                  <tr key={r.id}>
                    <td className="mono">{fmtHeure(r.debut)}</td>
                    <td>
                      {r.patient.nom} {r.patient.prenom ?? ''}
                      <span className="muted"> ({r.patient.numeroDossier})</span>
                      {r.origine === 'patient' && (
                        <span
                          style={{
                            marginLeft: 6,
                            background: '#0f766e',
                            color: '#fff',
                            borderRadius: 10,
                            padding: '1px 8px',
                            fontSize: '0.75em',
                            fontWeight: 600,
                          }}
                        >
                          App
                        </span>
                      )}
                    </td>
                    <td>
                      {r.acte ? r.acte.libelle : r.motif || '—'}
                      {r.montantPrevu != null && (
                        <span className="muted">
                          {' '}
                          · {fmtMontant(r.montantPrevu)} XAF
                        </span>
                      )}
                    </td>
                    <td>
                      {caisse ? (
                        <span
                          style={{
                            background: caisse.fond,
                            borderRadius: 10,
                            padding: '2px 10px',
                            fontSize: '0.85em',
                          }}
                        >
                          {caisse.texte}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {faite ? (
                        <span
                          style={{
                            background: '#c5e8d2',
                            borderRadius: 10,
                            padding: '2px 10px',
                            fontSize: '0.85em',
                          }}
                        >
                          ✓ Pris
                        </span>
                      ) : aPermission('preconsultation.creer') ? (
                        <button
                          type="button"
                          style={{ padding: '2px 10px', cursor: 'pointer' }}
                          onClick={() => ouvrirDepuisRdv(r)}
                        >
                          Prendre les paramètres
                        </button>
                      ) : (
                        <span className="muted">En attente</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------ Prises du jour ------------------ */}
      <section className="card list-card">
        <div className="list-header">
          <h2>Paramètres pris aujourd'hui</h2>
          <span className="count">{prises.length}</span>
        </div>
        {!loading && prises.length === 0 && (
          <p className="muted">Aucune prise pour le moment.</p>
        )}
        {prises.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Patient</th>
                <th>Constantes</th>
                <th>Notes</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {prises.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{fmtHeure(p.datePrise)}</td>
                  <td>
                    {p.patient.nom} {p.patient.prenom ?? ''}
                    <span className="muted"> ({p.patient.numeroDossier})</span>
                  </td>
                  <td>{resumeConstantes(p)}</td>
                  <td>{p.notes || '—'}</td>
                  <td>
                    {p.utilisateur
                      ? `${p.utilisateur.prenom ?? ''} ${p.utilisateur.nom}`.trim()
                      : '—'}
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

export default PreConsultations;
