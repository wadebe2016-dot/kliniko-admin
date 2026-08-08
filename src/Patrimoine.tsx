import { useCallback, useEffect, useState } from 'react';
import {
  getActifs,
  getEvenementsActifs,
  creerActif,
  modifierActif,
  changerEtatActif,
  aPermission,
  type Actif,
  type EvenementActif,
  type EtatActif,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Douala',
  });

const ETAT_LIBELLE: Record<EtatActif, string> = {
  en_service: 'En service',
  en_maintenance: 'En maintenance',
  en_panne: 'En panne',
  reforme: 'Réformé',
};

const ETAT_STYLE: Record<EtatActif, { background: string; color: string }> = {
  en_service: { background: '#e6f4ec', color: '#1c6b3c' },
  en_maintenance: { background: '#fdf3e2', color: '#b7791f' },
  en_panne: { background: '#fdece7', color: '#8c3520' },
  reforme: { background: '#e8ecef', color: '#5b6572' },
};

export default function Patrimoine({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [actifs, setActifs] = useState<Actif[]>([]);
  const [evenements, setEvenements] = useState<EvenementActif[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Nouvel actif
  const [nDesignation, setNDesignation] = useState('');
  const [nCode, setNCode] = useState('');
  const [nCategorie, setNCategorie] = useState('');
  const [nLocalisation, setNLocalisation] = useState('');
  const [nValeur, setNValeur] = useState('');
  const [nDate, setNDate] = useState('');
  const [nDuree, setNDuree] = useState('');

  // Modale de modification
  const [mActif, setMActif] = useState<Actif | null>(null);
  const [mDesignation, setMDesignation] = useState('');
  const [mCategorie, setMCategorie] = useState('');
  const [mLocalisation, setMLocalisation] = useState('');
  const [mValeur, setMValeur] = useState('');
  const [mDuree, setMDuree] = useState('');
  const [mEtat, setMEtat] = useState<EtatActif>('en_service');
  const [mMotif, setMMotif] = useState('');
  const [mErreur, setMErreur] = useState<string | null>(null);

  const peutGerer = aPermission('patrimoine.gerer');

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
      const [a, ev] = await Promise.all([getActifs(), getEvenementsActifs()]);
      setActifs(a);
      setEvenements(ev);
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
    if (!nDesignation.trim()) {
      setErreur('Indiquez la désignation de l’actif');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await creerActif({
        designation: nDesignation.trim(),
        code: nCode.trim() || undefined,
        categorie: nCategorie.trim() || undefined,
        localisation: nLocalisation.trim() || undefined,
        valeurAcquisition: nValeur ? Number(nValeur) : undefined,
        dateAcquisition: nDate || undefined,
        dureeAmortAnnees: nDuree ? Number(nDuree) : undefined,
      });
      setNDesignation('');
      setNCode('');
      setNCategorie('');
      setNLocalisation('');
      setNValeur('');
      setNDate('');
      setNDuree('');
      setInfo('Actif ajouté au patrimoine.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  function ouvrirActif(a: Actif) {
    setMActif(a);
    setMDesignation(a.designation);
    setMCategorie(a.categorie ?? '');
    setMLocalisation(a.localisation ?? '');
    setMValeur(
      a.valeurAcquisition !== null ? String(a.valeurAcquisition) : '',
    );
    setMDuree(a.dureeAmortAnnees !== null ? String(a.dureeAmortAnnees) : '');
    setMEtat(a.etat);
    setMMotif('');
    setMErreur(null);
  }

  function fermerModale() {
    setMActif(null);
    setMErreur(null);
  }

  async function enregistrerActif() {
    if (!mActif) return;
    if (!mDesignation.trim()) {
      setMErreur('La désignation ne peut pas être vide');
      return;
    }
    if (mEtat !== mActif.etat && !mMotif.trim()) {
      setMErreur('Un changement d’état exige un motif');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await modifierActif(mActif.id, {
        designation: mDesignation.trim(),
        categorie: mCategorie.trim(),
        localisation: mLocalisation.trim(),
        valeurAcquisition: mValeur ? Number(mValeur) : undefined,
        dureeAmortAnnees: mDuree ? Number(mDuree) : undefined,
      });
      if (mEtat !== mActif.etat) {
        await changerEtatActif(mActif.id, {
          etat: mEtat,
          motif: mMotif.trim(),
        });
      }
      fermerModale();
      setInfo('Actif mis à jour.');
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

  const valeurTotale = actifs
    .filter((a) => a.etat !== 'reforme')
    .reduce((s, a) => s + (a.valeurAcquisition ?? 0), 0);
  const valeurResiduelleTotale = actifs
    .filter((a) => a.etat !== 'reforme')
    .reduce((s, a) => s + (a.valeurResiduelle ?? 0), 0);
  const horsService = actifs.filter(
    (a) => a.etat === 'en_panne' || a.etat === 'en_maintenance',
  ).length;

  return (
    <>
      {peutGerer && (
        <section className="card form-card">
          <h2>Nouvel actif</h2>
          <div className="form">
            <div className="field">
              <label>Désignation</label>
              <input
                value={nDesignation}
                onChange={(e) => setNDesignation(e.target.value)}
                placeholder="Concentrateur d'oxygène"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Code</label>
                <input
                  value={nCode}
                  onChange={(e) => setNCode(e.target.value)}
                  placeholder="EQ-004"
                />
              </div>
              <div className="field">
                <label>Catégorie</label>
                <input
                  value={nCategorie}
                  onChange={(e) => setNCategorie(e.target.value)}
                  placeholder="Équipement médical…"
                />
              </div>
            </div>
            <div className="field">
              <label>Localisation</label>
              <input
                value={nLocalisation}
                onChange={(e) => setNLocalisation(e.target.value)}
                placeholder="Salle de soins"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Valeur d'acquisition (XAF)</label>
                <input
                  type="number"
                  min={0}
                  value={nValeur}
                  onChange={(e) => setNValeur(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Date d'acquisition</label>
                <input
                  type="date"
                  value={nDate}
                  onChange={(e) => setNDate(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>Durée d'amortissement (années)</label>
              <input
                type="number"
                min={1}
                value={nDuree}
                onChange={(e) => setNDuree(e.target.value)}
                placeholder="5"
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={enCours}
              onClick={validerCreation}
            >
              Ajouter au patrimoine
            </button>
            {erreur && <p className="error">{erreur}</p>}
            {info && <p className="muted">{info}</p>}
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Inventaire</h2>
          <span className="count">{actifs.length}</span>
          <span className="count" title="Valeur d'acquisition">
            Acquis : {XAF(valeurTotale)}
          </span>
          <span
            className="count"
            style={{ background: '#e6f4ec', color: '#1c6b3c' }}
            title="Valeur résiduelle après amortissement linéaire"
          >
            Résiduel : {XAF(valeurResiduelleTotale)}
          </span>
          {horsService > 0 && (
            <span className="count" style={{ background: '#fdece7', color: '#8c3520' }}>
              {horsService} hors service
            </span>
          )}
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!peutGerer && erreur && <p className="error">{erreur}</p>}
        {!chargement && (
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Désignation</th>
                <th>Catégorie</th>
                <th>Localisation</th>
                <th>Valeur acq.</th>
                <th>Résiduelle</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {actifs.map((a) => (
                <tr
                  key={a.id}
                  style={peutGerer ? { cursor: 'pointer' } : undefined}
                  title={peutGerer ? 'Double-clic pour modifier' : ''}
                  onDoubleClick={() => peutGerer && ouvrirActif(a)}
                >
                  <td className="mono">{a.code ?? '—'}</td>
                  <td>{a.designation}</td>
                  <td className="muted">{a.categorie ?? '—'}</td>
                  <td className="muted">{a.localisation ?? '—'}</td>
                  <td className="mono">
                    {a.valeurAcquisition !== null ? XAF(a.valeurAcquisition) : '—'}
                  </td>
                  <td className="mono">
                    {a.valeurResiduelle !== null ? XAF(a.valeurResiduelle) : '—'}
                    {a.dureeAmortAnnees && (
                      <span className="muted"> /{a.dureeAmortAnnees} ans</span>
                    )}
                  </td>
                  <td>
                    <span className="badge-app" style={ETAT_STYLE[a.etat]}>
                      {ETAT_LIBELLE[a.etat]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="list-header">
          <h2>Journal des événements</h2>
        </div>
        {evenements.length === 0 && (
          <p className="muted">Aucun événement pour le moment.</p>
        )}
        {evenements.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Quand</th>
                <th>Actif</th>
                <th>Événement</th>
              </tr>
            </thead>
            <tbody>
              {evenements.map((ev) => (
                <tr key={ev.id}>
                  <td className="mono">{quand(ev.createdAt)}</td>
                  <td>
                    {ev.actif.designation}
                    <span className="muted"> {ev.actif.code ?? ''}</span>
                  </td>
                  <td>{ev.detail ?? ev.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {mActif && (
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
            style={{ width: 'min(480px, 92vw)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {mActif.code ? `${mActif.code} — ` : ''}
              {mActif.designation}
            </h2>
            <div className="form">
              <div className="field">
                <label>Désignation</label>
                <input
                  value={mDesignation}
                  onChange={(e) => setMDesignation(e.target.value)}
                />
              </div>
              <div className="row">
                <div className="field">
                  <label>Catégorie</label>
                  <input
                    value={mCategorie}
                    onChange={(e) => setMCategorie(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Localisation</label>
                  <input
                    value={mLocalisation}
                    onChange={(e) => setMLocalisation(e.target.value)}
                  />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Valeur d'acquisition (XAF)</label>
                  <input
                    type="number"
                    min={0}
                    value={mValeur}
                    onChange={(e) => setMValeur(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Amortissement (années)</label>
                  <input
                    type="number"
                    min={1}
                    value={mDuree}
                    onChange={(e) => setMDuree(e.target.value)}
                  />
                </div>
              </div>
              {mActif.valeurResiduelle !== null && (
                <p className="muted">
                  Valeur résiduelle actuelle : {XAF(mActif.valeurResiduelle)}
                </p>
              )}
              <div className="row">
                <div className="field">
                  <label>État</label>
                  <select
                    value={mEtat}
                    onChange={(e) => setMEtat(e.target.value as EtatActif)}
                  >
                    <option value="en_service">En service</option>
                    <option value="en_maintenance">En maintenance</option>
                    <option value="en_panne">En panne</option>
                    <option value="reforme">Réformé</option>
                  </select>
                </div>
                {mEtat !== mActif.etat && (
                  <div className="field">
                    <label>Motif du changement</label>
                    <input
                      value={mMotif}
                      onChange={(e) => setMMotif(e.target.value)}
                      placeholder="Panne du compresseur…"
                    />
                  </div>
                )}
              </div>
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={fermerModale}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enCours}
                  onClick={enregistrerActif}
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
