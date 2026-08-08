import { useCallback, useEffect, useState } from 'react';
import {
  getStockPharmacie,
  getMouvementsStock,
  entreeStock,
  dispenserOrdonnance,
  listerOrdonnances,
  aPermission,
  type ArticleStock,
  type MouvementStock,
  type Ordonnance,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
const quand = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    timeZone: 'Africa/Douala',
  });

const TYPE_LIBELLE = { entree: 'Entrée', sortie: 'Sortie', ajustement: 'Ajustement' };

// Extrait le nombre en tete d'une quantite en texte ("15 comprimes" -> 15)
function quantiteParDefaut(texte: string | null | undefined): number {
  const m = (texte ?? '').match(/\d+/);
  return m ? Number(m[0]) : 1;
}

export default function Pharmacie({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [stock, setStock] = useState<ArticleStock[]>([]);
  const [mouvements, setMouvements] = useState<MouvementStock[]>([]);
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Entree de stock
  const [eMedicament, setEMedicament] = useState('');
  const [eQuantite, setEQuantite] = useState(10);
  const [ePeremption, setEPeremption] = useState('');
  const [eMotif, setEMotif] = useState('');

  // Dispensation
  const [dOrdonnance, setDOrdonnance] = useState('');
  const [dLignes, setDLignes] = useState<
    { medicamentId: string; libelle: string; quantite: number }[]
  >([]);
  const [dFacturer, setDFacturer] = useState(true);
  const [enCours, setEnCours] = useState(false);

  const peutGerer = aPermission('pharmacie.gerer');

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
      const [s, m] = await Promise.all([
        getStockPharmacie(),
        getMouvementsStock(),
      ]);
      setStock(s);
      setMouvements(m);
      if (aPermission('ordonnance.lire')) {
        setOrdonnances(
          (await listerOrdonnances()).filter((o) => o.statut === 'validee'),
        );
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

  function choisirOrdonnance(id: string) {
    setDOrdonnance(id);
    const o = ordonnances.find((x) => x.id === id);
    setDLignes(
      (o?.lignes ?? [])
        .filter((l) => l.medicamentId)
        .map((l) => ({
          medicamentId: l.medicamentId as string,
          libelle: l.libelle,
          quantite: quantiteParDefaut(l.quantite),
        })),
    );
  }

  async function validerEntree() {
    if (!eMedicament) {
      setErreur('Choisissez un médicament');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await entreeStock({
        medicamentId: eMedicament,
        quantite: eQuantite,
        datePeremption: ePeremption || undefined,
        motif: eMotif.trim() || undefined,
      });
      setEQuantite(10);
      setEPeremption('');
      setEMotif('');
      setInfo('Entrée de stock enregistrée.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerDispensation() {
    if (!dOrdonnance || dLignes.length === 0) {
      setErreur('Choisissez une ordonnance comportant des médicaments du catalogue');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await dispenserOrdonnance({
        ordonnanceId: dOrdonnance,
        lignes: dLignes.map((l) => ({
          medicamentId: l.medicamentId,
          quantite: l.quantite,
        })),
        facturer: dFacturer,
      });
      setDOrdonnance('');
      setDLignes([]);
      setInfo(
        r.facture
          ? `Ordonnance ${r.ordonnance} dispensée — facture ${r.facture.numero} de ${XAF(r.facture.montantTotal)} créée.`
          : `Ordonnance ${r.ordonnance} dispensée.`,
      );
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  const alertes = stock.filter((a) => a.sousSeuil || a.peremptionProche);

  return (
    <>
      {peutGerer && (
        <section className="card form-card">
          <h2>Entrée de stock</h2>
          <div className="form">
            <div className="field">
              <label>Médicament</label>
              <select
                value={eMedicament}
                onChange={(e) => setEMedicament(e.target.value)}
              >
                <option value="">Choisir…</option>
                {stock.map((a) => (
                  <option key={a.id} value={a.id}>
                    {[a.denomination, a.dosage].filter(Boolean).join(' ')} (stock : {a.stock})
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="field">
                <label>Quantité reçue</label>
                <input
                  type="number"
                  min={1}
                  value={eQuantite}
                  onChange={(e) => setEQuantite(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Péremption</label>
                <input
                  type="date"
                  value={ePeremption}
                  onChange={(e) => setEPeremption(e.target.value)}
                />
              </div>
            </div>
            <div className="field">
              <label>Référence / motif</label>
              <input
                value={eMotif}
                onChange={(e) => setEMotif(e.target.value)}
                placeholder="Bon de livraison n° …"
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={enCours}
              onClick={validerEntree}
            >
              Enregistrer l'entrée
            </button>

            <h2 style={{ marginTop: 18 }}>Dispenser une ordonnance</h2>
            <div className="field">
              <label>Ordonnance validée</label>
              <select
                value={dOrdonnance}
                onChange={(e) => choisirOrdonnance(e.target.value)}
              >
                <option value="">Choisir…</option>
                {ordonnances.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.numero} — {o.patient.nom} {o.patient.prenom ?? ''}
                  </option>
                ))}
              </select>
            </div>
            {dOrdonnance && dLignes.length === 0 && (
              <p className="muted">
                Cette ordonnance ne contient aucun médicament du catalogue.
              </p>
            )}
            {dLignes.map((l, i) => (
              <div className="row" key={l.medicamentId}>
                <div className="field">
                  <label>{l.libelle}</label>
                </div>
                <div className="field">
                  <label>Quantité délivrée</label>
                  <input
                    type="number"
                    min={1}
                    value={l.quantite}
                    onChange={(e) =>
                      setDLignes(
                        dLignes.map((x, j) =>
                          j === i ? { ...x, quantite: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
            {dLignes.length > 0 && (
              <>
                <div className="field">
                  <label>
                    <input
                      type="checkbox"
                      checked={dFacturer}
                      onChange={(e) => setDFacturer(e.target.checked)}
                    />{' '}
                    Créer la facture des médicaments délivrés
                  </label>
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enCours}
                  onClick={validerDispensation}
                >
                  {enCours ? 'Dispensation…' : 'Dispenser'}
                </button>
              </>
            )}
            {erreur && <p className="error">{erreur}</p>}
            {info && <p className="muted">{info}</p>}
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Stock</h2>
          <span className="count">{stock.length}</span>
          {alertes.length > 0 && (
            <span className="count" style={{ background: '#fdece7', color: '#8c3520' }}>
              {alertes.length} alerte{alertes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!peutGerer && erreur && <p className="error">{erreur}</p>}
        {!chargement && (
          <table className="table">
            <thead>
              <tr>
                <th>Médicament</th>
                <th>Stock</th>
                <th>Seuil</th>
                <th>Prix vente</th>
                <th>Alerte</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.denomination}
                    <span className="muted">
                      {' '}
                      {[a.dosage, a.forme].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td className="mono">{a.stock}</td>
                  <td className="muted">{a.seuilAlerte}</td>
                  <td>{a.prixVente !== null ? XAF(a.prixVente) : '—'}</td>
                  <td>
                    {a.sousSeuil && (
                      <span className="badge-app" style={{ background: '#fdece7', color: '#8c3520' }}>
                        À commander
                      </span>
                    )}{' '}
                    {a.peremptionProche && (
                      <span className="badge-app" style={{ background: '#fdf3e2', color: '#b7791f' }}>
                        Périme le {jour(a.peremptionProche)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <div className="list-header">
          <h2>Derniers mouvements</h2>
        </div>
        {mouvements.length === 0 && (
          <p className="muted">Aucun mouvement pour le moment.</p>
        )}
        {mouvements.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Quand</th>
                <th>Type</th>
                <th>Médicament</th>
                <th>Qté</th>
                <th>Référence</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{quand(m.createdAt)}</td>
                  <td>{TYPE_LIBELLE[m.type]}</td>
                  <td>
                    {m.medicament.denomination}
                    <span className="muted"> {m.medicament.dosage ?? ''}</span>
                  </td>
                  <td className="mono">
                    {m.type === 'sortie' ? '-' : m.type === 'entree' ? '+' : ''}
                    {m.quantite}
                  </td>
                  <td className="muted">
                    {m.ordonnance?.numero ?? ''} {m.facture?.numero ?? ''}{' '}
                    {m.motif ?? ''}
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
