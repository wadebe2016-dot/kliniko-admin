import { useCallback, useEffect, useState } from 'react';
import {
  getStockConsommables,
  getMouvementsConsommables,
  creerConsommable,
  entreeConsommable,
  sortieConsommable,
  aPermission,
  type ArticleConsommable,
  type MouvementConsommable,
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

export default function Consommables({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [stock, setStock] = useState<ArticleConsommable[]>([]);
  const [mouvements, setMouvements] = useState<MouvementConsommable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Entree de stock
  const [eArticle, setEArticle] = useState('');
  const [eQuantite, setEQuantite] = useState(10);
  const [ePeremption, setEPeremption] = useState('');
  const [eMotif, setEMotif] = useState('');

  // Sortie de consommation
  const [sArticle, setSArticle] = useState('');
  const [sQuantite, setSQuantite] = useState(1);
  const [sMotif, setSMotif] = useState('');

  // Nouveau consommable
  const [cDesignation, setCDesignation] = useState('');
  const [cUnite, setCUnite] = useState('');
  const [cSeuil, setCSeuil] = useState(10);

  const peutGerer = aPermission('consommable.gerer');

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
        getStockConsommables(),
        getMouvementsConsommables(),
      ]);
      setStock(s);
      setMouvements(m);
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

  async function validerEntree() {
    if (!eArticle) {
      setErreur('Choisissez un article');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await entreeConsommable({
        consommableId: eArticle,
        quantite: eQuantite,
        datePeremption: ePeremption || undefined,
        motif: eMotif.trim() || undefined,
      });
      setEQuantite(10);
      setEPeremption('');
      setEMotif('');
      setInfo('Entrée enregistrée.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerSortie() {
    if (!sArticle || !sMotif.trim()) {
      setErreur("Choisissez l'article et indiquez le service ou le motif");
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await sortieConsommable({
        consommableId: sArticle,
        quantite: sQuantite,
        motif: sMotif.trim(),
      });
      setSQuantite(1);
      setSMotif('');
      setInfo('Consommation enregistrée.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerCreation() {
    if (!cDesignation.trim()) {
      setErreur('Indiquez la désignation du consommable');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await creerConsommable({
        designation: cDesignation.trim(),
        unite: cUnite.trim() || undefined,
        seuilAlerte: cSeuil,
      });
      setCDesignation('');
      setCUnite('');
      setCSeuil(10);
      setInfo('Consommable ajouté au catalogue.');
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
              <label>Article</label>
              <select value={eArticle} onChange={(e) => setEArticle(e.target.value)}>
                <option value="">Choisir…</option>
                {stock.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.designation} (stock : {a.stock})
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

            <h2 style={{ marginTop: 18 }}>Sortie de consommation</h2>
            <div className="field">
              <label>Article</label>
              <select value={sArticle} onChange={(e) => setSArticle(e.target.value)}>
                <option value="">Choisir…</option>
                {stock.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.designation} (stock : {a.stock})
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="field">
                <label>Quantité</label>
                <input
                  type="number"
                  min={1}
                  value={sQuantite}
                  onChange={(e) => setSQuantite(Number(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Service / motif</label>
                <input
                  value={sMotif}
                  onChange={(e) => setSMotif(e.target.value)}
                  placeholder="Salle de soins, bloc…"
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={enCours}
              onClick={validerSortie}
            >
              Enregistrer la sortie
            </button>

            <h2 style={{ marginTop: 18 }}>Nouveau consommable</h2>
            <div className="field">
              <label>Désignation</label>
              <input
                value={cDesignation}
                onChange={(e) => setCDesignation(e.target.value)}
                placeholder="Masques chirurgicaux…"
              />
            </div>
            <div className="row">
              <div className="field">
                <label>Unité</label>
                <input
                  value={cUnite}
                  onChange={(e) => setCUnite(e.target.value)}
                  placeholder="boîte de 50, rouleau…"
                />
              </div>
              <div className="field">
                <label>Seuil d'alerte</label>
                <input
                  type="number"
                  min={0}
                  value={cSeuil}
                  onChange={(e) => setCSeuil(Number(e.target.value))}
                />
              </div>
            </div>
            <button type="button" disabled={enCours} onClick={validerCreation}>
              Ajouter au catalogue
            </button>
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
                <th>Article</th>
                <th>Stock</th>
                <th>Seuil</th>
                <th>Prix unitaire</th>
                <th>Alerte</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.designation}
                    <span className="muted"> {a.unite ?? ''}</span>
                  </td>
                  <td className="mono">{a.stock}</td>
                  <td className="muted">{a.seuilAlerte}</td>
                  <td>{a.prixUnitaire !== null ? XAF(a.prixUnitaire) : '—'}</td>
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
                <th>Article</th>
                <th>Qté</th>
                <th>Motif</th>
              </tr>
            </thead>
            <tbody>
              {mouvements.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{quand(m.createdAt)}</td>
                  <td>{TYPE_LIBELLE[m.type]}</td>
                  <td>{m.consommable.designation}</td>
                  <td className="mono">
                    {m.type === 'sortie' ? '-' : m.type === 'entree' ? '+' : ''}
                    {m.quantite}
                  </td>
                  <td className="muted">{m.motif ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
