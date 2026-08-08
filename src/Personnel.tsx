import { useCallback, useEffect, useState } from 'react';
import {
  getPersonnel,
  getFicheRh,
  getTableauRh,
  creerPersonnel,
  modifierPersonnel,
  modifierFicheRh,
  aPermission,
  type MembrePersonnel,
  type FicheRh,
  type StatutPersonnel,
  type TableauRh,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const jourIso = (iso: string | null | undefined) =>
  iso ? String(iso).slice(0, 10) : '';

const STATUT_LIBELLE: Record<StatutPersonnel, string> = {
  actif: 'Actif',
  conge: 'En congé',
  suspendu: 'Suspendu',
  parti: 'Parti',
};

const STATUT_STYLE: Record<StatutPersonnel, { background: string; color: string }> = {
  actif: { background: '#e6f4ec', color: '#1c6b3c' },
  conge: { background: '#fdf3e2', color: '#b7791f' },
  suspendu: { background: '#fdece7', color: '#8c3520' },
  parti: { background: '#e8ecef', color: '#5b6572' },
};

const PALETTE = ['#1d4f91', '#1c9d55', '#e9a922', '#d64545', '#8a94a1', '#0e9488'];
const SEXE_LIBELLE: Record<string, string> = {
  M: 'Masculin',
  F: 'Féminin',
  'Non défini': '?',
};

// Anneau de repartition en pur CSS (conic-gradient), avec sa legende
function Anneau({ donnees }: { donnees: { cle: string; nombre: number }[] }) {
  const total = donnees.reduce((s, d) => s + d.nombre, 0);
  if (total === 0) return <p className="muted">Aucune donnée.</p>;
  let acc = 0;
  const parts = donnees.map((d, i) => {
    const debut = (acc / total) * 100;
    acc += d.nombre;
    const fin = (acc / total) * 100;
    return `${PALETTE[i % PALETTE.length]} ${debut}% ${fin}%`;
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: `conic-gradient(${parts.join(', ')})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 'none',
        }}
      >
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: '50%',
            background: '#fff',
          }}
        />
      </div>
      <div>
        {donnees.map((d, i) => (
          <div key={d.cle} style={{ fontSize: 13, marginBottom: 3 }}>
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 10,
                borderRadius: 2,
                background: PALETTE[i % PALETTE.length],
                marginRight: 6,
              }}
            />
            {SEXE_LIBELLE[d.cle] ?? d.cle}
            <span className="muted"> · {d.nombre}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Personnel({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [membres, setMembres] = useState<MembrePersonnel[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Nouveau membre (fiche de base)
  const [nNom, setNNom] = useState('');
  const [nPrenom, setNPrenom] = useState('');
  const [nFonction, setNFonction] = useState('');
  const [nService, setNService] = useState('');
  const [nTelephone, setNTelephone] = useState('');
  const [nMatricule, setNMatricule] = useState('');

  // Modale
  const [mMembre, setMMembre] = useState<MembrePersonnel | null>(null);
  const [mNom, setMNom] = useState('');
  const [mPrenom, setMPrenom] = useState('');
  const [mFonction, setMFonction] = useState('');
  const [mService, setMService] = useState('');
  const [mTelephone, setMTelephone] = useState('');
  const [mStatut, setMStatut] = useState<StatutPersonnel>('actif');
  const [mErreur, setMErreur] = useState<string | null>(null);

  // Fiche RH sensible (chargee uniquement si permission personnel.rh)
  const [rh, setRh] = useState<FicheRh | null>(null);
  const [rhContrat, setRhContrat] = useState('');
  const [rhEmbauche, setRhEmbauche] = useState('');
  const [rhSalaire, setRhSalaire] = useState('');
  const [rhCnps, setRhCnps] = useState('');

  const peutGerer = aPermission('personnel.gerer');
  const estRh = aPermission('personnel.rh');

  // Onglets internes, sur le modele Edufo
  const [onglet, setOnglet] = useState<'tableau' | 'dossiers'>(
    estRh ? 'tableau' : 'dossiers',
  );
  const [tdb, setTdb] = useState<TableauRh | null>(null);

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
      setMembres(await getPersonnel());
      if (aPermission('personnel.rh')) {
        setTdb(await getTableauRh());
      }
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [traiter]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function validerCreation() {
    if (!nNom.trim() || !nFonction.trim()) {
      setErreur('Le nom et la fonction sont obligatoires');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await creerPersonnel({
        nom: nNom.trim(),
        fonction: nFonction.trim(),
        prenom: nPrenom.trim() || undefined,
        service: nService.trim() || undefined,
        telephone: nTelephone.trim() || undefined,
        matricule: nMatricule.trim() || undefined,
      });
      setNNom('');
      setNPrenom('');
      setNFonction('');
      setNService('');
      setNTelephone('');
      setNMatricule('');
      setInfo('Fiche créée — le volet RH peut être complété dans la fiche.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrirMembre(p: MembrePersonnel) {
    setMMembre(p);
    setMNom(p.nom);
    setMPrenom(p.prenom ?? '');
    setMFonction(p.fonction);
    setMService(p.service ?? '');
    setMTelephone(p.telephone ?? '');
    setMStatut(p.statut);
    setMErreur(null);
    setRh(null);
    if (estRh) {
      try {
        const fiche = await getFicheRh(p.id);
        setRh(fiche);
        setRhContrat(fiche.typeContrat ?? '');
        setRhEmbauche(jourIso(fiche.dateEmbauche));
        setRhSalaire(
          fiche.salaireBase !== null ? String(fiche.salaireBase) : '',
        );
        setRhCnps(fiche.numeroCnps ?? '');
      } catch {
        // la fiche de base reste editable meme si le volet RH echoue
      }
    }
  }

  function fermerModale() {
    setMMembre(null);
    setRh(null);
    setMErreur(null);
  }

  async function enregistrer() {
    if (!mMembre) return;
    if (!mNom.trim() || !mFonction.trim()) {
      setMErreur('Le nom et la fonction sont obligatoires');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await modifierPersonnel(mMembre.id, {
        nom: mNom.trim(),
        fonction: mFonction.trim(),
        prenom: mPrenom.trim(),
        service: mService.trim(),
        telephone: mTelephone.trim(),
        statut: mStatut,
      });
      if (estRh && rh) {
        await modifierFicheRh(mMembre.id, {
          typeContrat: rhContrat.trim(),
          dateEmbauche: rhEmbauche || undefined,
          salaireBase: rhSalaire ? Number(rhSalaire) : undefined,
          numeroCnps: rhCnps.trim(),
        });
      }
      fermerModale();
      setInfo('Fiche mise à jour.');
      setErreur(null);
      await charger();
    } catch (e) {
      const m = (e as Error).message;
      if (m.includes('reconnecter')) onSessionExpiree();
      else setMErreur(m);
    } finally {
      setEnCours(false);
    }
  }

  const actifs = membres.filter((p) => p.statut === 'actif').length;
  const masseSalariale = estRh
    ? membres
        .filter((p) => p.statut === 'actif')
        .reduce((s, p) => s + (p.salaireBase ?? 0), 0)
    : null;

  const jourFr = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
  const joursRestants = (iso: string | null) =>
    iso
      ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
      : null;
  const masseMax = tdb
    ? Math.max(1, ...tdb.masseParFonction.map((f) => f.masse))
    : 1;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {estRh && (
          <button
            type="button"
            className={onglet === 'tableau' ? 'btn-primary' : ''}
            style={{ padding: '6px 16px' }}
            onClick={() => setOnglet('tableau')}
          >
            Tableau de bord
          </button>
        )}
        <button
          type="button"
          className={onglet === 'dossiers' ? 'btn-primary' : ''}
          style={{ padding: '6px 16px' }}
          onClick={() => setOnglet('dossiers')}
        >
          Dossiers du personnel
        </button>
        <button type="button" disabled style={{ padding: '6px 16px' }} title="Phase 2 — à venir">
          Paie
        </button>
        <button type="button" disabled style={{ padding: '6px 16px' }} title="Phase 2 — à venir">
          Congés
        </button>
      </div>

      {onglet === 'tableau' && estRh && tdb && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <section className="card">
              <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                EFFECTIF
              </div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>{tdb.effectif}</div>
            </section>
            <section className="card">
              <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                MASSE SALARIALE
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1c6b3c' }}>
                {XAF(tdb.masseSalariale)}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Salaires de base, par mois
              </div>
            </section>
            <section className="card">
              <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                CONTRATS À ÉCHÉANCE
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  color: tdb.contratsEcheance.length > 0 ? '#b7791f' : undefined,
                }}
              >
                {tdb.contratsEcheance.length}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                Dans les 60 prochains jours
              </div>
            </section>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <section className="card">
              <h2 style={{ marginBottom: 10 }}>Répartition par contrat</h2>
              <Anneau donnees={tdb.parContrat} />
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 10 }}>Répartition par sexe</h2>
              <Anneau donnees={tdb.parSexe} />
            </section>
            <section className="card">
              <h2 style={{ marginBottom: 10 }}>Masse salariale par fonction</h2>
              {tdb.masseParFonction.map((f) => (
                <div key={f.fonction} style={{ marginBottom: 7 }}>
                  <div style={{ fontSize: 12.5, marginBottom: 2 }}>
                    {f.fonction}
                    <span className="muted"> · {XAF(f.masse)}</span>
                  </div>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 5,
                      background: '#1d4f91',
                      width: `${Math.max(3, (f.masse / masseMax) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </section>
          </div>

          <section className="card">
            <div className="list-header">
              <h2>Contrats arrivant à échéance (60 jours)</h2>
            </div>
            {tdb.contratsEcheance.length === 0 && (
              <p className="muted">Aucun contrat n'arrive à échéance.</p>
            )}
            {tdb.contratsEcheance.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Fonction</th>
                    <th>Type de contrat</th>
                    <th>Fin de contrat</th>
                  </tr>
                </thead>
                <tbody>
                  {tdb.contratsEcheance.map((c, i) => (
                    <tr key={i}>
                      <td>
                        {c.nom} {c.prenom ?? ''}
                      </td>
                      <td>{c.fonction}</td>
                      <td>{c.typeContrat ?? '—'}</td>
                      <td>
                        <b style={{ color: '#b7791f' }}>{jourFr(c.dateFinContrat)}</b>{' '}
                        <span className="muted">
                          ({joursRestants(c.dateFinContrat)} jours)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {onglet === 'dossiers' && (
        <>
      {peutGerer && (
        <section className="card form-card">
          <h2>Nouveau membre du personnel</h2>
          <div className="form">
            <div className="row">
              <div className="field">
                <label>Nom</label>
                <input value={nNom} onChange={(e) => setNNom(e.target.value)} />
              </div>
              <div className="field">
                <label>Prénom</label>
                <input
                  value={nPrenom}
                  onChange={(e) => setNPrenom(e.target.value)}
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Fonction</label>
                <input
                  value={nFonction}
                  onChange={(e) => setNFonction(e.target.value)}
                  placeholder="Infirmier, caissier…"
                />
              </div>
              <div className="field">
                <label>Service</label>
                <input
                  value={nService}
                  onChange={(e) => setNService(e.target.value)}
                  placeholder="Soins, Accueil…"
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Téléphone</label>
                <input
                  value={nTelephone}
                  onChange={(e) => setNTelephone(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Matricule</label>
                <input
                  value={nMatricule}
                  onChange={(e) => setNMatricule(e.target.value)}
                  placeholder="P-005"
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={enCours}
              onClick={validerCreation}
            >
              Créer la fiche
            </button>
            {erreur && <p className="error">{erreur}</p>}
            {info && <p className="muted">{info}</p>}
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Effectif</h2>
          <span className="count">{actifs} actifs</span>
          {masseSalariale !== null && (
            <span
              className="count"
              style={{ background: '#e6f4ec', color: '#1c6b3c' }}
              title="Somme des salaires de base des actifs"
            >
              Masse salariale : {XAF(masseSalariale)}
            </span>
          )}
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!peutGerer && erreur && <p className="error">{erreur}</p>}
        {!chargement && (
          <table className="table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Fonction</th>
                <th>Service</th>
                <th>Téléphone</th>
                {estRh && <th>Contrat</th>}
                {estRh && <th>Salaire base</th>}
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {membres.map((p) => (
                <tr
                  key={p.id}
                  style={peutGerer ? { cursor: 'pointer' } : undefined}
                  title={peutGerer ? 'Double-clic pour ouvrir la fiche' : ''}
                  onDoubleClick={() => peutGerer && ouvrirMembre(p)}
                >
                  <td className="mono">{p.matricule ?? '—'}</td>
                  <td>
                    {p.nom} {p.prenom ?? ''}
                  </td>
                  <td>{p.fonction}</td>
                  <td className="muted">{p.service ?? '—'}</td>
                  <td className="mono">{p.telephone ?? '—'}</td>
                  {estRh && <td>{p.typeContrat ?? '—'}</td>}
                  {estRh && (
                    <td className="mono">
                      {p.salaireBase != null ? XAF(p.salaireBase) : '—'}
                    </td>
                  )}
                  <td>
                    <span className="badge-app" style={STATUT_STYLE[p.statut]}>
                      {STATUT_LIBELLE[p.statut]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
        </>
      )}

      {mMembre && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12, 42, 40, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => !enCours && fermerModale()}
        >
          <div
            className="card"
            style={{ width: 'min(520px, 94vw)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {mMembre.matricule ? `${mMembre.matricule} — ` : ''}
              {mMembre.nom} {mMembre.prenom ?? ''}
            </h2>
            <div className="form">
              <div className="row">
                <div className="field">
                  <label>Nom</label>
                  <input value={mNom} onChange={(e) => setMNom(e.target.value)} />
                </div>
                <div className="field">
                  <label>Prénom</label>
                  <input
                    value={mPrenom}
                    onChange={(e) => setMPrenom(e.target.value)}
                  />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Fonction</label>
                  <input
                    value={mFonction}
                    onChange={(e) => setMFonction(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Service</label>
                  <input
                    value={mService}
                    onChange={(e) => setMService(e.target.value)}
                  />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Téléphone</label>
                  <input
                    value={mTelephone}
                    onChange={(e) => setMTelephone(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Statut</label>
                  <select
                    value={mStatut}
                    onChange={(e) =>
                      setMStatut(e.target.value as StatutPersonnel)
                    }
                  >
                    <option value="actif">Actif</option>
                    <option value="conge">En congé</option>
                    <option value="suspendu">Suspendu</option>
                    <option value="parti">Parti</option>
                  </select>
                </div>
              </div>

              {estRh && rh && (
                <>
                  <h2 style={{ marginTop: 10 }}>Volet RH (confidentiel)</h2>
                  <div className="row">
                    <div className="field">
                      <label>Type de contrat</label>
                      <input
                        value={rhContrat}
                        onChange={(e) => setRhContrat(e.target.value)}
                        placeholder="CDI, CDD, Vacataire…"
                      />
                    </div>
                    <div className="field">
                      <label>Date d'embauche</label>
                      <input
                        type="date"
                        value={rhEmbauche}
                        onChange={(e) => setRhEmbauche(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label>Salaire de base (XAF)</label>
                      <input
                        type="number"
                        min={0}
                        value={rhSalaire}
                        onChange={(e) => setRhSalaire(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>N° CNPS</label>
                      <input
                        value={rhCnps}
                        onChange={(e) => setRhCnps(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={fermerModale}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enCours}
                  onClick={enregistrer}
                >
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
