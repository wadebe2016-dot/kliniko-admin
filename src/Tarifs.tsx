import { useCallback, useEffect, useState } from 'react';
import {
  getTarifsActes,
  creerActe,
  modifierActe,
  nouveauTarifActe,
  getTarifsMedicaments,
  creerMedicament,
  modifierPrixMedicament,
  aPermission,
  type ActeTarif,
  type MedicamentPrix,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

export default function Tarifs({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [actes, setActes] = useState<ActeTarif[]>([]);
  const [medicaments, setMedicaments] = useState<MedicamentPrix[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Nouvel acte
  const [nCode, setNCode] = useState('');
  const [nLibelle, setNLibelle] = useState('');
  const [nMontant, setNMontant] = useState('');

  // Nouveau medicament
  const [dDenomination, setDDenomination] = useState('');
  const [dDosage, setDDosage] = useState('');
  const [dForme, setDForme] = useState('');
  const [dPrix, setDPrix] = useState('');

  // Modale de modification (acte ou medicament)
  const [mActe, setMActe] = useState<ActeTarif | null>(null);
  const [mLibelle, setMLibelle] = useState('');
  const [mMontant, setMMontant] = useState('');
  const [mMed, setMMed] = useState<MedicamentPrix | null>(null);
  const [mPrix, setMPrix] = useState('');
  const [mErreur, setMErreur] = useState<string | null>(null);

  const peutGerer = aPermission('tarif.gerer');

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
      const [a, m] = await Promise.all([
        getTarifsActes(),
        getTarifsMedicaments(),
      ]);
      setActes(a);
      setMedicaments(m);
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

  async function validerNouvelActe() {
    if (!nCode.trim() || !nLibelle.trim()) {
      setErreur("Indiquez le code et le libellé de l'acte");
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await creerActe({
        code: nCode.trim().toUpperCase(),
        libelle: nLibelle.trim(),
        montant: nMontant ? Number(nMontant) : undefined,
      });
      setNCode('');
      setNLibelle('');
      setNMontant('');
      setInfo('Acte ajouté à la mercuriale.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerNouveauMedicament() {
    if (!dDenomination.trim()) {
      setErreur('Indiquez la dénomination du médicament');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await creerMedicament({
        denomination: dDenomination.trim(),
        dosage: dDosage.trim() || undefined,
        forme: dForme.trim() || undefined,
        prixVente: dPrix ? Number(dPrix) : undefined,
      });
      setDDenomination('');
      setDDosage('');
      setDForme('');
      setDPrix('');
      setInfo('Médicament ajouté au catalogue.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  function ouvrirActe(a: ActeTarif) {
    setMActe(a);
    setMLibelle(a.libelle);
    setMMontant('');
    setMErreur(null);
  }

  function ouvrirMedicament(m: MedicamentPrix) {
    setMMed(m);
    setMPrix(m.prixVente !== null ? String(m.prixVente) : '');
    setMErreur(null);
  }

  function fermerModale() {
    setMActe(null);
    setMMed(null);
    setMErreur(null);
  }

  async function enregistrerActe() {
    if (!mActe) return;
    if (!mLibelle.trim()) {
      setMErreur('Le libellé ne peut pas être vide');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      if (mLibelle.trim() !== mActe.libelle) {
        await modifierActe(mActe.id, { libelle: mLibelle.trim() });
      }
      if (mMontant !== '' && Number(mMontant) !== (mActe.tarif ?? -1)) {
        await nouveauTarifActe(mActe.id, { montant: Number(mMontant) });
      }
      fermerModale();
      setInfo('Acte mis à jour.');
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

  async function enregistrerMedicament() {
    if (!mMed) return;
    if (mPrix === '') {
      setMErreur('Indiquez le prix de vente');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await modifierPrixMedicament(mMed.id, { prixVente: Number(mPrix) });
      fermerModale();
      setInfo('Prix de vente mis à jour.');
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

  return (
    <>
      {peutGerer && (
        <section className="card form-card">
          <h2>Nouvel acte médical</h2>
          <div className="form">
            <div className="row">
              <div className="field">
                <label>Code</label>
                <input
                  value={nCode}
                  onChange={(e) => setNCode(e.target.value)}
                  placeholder="ECHO-ABD"
                />
              </div>
              <div className="field">
                <label>Tarif (XAF)</label>
                <input
                  type="number"
                  min={0}
                  value={nMontant}
                  onChange={(e) => setNMontant(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>Libellé</label>
              <input
                value={nLibelle}
                onChange={(e) => setNLibelle(e.target.value)}
                placeholder="Échographie abdominale"
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={enCours}
              onClick={validerNouvelActe}
            >
              Ajouter à la mercuriale
            </button>

            <h2 style={{ marginTop: 18 }}>Nouveau médicament</h2>
            <div className="field">
              <label>Dénomination</label>
              <input
                value={dDenomination}
                onChange={(e) => setDDenomination(e.target.value)}
                placeholder="Ibuprofène"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Dosage</label>
                <input
                  value={dDosage}
                  onChange={(e) => setDDosage(e.target.value)}
                  placeholder="400 mg"
                />
              </div>
              <div className="field">
                <label>Forme</label>
                <input
                  value={dForme}
                  onChange={(e) => setDForme(e.target.value)}
                  placeholder="Comprimé, sirop…"
                />
              </div>
            </div>
            <div className="field">
              <label>Prix de vente (XAF)</label>
              <input
                type="number"
                min={0}
                value={dPrix}
                onChange={(e) => setDPrix(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={enCours}
              onClick={validerNouveauMedicament}
            >
              Ajouter au catalogue
            </button>
            {erreur && <p className="error">{erreur}</p>}
            {info && <p className="muted">{info}</p>}
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Actes médicaux</h2>
          <span className="count">{actes.length}</span>
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!peutGerer && erreur && <p className="error">{erreur}</p>}
        {!chargement && (
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Libellé</th>
                <th>Tarif en vigueur</th>
                <th>Depuis</th>
                {peutGerer && <th></th>}
              </tr>
            </thead>
            <tbody>
              {actes.map((a) => (
                <tr
                  key={a.id}
                  style={peutGerer ? { cursor: 'pointer' } : undefined}
                  title={peutGerer ? 'Double-clic pour modifier' : ''}
                  onDoubleClick={() => peutGerer && ouvrirActe(a)}
                >
                  <td className="mono">{a.code}</td>
                  <td>{a.libelle}</td>
                  <td>{a.tarif !== null ? XAF(a.tarif) : '— sans tarif —'}</td>
                  <td className="muted">{jour(a.depuis)}</td>
                  {peutGerer && (
                    <td>
                      <button
                        type="button"
                        style={{ padding: '2px 10px', cursor: 'pointer' }}
                        onClick={() => ouvrirActe(a)}
                      >
                        Modifier
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="list-header">
          <h2>Prix de vente des médicaments</h2>
          <span className="count">{medicaments.length}</span>
        </div>
        {!chargement && (
          <table className="table">
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Prix de vente</th>
                {peutGerer && <th></th>}
              </tr>
            </thead>
            <tbody>
              {medicaments.map((m) => (
                <tr
                  key={m.id}
                  style={peutGerer ? { cursor: 'pointer' } : undefined}
                  title={peutGerer ? 'Double-clic pour modifier' : ''}
                  onDoubleClick={() => peutGerer && ouvrirMedicament(m)}
                >
                  <td>
                    {m.denomination}
                    <span className="muted">
                      {' '}
                      {[m.dosage, m.forme].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td>
                    {m.prixVente !== null ? XAF(m.prixVente) : '— à renseigner —'}
                  </td>
                  {peutGerer && (
                    <td>
                      <button
                        type="button"
                        style={{ padding: '2px 10px', cursor: 'pointer' }}
                        onClick={() => ouvrirMedicament(m)}
                      >
                        Modifier
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(mActe || mMed) && (
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
            style={{ width: 'min(440px, 92vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {mActe && (
              <>
                <h2>
                  {mActe.code} — modifier l'acte
                </h2>
                <div className="form">
                  <div className="field">
                    <label>Libellé</label>
                    <input
                      value={mLibelle}
                      onChange={(e) => setMLibelle(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>
                      Nouveau tarif (XAF) — actuel :{' '}
                      {mActe.tarif !== null ? XAF(mActe.tarif) : 'aucun'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={mMontant}
                      onChange={(e) => setMMontant(e.target.value)}
                      placeholder="Laisser vide pour ne pas changer"
                    />
                  </div>
                  <p className="muted">
                    Le nouveau tarif prend effet immédiatement ; l'ancien est
                    archivé avec ses dates.
                  </p>
                  {mErreur && <p className="error">{mErreur}</p>}
                  <div
                    style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
                  >
                    <button type="button" disabled={enCours} onClick={fermerModale}>
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={enCours}
                      onClick={enregistrerActe}
                    >
                      {enCours ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </>
            )}
            {mMed && (
              <>
                <h2>{mMed.denomination}</h2>
                <div className="form">
                  <div className="field">
                    <label>Prix de vente (XAF)</label>
                    <input
                      type="number"
                      min={0}
                      value={mPrix}
                      onChange={(e) => setMPrix(e.target.value)}
                    />
                  </div>
                  {mErreur && <p className="error">{mErreur}</p>}
                  <div
                    style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}
                  >
                    <button type="button" disabled={enCours} onClick={fermerModale}>
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={enCours}
                      onClick={enregistrerMedicament}
                    >
                      {enCours ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
