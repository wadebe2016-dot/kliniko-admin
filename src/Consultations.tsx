import { useEffect, useState } from 'react';
import {
  aPermission,
  createConsultation,
  getConsultations,
  getPatients,
  getRendezVous,
  suggererCompteRendu,
  updateConsultation,
  type Consultation,
  type Patient,
  type RendezVous,
} from './api';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtMontant = (n: string | number) => Number(n).toLocaleString('fr-FR');

const PAIEMENT_LIBELLE: Record<string, string> = {
  momo: 'Mobile Money',
  especes: 'Espèces à la caisse',
};

// L'etat caisse d'un rendez-vous pris en ligne : deduit de sa facture.
// C'est lui qui autorise (ou non) le passage en pre-consultation.
function etatCaisse(r: RendezVous): {
  pret: boolean;
  texte: string;
  fond: string;
} | null {
  if (r.facture && r.facture.statut !== 'annulee') {
    if (r.facture.statut === 'reglee') {
      return {
        pret: true,
        texte: `✓ Payé (${r.facture.numero}) — prêt pour la pré-consultation`,
        fond: '#c5e8d2',
      };
    }
    const paye = Number(r.facture.montantPaye);
    return {
      pret: false,
      texte: `En attente caisse — ${r.facture.numero} : ${fmtMontant(paye)} / ${fmtMontant(r.facture.montantTotal)} XAF réglés`,
      fond: '#f6e7c9',
    };
  }
  if (r.montantPrevu != null) {
    return {
      pret: false,
      texte: 'Facture non générée — confirmez le rendez-vous dans l’Agenda',
      fond: '#f8d9dc',
    };
  }
  return null;
}

type Props = {
  onSessionExpiree: () => void;
};

