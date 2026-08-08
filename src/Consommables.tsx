import { useCallback, useEffect, useState } from 'react';
import {
  getStockConsommables,
  getMouvementsConsommables,
  creerConsommable,
  entreeConsommable,
  sortieConsommable,
  supprimerMouvementConsommable,
  aPermission,
  type ArticleConsommable,
  type MouvementConsommable,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
const isoJour = (d: Date) => d.toISOString().slice(0, 10);

const MODALE = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(12, 42, 40, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
} as const;

type Vue = 'articles' | 'mouvements';
type Modale = 'article' | 'entree' | 'sortie' | null;

export default function Consommables({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [vue, setVue] = useState<Vue>('articles');
  const [stock, setStock] = useState<ArticleConsommable[]>([]);
  const [mouvements, setMouvements] = useState<MouvementConsommable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Filtres du journal
  const [fArticle, setFArticle] = useState('');
  const [recherche, setRecherche] = useState('');

  // Modales
  const [modale, setModale] = useState<Modale>(null);
  const [mErreur, setMErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<MouvementConsommable | null>(
    null,
  );

  // Entree / sortie
  const [mArticle, setMArticle] = useState('');
  const [mQuantite, setMQuantite] = useState(1);
  const [mDate, setMDate] = useState(isoJour(new Date()));
  const [mPeremption, setMPeremption] = useState('');
  const [mMotif, setMMotif] = useState('');

  // Nouvel article
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

  function ouvrir(m: Exclude<Modale, null>) {
    setMArticle('');
    setMQuantite(m === 'entree' ? 10 : 1);
    setMDate(isoJour(new Date()));
    setMPeremption('');
    setMMotif('');
    setCDesignation('');
    setCUnite('');
    setCSeuil(10);
    setMErreur(null);
    setInfo(null);
    setModale(m);
  }

  async function validerModale() {
    setMErreur(null);
    try {
      if (modale === 'article') {
        if (!cDesignation.trim()) {
          setMErreur('Indiquez la désignation');
          return;
        }
        setEnCours(true);
        await creerConsommable({
          designation: cDesignation.trim(),
          unite: cUnite.trim() || undefined,
          seuilAlerte: cSeuil,
        });
        setInfo('Article ajouté au catalogue.');
      } else if (modale === 'entree') {
        if (!mArticle) {
          setMErreur('Choisissez un article');
          return;
        }
        setEnCours(true);
        await entreeConsommable({
          consommableId: mArticle,
          quantite: mQuantite,
          date: mDate || undefined,
          datePeremption: mPeremption || undefined,
          motif: mMotif.trim() || undefined,
        });
        setInfo('Entrée enregistrée.');
      } else if (modale === 'sortie') {
        if (!mArticle || !mMotif.trim()) {
          setMErreur("Choisissez l'article et indiquez le service ou motif");
          return;
        }
        setEnCours(true);
        await sortieConsommable({
          consommableId: mArticle,
          quantite: mQuantite,
          date: mDate || undefined,
          motif: mMotif.trim(),
        });
        setInfo('Sortie enregistrée.');
      }
      setModale(null);
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
      await supprimerMouvementConsommable(aSupprimer.id);
      setASupprimer(null);
      setInfo('Mouvement supprimé — le stock est recalculé.');
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const alertes = stock.filter((a) => a.sousSeuil || a.peremptionProche);

  const r = recherche.trim().toLowerCase();
  const journal = mouvements.filter(
    (m) =>
      (!fArticle || m.consommable.designation === fArticle) &&
      (!r ||
        m.consommable.designation.toLowerCase().includes(r) ||
        (m.motif ?? '').toLowerCase().includes(r)),
  );

  const sens = (m: MouvementConsommable) =>
    m.type === 'entree' ? (
      <span style={{ color: '#1c6b3c', fontWeight: 600 }}>+ Entrée</span>
    ) : m.type === 'sortie' ? (
      <span style={{ color: '#b91c1c', fontWeight: 600 }}>− Sortie</span>
    ) : (
      <span style={{ color: '#b7791f', fontWeight: 600 }}>Ajustement</span>
    );

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          className={vue === 'articles' ? 'btn-primary' : ''}
          onClick={() => setVue('articles')}
        >
          Articles
        </button>
        <button
          type="button"
          className={vue === 'mouvements' ? 'btn-primary' : ''}
          onClick={() => setVue('mouvements')}
        >
          Mouvements
        </button>
        {peutGerer && (
          <>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn-primary" onClick={() => ouvrir('article')}>
              + Nouvel article
            </button>
            <button
              type="button"
              style={{ background: '#1c6b3c', color: '#fff', border: 'none' }}
              onClick={() => ouvrir('entree')}
            >
              + Entrée
            </button>
            <button
              type="button"
              style={{ background: '#9c2f2f', color: '#fff', border: 'none' }}
              onClick={() => ouvrir('sortie')}
            >
              − Sortie
            </button>
          </>
        )}
      </div>

      {erreur && <p className="error">{erreur}</p>}
      {info && <p className="muted">{info}</p>}
      {chargement && <p className="muted">Chargement…</p>}

      {!chargement && vue === 'articles' && (
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
        </section>
      )}

      {!chargement && vue === 'mouvements' && (
        <section className="card list-card">
          <div className="list-header">
            <h2>Mouvements</h2>
            <span className="count">{journal.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <select value={fArticle} onChange={(e) => setFArticle(e.target.value)}>
              <option value="">Article — *</option>
              {stock.map((a) => (
                <option key={a.id} value={a.designation}>
                  {a.designation}
                </option>
              ))}
            </select>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher…"
              style={{ flex: 1, minWidth: 160 }}
            />
          </div>
          {journal.length === 0 && (
            <p className="muted">Aucun mouvement pour ce filtre.</p>
          )}
          {journal.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Article</th>
                  <th>Sens</th>
                  <th>Quantité</th>
                  <th>Motif</th>
                  <th>Origine</th>
                  {peutGerer && <th />}
                </tr>
              </thead>
              <tbody>
                {journal.map((m) => (
                  <tr key={m.id}>
                    <td className="mono">{jour(m.dateMouvement)}</td>
                    <td>{m.consommable.designation}</td>
                    <td>{sens(m)}</td>
                    <td className="mono">
                      {m.quantite} {m.consommable.unite ?? ''}
                    </td>
                    <td className="muted">{m.motif ?? ''}</td>
                    <td className="muted">Manuel</td>
                    {peutGerer && (
                      <td>
                        <button
                          type="button"
                          title="Supprimer ce mouvement"
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#9c2f2f',
                            fontSize: 15,
                          }}
                          onClick={() => {
                            setMErreur(null);
                            setASupprimer(m);
                          }}
                        >
                          🗑
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {modale && (
        <div style={MODALE} onClick={() => !enCours && setModale(null)}>
          <div
            className="card"
            style={{ width: 'min(440px, 92vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {modale === 'article'
                ? 'Nouvel article'
                : modale === 'entree'
                  ? 'Entrée de stock'
                  : 'Sortie de consommation'}
            </h2>
            <div className="form">
              {modale === 'article' ? (
                <>
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
                </>
              ) : (
                <>
                  <div className="field">
                    <label>Article</label>
                    <select value={mArticle} onChange={(e) => setMArticle(e.target.value)}>
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
                        value={mQuantite}
                        onChange={(e) => setMQuantite(Number(e.target.value))}
                      />
                    </div>
                    <div className="field">
                      <label>Date</label>
                      <input
                        type="date"
                        value={mDate}
                        onChange={(e) => setMDate(e.target.value)}
                      />
                    </div>
                  </div>
                  {modale === 'entree' && (
                    <div className="field">
                      <label>Péremption (si applicable)</label>
                      <input
                        type="date"
                        value={mPeremption}
                        onChange={(e) => setMPeremption(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="field">
                    <label>
                      {modale === 'entree' ? 'Référence / motif' : 'Service / motif'}
                    </label>
                    <input
                      value={mMotif}
                      onChange={(e) => setMMotif(e.target.value)}
                      placeholder={
                        modale === 'entree'
                          ? 'Stock initial, bon de livraison n°…'
                          : 'Salle de soins, bloc…'
                      }
                    />
                  </div>
                </>
              )}
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setModale(null)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enCours}
                  onClick={validerModale}
                >
                  {enCours ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {aSupprimer && (
        <div style={MODALE} onClick={() => !enCours && setASupprimer(null)}>
          <div
            className="card"
            style={{ width: 'min(440px, 92vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Supprimer ce mouvement ?</h2>
            <p>
              {jour(aSupprimer.dateMouvement)} — {aSupprimer.consommable.designation},{' '}
              {aSupprimer.type === 'sortie' ? '−' : '+'}
              {aSupprimer.quantite} {aSupprimer.consommable.unite ?? ''}
              {aSupprimer.motif ? ` (${aSupprimer.motif})` : ''}
            </p>
            <p className="muted">
              Le stock sera recalculé sans cette ligne. La suppression est
              refusée si le stock devenait négatif.
            </p>
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
    </>
  );
}
