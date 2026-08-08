import { useCallback, useEffect, useState } from 'react';
import {
  getDemandesConges,
  getSoldesConges,
  getParametresConges,
  majParametresConges,
  creerDemandeConge,
  statuerDemandeConge,
  supprimerDemandeConge,
  getPersonnel,
  type DemandeConge,
  type SoldesConges,
  type MembrePersonnel,
} from './api';

const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

const TYPE_LIBELLE: Record<string, string> = {
  annuel: 'Congé annuel',
  maladie: 'Maladie',
  maternite: 'Maternité',
  exceptionnel: 'Exceptionnel',
  sans_solde: 'Sans solde',
};
const STATUT_LIBELLE: Record<string, string> = {
  en_attente: 'En attente',
  approuve: 'Approuvé',
  refuse: 'Refusé',
};
const STATUT_STYLE: Record<string, { background: string; color: string }> = {
  en_attente: { background: '#fdf3e2', color: '#b7791f' },
  approuve: { background: '#e6f4ec', color: '#1c6b3c' },
  refuse: { background: '#fdece7', color: '#8c3520' },
};

const MODALE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15,23,42,.5)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  overflowY: 'auto',
} as const;
const CARTE_MODALE = {
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 10px 40px rgba(0,0,0,.2)',
} as const;