function Consultations({ onSessionExpiree }: Props) {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [rdvs, setRdvs] = useState<RendezVous[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtre de la liste (dossier medical d'un patient)
  const [filtrePatient, setFiltrePatient] = useState('');

  // Formulaire de creation
  const [patientId, setPatientId] = useState('');
  const [rendezVousId, setRendezVousId] = useState('');
  const [motif, setMotif] = useState('');
  const [observations, setObservations] = useState('');
  const [diagnostic, setDiagnostic] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Consultation ouverte en detail (edition du contenu medical)
  const [detail, setDetail] = useState<Consultation | null>(null);
  const [editMotif, setEditMotif] = useState('');
  const [editObservations, setEditObservations] = useState('');
  const [editDiagnostic, setEditDiagnostic] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [iaEnCours, setIaEnCours] = useState(false);

  function gererErreur(e: Error, poserErreur: (m: string) => void) {
    if (e.message.includes('reconnecter')) {
      onSessionExpiree();
    } else {
      poserErreur(e.message);
    }
  }

  async function charger(patientFiltre?: string) {
    try {
      setLoading(true);
      const [listeConsultations, listePatients, listeRdvs] = await Promise.all([
        getConsultations(patientFiltre || undefined),
        getPatients(),
        aPermission('rdv.lire') ? getRendezVous() : Promise.resolve([]),
      ]);
      setConsultations(listeConsultations);
      setPatients(listePatients);
      setRdvs(listeRdvs);
      setError(null);
    } catch (e) {
      gererErreur(e as Error, setError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    charger(filtrePatient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrePatient]);

  // Rendez-vous proposes : ceux du patient choisi, encore actifs
  const rdvsDuPatient = rdvs.filter(
    (r) =>
      r.patientId === patientId &&
      (r.statut === 'planifie' || r.statut === 'confirme'),
  );

  // Le rendez-vous lie choisi : s'il vient de l'application patient, son
  // bandeau de pre-consultation s'affiche pour l'infirmiere.
  const rdvChoisi = rdvsDuPatient.find((r) => r.id === rendezVousId) ?? null;
  const caisseRdv = rdvChoisi ? etatCaisse(rdvChoisi) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const c = await createConsultation({
        patientId,
        rendezVousId: rendezVousId || undefined,
        motif: motif || undefined,
        observations: observations || undefined,
        diagnostic: diagnostic || undefined,
      });
      setPatientId('');
      setRendezVousId('');
      setMotif('');
      setObservations('');
      setDiagnostic('');
      await charger(filtrePatient);
      ouvrirDetail(c);
    } catch (err) {
      gererErreur(err as Error, setFormError);
    } finally {
      setSubmitting(false);
    }
  }

  function ouvrirDetail(c: Consultation) {
    setDetail(c);
    setEditMotif(c.motif ?? '');
    setEditObservations(c.observations ?? '');
    setEditDiagnostic(c.diagnostic ?? '');
    setSaveError(null);
    setSaveOk(false);
  }

  async function handleEnregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const c = await updateConsultation(detail.id, {
        motif: editMotif || undefined,
        observations: editObservations || undefined,
        diagnostic: editDiagnostic || undefined,
      });
      setDetail(c);
      setSaveOk(true);
      await charger(filtrePatient);
    } catch (err) {
      gererErreur(err as Error, setSaveError);
    } finally {
      setSaving(false);
    }
  }

  async function handleSuggestionIa() {
    if (!detail) return;
    setIaEnCours(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const { suggestion } = await suggererCompteRendu(detail.id);
      // La proposition remplit la zone d'observations :
      // le praticien la relit, la corrige, puis enregistre (= validation).
      setEditObservations(suggestion);
    } catch (err) {
      gererErreur(err as Error, setSaveError);
    } finally {
      setIaEnCours(false);
    }
  }

  return (
    <>
      {aPermission('consultation.creer') && (
        <section className="card form-card">
          <h2>Nouvelle consultation</h2>
          <form onSubmit={handleSubmit} className="form">
            <div className="field">
              <label>Patient</label>
              <select
                value={patientId}
                onChange={(e) => {
                  setPatientId(e.target.value);
                  setRendezVousId('');
                }}
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
            {rdvsDuPatient.length > 0 && (
              <div className="field">
                <label>Rendez-vous lié (passera en « honoré »)</label>
                <select
                  value={rendezVousId}
                  onChange={(e) => {
                    setRendezVousId(e.target.value);
                    // Le motif de la demande en ligne pre-remplit le champ
                    const r = rdvsDuPatient.find(
                      (x) => x.id === e.target.value,
                    );
                    if (r?.motif && !motif) setMotif(r.motif);
                  }}
                >
                  <option value="">Aucun (consultation directe)</option>
                  {rdvsDuPatient.map((r) => (
                    <option key={r.id} value={r.id}>
                      {fmtDate(r.debut)}
                      {r.acte ? ` — ${r.acte.libelle}` : ''}
                      {r.motif ? ` — ${r.motif}` : ''}
                      {r.origine === 'patient' ? ' (App)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Bandeau de pre-consultation : tout ce que l'infirmiere doit
                savoir avant de prendre les parametres. L'etat "pret" est
                deduit de la facture liee, jamais coche a la main. */}
            {rdvChoisi && (rdvChoisi.acte || rdvChoisi.montantPrevu != null) && (
              <div
                style={{
                  border: '1px solid #d7dee6',
                  borderLeft: `4px solid ${caisseRdv?.pret ? '#2E7D5B' : '#B7791F'}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 12,
                  background: '#fafcfc',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  Pré-consultation — demande en ligne
                </div>
                <div style={{ fontSize: '0.9em', lineHeight: 1.7 }}>
                  <div>
                    <strong>Patient :</strong> {rdvChoisi.patient.nom}{' '}
                    {rdvChoisi.patient.prenom ?? ''}{' '}
                    <span className="muted">
                      ({rdvChoisi.patient.numeroDossier})
                    </span>
                  </div>
                  {rdvChoisi.acte && (
                    <div>
                      <strong>Prestation :</strong> {rdvChoisi.acte.libelle}
                      {rdvChoisi.montantPrevu != null &&
                        ` — ${fmtMontant(rdvChoisi.montantPrevu)} XAF`}
                    </div>
                  )}
                  {rdvChoisi.modePaiement && (
                    <div>
                      <strong>Règlement prévu :</strong>{' '}
                      {PAIEMENT_LIBELLE[rdvChoisi.modePaiement]}
                    </div>
                  )}
                  {rdvChoisi.assurance && (
                    <div>
                      <strong>Prise en charge :</strong>{' '}
                      {rdvChoisi.assurance.nom} — vérifier la carte à
                      l'accueil
                    </div>
                  )}
                  {caisseRdv && (
                    <div style={{ marginTop: 6 }}>
                      <span
                        style={{
                          background: caisseRdv.fond,
                          borderRadius: 10,
                          padding: '3px 12px',
                          fontSize: '0.95em',
                        }}
                      >
                        {caisseRdv.texte}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="field">
              <label>Motif</label>
              <input
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Fièvre et maux de tête"
              />
            </div>
            <div className="field">
              <label>Observations</label>
              <textarea
                rows={4}
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Examen clinique, constantes, notes…"
              />
            </div>
            <div className="field">
              <label>Diagnostic</label>
              <input
                value={diagnostic}
                onChange={(e) => setDiagnostic(e.target.value)}
                placeholder="Paludisme simple"
              />
            </div>
            {formError && <p className="error">{formError}</p>}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Enregistrement…' : 'Enregistrer la consultation'}
            </button>
          </form>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Consultations</h2>
          <span className="count">{consultations.length}</span>
          <select
            value={filtrePatient}
            onChange={(e) => setFiltrePatient(e.target.value)}
            style={{ marginLeft: 'auto', padding: '0.4rem 0.6rem' }}
          >
            <option value="">Tous les patients</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.recordNumber} — {p.lastName} {p.firstName}
              </option>
            ))}
          </select>
        </div>
        {loading && <p className="muted">Chargement…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && consultations.length === 0 && (
          <p className="muted">Aucune consultation pour le moment.</p>
        )}
        {!loading && !error && consultations.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Patient</th>
                <th>Praticien</th>
                <th>Motif</th>
                <th>Diagnostic</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {consultations.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{fmtDate(c.dateConsultation)}</td>
                  <td>
                    {c.patient.nom} {c.patient.prenom ?? ''}
                  </td>
                  <td>
                    {c.praticien
                      ? `Dr ${c.praticien.nom} ${c.praticien.prenom ?? ''}`
                      : '—'}
                  </td>
                  <td>{c.motif || '—'}</td>
                  <td>{c.diagnostic || '—'}</td>
                  <td>
                    <button
                      type="button"
                      style={{ padding: '2px 10px', cursor: 'pointer' }}
                      onClick={() => ouvrirDetail(c)}
                    >
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {detail && (
        <section className="card list-card">
          <div className="list-header">
            <h2>
              Consultation du {fmtDate(detail.dateConsultation)} —{' '}
              {detail.patient.nom} {detail.patient.prenom ?? ''}
            </h2>
            <button
              type="button"
              style={{
                marginLeft: 'auto',
                padding: '2px 10px',
                cursor: 'pointer',
              }}
              onClick={() => setDetail(null)}
            >
              Fermer
            </button>
          </div>
          <p className="muted">
            {detail.praticien
              ? `Dr ${detail.praticien.nom} ${detail.praticien.prenom ?? ''}${detail.praticien.specialite ? ` — ${detail.praticien.specialite}` : ''}`
              : 'Praticien non renseigné'}
            {detail.rendezVous
              ? ` · liée au rendez-vous du ${fmtDate(detail.rendezVous.debut)}`
              : ''}
          </p>
          {aPermission('consultation.modifier') ? (
            <form onSubmit={handleEnregistrer} className="form">
              <div className="field">
                <label>Motif</label>
                <input
                  value={editMotif}
                  onChange={(e) => setEditMotif(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Observations</label>
                <textarea
                  rows={8}
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSuggestionIa}
                  disabled={iaEnCours}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '4px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {iaEnCours
                    ? 'Rédaction en cours…'
                    : '✨ Suggérer un compte-rendu (IA)'}
                </button>
              </div>
              <div className="field">
                <label>Diagnostic</label>
                <input
                  value={editDiagnostic}
                  onChange={(e) => setEditDiagnostic(e.target.value)}
                />
              </div>
              {saveError && <p className="error">{saveError}</p>}
              {saveOk && <p className="muted">Modifications enregistrées.</p>}
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </form>
          ) : (
            <div>
              <p>
                <strong>Motif :</strong> {detail.motif || '—'}
              </p>
              <p>
                <strong>Observations :</strong> {detail.observations || '—'}
              </p>
              <p>
                <strong>Diagnostic :</strong> {detail.diagnostic || '—'}
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}

export default Consultations;