// Jours ouvrables lun-ven, comme le calcul serveur (apercu cote client)
function joursOuvrables(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const d1 = new Date(debut + 'T00:00:00Z');
  const d2 = new Date(fin + 'T00:00:00Z');
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) {
    return 0;
  }
  let n = 0;
  const cur = new Date(d1);
  while (cur <= d2) {
    const j = cur.getUTCDay();
    if (j !== 0 && j !== 6) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

export default function Conges({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [demandes, setDemandes] = useState<DemandeConge[]>([]);
  const [soldes, setSoldes] = useState<SoldesConges | null>(null);
  const [membres, setMembres] = useState<MembrePersonnel[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [fStatut, setFStatut] = useState('');

  // Nouvelle demande
  const [modaleDemande, setModaleDemande] = useState(false);
  const [dPersonnel, setDPersonnel] = useState('');
  const [dType, setDType] = useState('annuel');
  const [dDebut, setDDebut] = useState('');
  const [dFin, setDFin] = useState('');
  const [dMotif, setDMotif] = useState('');
  const [mErreur, setMErreur] = useState<string | null>(null);

  // Decision (refus motive)
  const [decision, setDecision] = useState<{
    demande: DemandeConge;
    statut: 'approuve' | 'refuse';
  } | null>(null);
  const [dCommentaire, setDCommentaire] = useState('');

  const [aSupprimer, setASupprimer] = useState<DemandeConge | null>(null);

  // Parametres
  const [modaleParams, setModaleParams] = useState(false);
  const [pJours, setPJours] = useState('');

  const traiter = useCallback(
    (e: unknown) => {
      const m = (e as Error).message;
      if (m.includes('reconnecter')) onSessionExpiree();
      else setErreur(m);
    },
    [onSessionExpiree],
  );

  const charger = useCallback(async () => {
    try {
      setChargement(true);
      const [d, s] = await Promise.all([
        getDemandesConges(fStatut || undefined),
        getSoldesConges(),
      ]);
      setDemandes(d);
      setSoldes(s);
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [fStatut, traiter]);

  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    getPersonnel()
      .then(setMembres)
      .catch(() => setMembres([]));
  }, []);

  const apercuJours = joursOuvrables(dDebut, dFin);
  const soldeSelection = soldes?.soldes.find(
    (s) => s.personnelId === dPersonnel,
  );

  async function validerDemande() {
    if (!dPersonnel || !dDebut || !dFin) {
      setMErreur("Choisissez l'employé et les deux dates.");
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await creerDemandeConge({
        personnelId: dPersonnel,
        type: dType,
        dateDebut: dDebut,
        dateFin: dFin,
        motif: dMotif.trim() || undefined,
      });
      setModaleDemande(false);
      setInfo('Demande enregistrée — en attente de validation.');
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function validerDecision() {
    if (!decision) return;
    setEnCours(true);
    setMErreur(null);
    try {
      await statuerDemandeConge(decision.demande.id, {
        statut: decision.statut,
        commentaire: dCommentaire.trim() || undefined,
      });
      setDecision(null);
      setInfo(
        decision.statut === 'approuve'
          ? 'Demande approuvée — le solde est mis à jour.'
          : 'Demande refusée.',
      );
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setEnCours(true);
    setMErreur(null);
    try {
      await supprimerDemandeConge(aSupprimer.id);
      setASupprimer(null);
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrirParams() {
    try {
      const p = await getParametresConges();
      setPJours(String(p.joursAcquisAnnuel));
      setMErreur(null);
      setModaleParams(true);
    } catch (e) {
      traiter(e);
    }
  }

  async function validerParams() {
    setEnCours(true);
    setMErreur(null);
    try {
      await majParametresConges({ joursAcquisAnnuel: Number(pJours) || 0 });
      setModaleParams(false);
      setInfo('Paramètre enregistré.');
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const enAttente = demandes.filter((d) => d.statut === 'en_attente').length;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setDPersonnel('');
            setDType('annuel');
            setDDebut('');
            setDFin('');
            setDMotif('');
            setMErreur(null);
            setModaleDemande(true);
          }}
        >
          + Nouvelle demande
        </button>
        <select value={fStatut} onChange={(e) => setFStatut(e.target.value)}>
          <option value="">Statut — *</option>
          <option value="en_attente">En attente</option>
          <option value="approuve">Approuvé</option>
          <option value="refuse">Refusé</option>
        </select>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={ouvrirParams} title="Jours acquis par an">
          ⚙ Paramètres
        </button>
      </div>

      {erreur && <p className="error">{erreur}</p>}
      {info && <p className="muted">{info}</p>}
      {chargement && <p className="muted">Chargement…</p>}

      {!chargement && (
        <>
          <section className="card list-card">
            <div className="list-header">
              <h2>Demandes</h2>
              <span className="count">{demandes.length}</span>
              {enAttente > 0 && (
                <span className="count" style={{ background: '#fdf3e2', color: '#b7791f' }}>
                  {enAttente} en attente
                </span>
              )}
            </div>
            {demandes.length === 0 && (
              <p className="muted">Aucune demande pour ce filtre.</p>
            )}
            {demandes.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Employé</th>
                    <th>Type</th>
                    <th>Du</th>
                    <th>Au</th>
                    <th>Jours ouvr.</th>
                    <th>Motif</th>
                    <th>Statut</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {demandes.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.personnel.nom} {d.personnel.prenom ?? ''}
                        <span className="muted"> · {d.personnel.fonction ?? ''}</span>
                      </td>
                      <td>{TYPE_LIBELLE[d.type] ?? d.type}</td>
                      <td className="mono">{jour(d.dateDebut)}</td>
                      <td className="mono">{jour(d.dateFin)}</td>
                      <td className="mono">{d.nbJoursOuvrables}</td>
                      <td className="muted">
                        {d.motif ?? ''}
                        {d.commentaireValidation && (
                          <span style={{ color: '#8c3520' }}>
                            {d.motif ? ' — ' : ''}
                            {d.commentaireValidation}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="badge-app" style={STATUT_STYLE[d.statut]}>
                          {STATUT_LIBELLE[d.statut] ?? d.statut}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {d.statut === 'en_attente' && (
                          <>
                            <button
                              type="button"
                              title="Approuver"
                              disabled={enCours}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 700 }}
                              onClick={() => {
                                setDCommentaire('');
                                setMErreur(null);
                                setDecision({ demande: d, statut: 'approuve' });
                              }}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              title="Refuser"
                              disabled={enCours}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c2f2f', fontWeight: 700 }}
                              onClick={() => {
                                setDCommentaire('');
                                setMErreur(null);
                                setDecision({ demande: d, statut: 'refuse' });
                              }}
                            >
                              ✗
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          title="Supprimer"
                          disabled={enCours}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c2f2f' }}
                          onClick={() => {
                            setMErreur(null);
                            setASupprimer(d);
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {soldes && (
            <section className="card list-card">
              <div className="list-header">
                <h2>Soldes {soldes.annee}</h2>
                <span className="muted" style={{ fontSize: 12 }}>
                  {soldes.joursAcquisAnnuel} jours acquis par an (congé annuel)
                </span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Matricule</th>
                    <th>Employé</th>
                    <th>Acquis</th>
                    <th>Pris</th>
                    <th>Restant</th>
                  </tr>
                </thead>
                <tbody>
                  {soldes.soldes.map((s) => (
                    <tr key={s.personnelId}>
                      <td className="mono">{s.matricule ?? '—'}</td>
                      <td>
                        {s.nom} {s.prenom ?? ''}
                        <span className="muted"> · {s.fonction ?? ''}</span>
                      </td>
                      <td className="mono">{s.acquis}</td>
                      <td className="mono">{s.pris}</td>
                      <td className="mono" style={{ fontWeight: 700, color: s.restant < 0 ? '#9c2f2f' : '#1c6b3c' }}>
                        {s.restant}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}

      {modaleDemande && (
        <div style={MODALE} onClick={() => !enCours && setModaleDemande(false)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Nouvelle demande de congé</h3>
            <div className="form">
              <div className="field">
                <label>Employé</label>
                <select value={dPersonnel} onChange={(e) => setDPersonnel(e.target.value)}>
                  <option value="">Choisir…</option>
                  {membres
                    .filter((m) => m.statut === 'actif' || m.statut === 'conge')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom} {m.prenom ?? ''} — {m.fonction}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label>Type</label>
                <select value={dType} onChange={(e) => setDType(e.target.value)}>
                  {Object.entries(TYPE_LIBELLE).map(([cle, lib]) => (
                    <option key={cle} value={cle}>
                      {lib}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row">
                <div className="field">
                  <label>Du</label>
                  <input type="date" value={dDebut} onChange={(e) => setDDebut(e.target.value)} />
                </div>
                <div className="field">
                  <label>Au (inclus)</label>
                  <input type="date" value={dFin} onChange={(e) => setDFin(e.target.value)} />
                </div>
              </div>
              {apercuJours > 0 && (
                <p className="muted">
                  {apercuJours} jour{apercuJours > 1 ? 's' : ''} ouvrable
                  {apercuJours > 1 ? 's' : ''} (lun–ven)
                  {dType === 'annuel' && soldeSelection
                    ? ` — solde restant : ${soldeSelection.restant}`
                    : ''}
                </p>
              )}
              <div className="field">
                <label>Motif (optionnel)</label>
                <input value={dMotif} onChange={(e) => setDMotif(e.target.value)} />
              </div>
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setModaleDemande(false)}>
                  Annuler
                </button>
                <button type="button" className="btn-primary" disabled={enCours} onClick={validerDemande}>
                  {enCours ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {decision && (
        <div style={MODALE} onClick={() => !enCours && setDecision(null)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: decision.statut === 'approuve' ? '#166534' : '#9c2f2f' }}>
              {decision.statut === 'approuve' ? 'Approuver' : 'Refuser'} la demande
            </h3>
            <p>
              {decision.demande.personnel.nom} {decision.demande.personnel.prenom ?? ''} —{' '}
              {TYPE_LIBELLE[decision.demande.type] ?? decision.demande.type}, du{' '}
              {jour(decision.demande.dateDebut)} au {jour(decision.demande.dateFin)} (
              {decision.demande.nbJoursOuvrables} j ouvrables)
            </p>
            <div className="form">
              <div className="field">
                <label>
                  Commentaire {decision.statut === 'refuse' ? '(recommandé)' : '(optionnel)'}
                </label>
                <input value={dCommentaire} onChange={(e) => setDCommentaire(e.target.value)} />
              </div>
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setDecision(null)}>
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  style={{
                    background: decision.statut === 'approuve' ? '#166534' : '#9c2f2f',
                    color: '#fff',
                    border: 'none',
                  }}
                  onClick={validerDecision}
                >
                  {enCours
                    ? 'Enregistrement…'
                    : decision.statut === 'approuve'
                      ? 'Approuver'
                      : 'Refuser'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {aSupprimer && (
        <div style={MODALE} onClick={() => !enCours && setASupprimer(null)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Supprimer cette demande ?</h3>
            <p>
              {aSupprimer.personnel.nom} {aSupprimer.personnel.prenom ?? ''} — du{' '}
              {jour(aSupprimer.dateDebut)} au {jour(aSupprimer.dateFin)}
            </p>
            {aSupprimer.statut === 'approuve' && (
              <p className="muted">
                Demande déjà approuvée : sa suppression rendra les jours au
                solde.
              </p>
            )}
            {mErreur && <p className="error">{mErreur}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" disabled={enCours} onClick={() => setASupprimer(null)}>
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                style={{ background: '#9c2f2f', color: '#fff', border: 'none' }}
                onClick={confirmerSuppression}
              >
                {enCours ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modaleParams && (
        <div style={MODALE} onClick={() => !enCours && setModaleParams(false)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Paramètres des congés</h3>
            <div className="form">
              <div className="field">
                <label>Jours de congé annuel acquis par an</label>
                <input
                  type="number"
                  min={0}
                  value={pJours}
                  onChange={(e) => setPJours(e.target.value)}
                />
              </div>
              <p className="muted" style={{ fontSize: 12 }}>
                Le solde de chaque employé = ce nombre − les jours de congé
                annuel approuvés dans l'année. Seul le type « Congé annuel »
                décompte le solde.
              </p>
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setModaleParams(false)}>
                  Annuler
                </button>
                <button type="button" className="btn-primary" disabled={enCours} onClick={validerParams}>
                  {enCours ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
