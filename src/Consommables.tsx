import { useCallback, useEffect, useState } from 'react';
import {
  getStockConsommables,
  getMouvementsConsommables,
  creerConsommable,
  modifierConsommable,
  supprimerConsommable,
  entreeConsommable,
  sortieConsommable,
  supprimerMouvementConsommable,
  aPermission,
  type ArticleConsommable,
  type MouvementConsommable,
} from './api';

const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '';

// --- Styles repris du design Edufo -----------------------------------------
const inp = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
} as const;
const lbl = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 4,
} as const;
const thT = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  color: '#475569',
  fontWeight: 600,
  textTransform: 'uppercase',
} as const;
const tdT = { padding: '10px 12px', color: '#1E293B' } as const;
const overlayT = {
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
const modalT = {
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  width: '100%',
  maxWidth: 440,
  boxShadow: '0 10px 40px rgba(0,0,0,.2)',
} as const;
const BRAND = '#1d4f91';

type FormArticle = {
  id?: string;
  designation: string;
  unite: string;
  seuilAlerte: number | string;
  note: string;
  actif: boolean;
};
type FormMvt = {
  sens: 'entree' | 'sortie';
  consommableId: string;
  quantite: number | string;
  motif: string;
};
type Confirmation = { message: string; action: () => Promise<void> };

export default function Consommables({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [tab, setTab] = useState<'articles' | 'mouvements'>('articles');
  const [articles, setArticles] = useState<ArticleConsommable[]>([]);
  const [mvts, setMvts] = useState<MouvementConsommable[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [articleForm, setArticleForm] = useState<FormArticle | null>(null);
  const [mvtForm, setMvtForm] = useState<FormMvt | null>(null);
  const [fErreur, setFErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [filtreArticle, setFiltreArticle] = useState('');
  const [recherche, setRecherche] = useState('');

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
      const [a, m] = await Promise.all([
        getStockConsommables(),
        getMouvementsConsommables(),
      ]);
      setArticles(a);
      setMvts(m);
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

  const q = recherche.trim().toLowerCase();
  const articlesFiltres = articles.filter(
    (a) => !q || a.designation.toLowerCase().includes(q),
  );
  const mvtsFiltres = mvts.filter(
    (m) =>
      (!filtreArticle || m.consommable.designation === filtreArticle) &&
      (!q ||
        [m.consommable.designation, m.motif]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)),
  );

  async function saveArticle() {
    if (!articleForm) return;
    if (!articleForm.designation.trim()) {
      setFErreur("Le nom de l'article est requis.");
      return;
    }
    setEnCours(true);
    setFErreur(null);
    try {
      const donnees = {
        designation: articleForm.designation.trim(),
        unite: articleForm.unite.trim() || 'unité',
        seuilAlerte: Number(articleForm.seuilAlerte) || 0,
        note: articleForm.note.trim() || undefined,
      };
      if (articleForm.id) {
        await modifierConsommable(articleForm.id, {
          ...donnees,
          note: articleForm.note.trim(),
          actif: articleForm.actif,
        });
      } else {
        await creerConsommable(donnees);
      }
      setArticleForm(null);
      await charger();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function saveMvt() {
    if (!mvtForm) return;
    if (!mvtForm.consommableId) {
      setFErreur('Choisissez un article.');
      return;
    }
    if (!(Number(mvtForm.quantite) > 0)) {
      setFErreur('La quantité doit être positive.');
      return;
    }
    setEnCours(true);
    setFErreur(null);
    try {
      const donnees = {
        consommableId: mvtForm.consommableId,
        quantite: Number(mvtForm.quantite),
        motif: mvtForm.motif.trim() || undefined,
      };
      if (mvtForm.sens === 'entree') {
        await entreeConsommable(donnees);
      } else {
        await sortieConsommable({
          ...donnees,
          motif: mvtForm.motif.trim() || 'Sortie',
        });
      }
      setMvtForm(null);
      await charger();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  function demanderSuppressionArticle(a: ArticleConsommable) {
    setFErreur(null);
    setConfirmation({
      message: 'Supprimer cet article ?',
      action: async () => {
        await supprimerConsommable(a.id);
      },
    });
  }

  function demanderSuppressionMvt(m: MouvementConsommable) {
    setFErreur(null);
    setConfirmation({
      message: 'Supprimer ce mouvement ?',
      action: async () => {
        await supprimerMouvementConsommable(m.id);
      },
    });
  }

  async function validerConfirmation() {
    if (!confirmation) return;
    setEnCours(true);
    setFErreur(null);
    try {
      await confirmation.action();
      setConfirmation(null);
      await charger();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const tabBtn = (k: 'articles' | 'mouvements', label: string) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      style={{
        padding: '8px 14px',
        border: '1px solid ' + (tab === k ? BRAND : '#CBD5E1'),
        background: tab === k ? BRAND : '#fff',
        color: tab === k ? '#fff' : '#334155',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <p style={{ color: '#64748B', fontSize: 14, marginTop: -6, marginBottom: 14 }}>
        Articles, entrées et sorties — le stock est calculé à partir des
        mouvements.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabBtn('articles', 'Articles')}
        {tabBtn('mouvements', 'Mouvements')}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {peutGerer && (
          <>
            <button
              type="button"
              onClick={() => {
                setFErreur(null);
                setArticleForm({
                  designation: '',
                  unite: 'unité',
                  seuilAlerte: 0,
                  note: '',
                  actif: true,
                });
              }}
              style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              + Nouvel article
            </button>
            <button
              type="button"
              onClick={() => {
                setFErreur(null);
                setMvtForm({ sens: 'entree', consommableId: '', quantite: '', motif: '' });
              }}
              style={{ background: '#166534', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              ＋ Entrée
            </button>
            <button
              type="button"
              onClick={() => {
                setFErreur(null);
                setMvtForm({ sens: 'sortie', consommableId: '', quantite: '', motif: '' });
              }}
              style={{ background: '#991B1B', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              － Sortie
            </button>
          </>
        )}
        {tab === 'mouvements' && (
          <select
            value={filtreArticle}
            onChange={(e) => setFiltreArticle(e.target.value)}
            style={{ ...inp, width: 220, cursor: 'pointer' }}
          >
            <option value="">Article — *</option>
            {articles.map((a) => (
              <option key={a.id} value={a.designation}>
                {a.designation}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          placeholder="🔍 Rechercher…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ ...inp, width: 240 }}
        />
      </div>

      {erreur && <p className="error">{erreur}</p>}

      {tab === 'articles' &&
        (chargement ? (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>…</div>
        ) : articlesFiltres.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>
            {articles.length === 0
              ? 'Aucun article. Créez votre premier article pour démarrer le suivi.'
              : 'Aucun résultat.'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 640 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={thT}>Article</th>
                  <th style={thT}>Unité</th>
                  <th style={{ ...thT, textAlign: 'right' }}>Stock</th>
                  <th style={{ ...thT, textAlign: 'right' }}>Seuil</th>
                  <th style={thT}>Statut</th>
                  <th style={thT}></th>
                </tr>
              </thead>
              <tbody>
                {articlesFiltres.map((a) => (
                  <tr key={a.id} style={{ borderTop: '1px solid #F1F5F9', opacity: a.actif === false ? 0.5 : 1 }}>
                    <td style={{ ...tdT, fontWeight: 600 }}>
                      {a.designation}{' '}
                      {a.actif === false && (
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>(inactif)</span>
                      )}
                    </td>
                    <td style={tdT}>{a.unite ?? 'unité'}</td>
                    <td style={{ ...tdT, textAlign: 'right', fontWeight: 700 }}>{a.stock}</td>
                    <td style={{ ...tdT, textAlign: 'right', color: '#64748B' }}>{a.seuilAlerte}</td>
                    <td style={tdT}>
                      {a.sousSeuil ? (
                        <span style={{ background: '#FEE2E2', color: '#991B1B', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          ⚠ Stock bas
                        </span>
                      ) : (
                        <span style={{ background: '#DCFCE7', color: '#166534', padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                          OK
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdT, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {peutGerer && (
                        <>
                          <button
                            type="button"
                            title="Modifier"
                            onClick={() => {
                              setFErreur(null);
                              setArticleForm({
                                id: a.id,
                                designation: a.designation,
                                unite: a.unite ?? 'unité',
                                seuilAlerte: a.seuilAlerte,
                                note: a.note ?? '',
                                actif: a.actif !== false,
                              });
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 4 }}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => demanderSuppressionArticle(a)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', padding: 4 }}
                          >
                            🗑
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'mouvements' &&
        (chargement ? (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>…</div>
        ) : mvtsFiltres.length === 0 ? (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>
            {mvts.length === 0
              ? 'Aucun mouvement. Enregistrez une entrée ou une sortie.'
              : 'Aucun résultat.'}
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 720 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={thT}>Date</th>
                  <th style={thT}>Article</th>
                  <th style={thT}>Sens</th>
                  <th style={{ ...thT, textAlign: 'right' }}>Quantité</th>
                  <th style={thT}>Motif</th>
                  <th style={thT}>Origine</th>
                  <th style={thT}></th>
                </tr>
              </thead>
              <tbody>
                {mvtsFiltres.map((m) => (
                  <tr key={m.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                    <td style={{ ...tdT, whiteSpace: 'nowrap', color: '#64748B', fontSize: 13 }}>
                      {jour(m.dateMouvement)}
                    </td>
                    <td style={{ ...tdT, fontWeight: 600 }}>{m.consommable.designation}</td>
                    <td style={tdT}>
                      {m.type === 'entree' ? (
                        <span style={{ color: '#166534', fontWeight: 700 }}>＋ Entrée</span>
                      ) : m.type === 'sortie' ? (
                        <span style={{ color: '#991B1B', fontWeight: 700 }}>－ Sortie</span>
                      ) : (
                        <span style={{ color: '#B45309', fontWeight: 700 }}>Ajustement</span>
                      )}
                    </td>
                    <td style={{ ...tdT, textAlign: 'right', fontWeight: 600 }}>
                      {m.quantite} {m.consommable.unite ?? 'unité'}
                    </td>
                    <td style={tdT}>{m.motif || '—'}</td>
                    <td style={tdT}>Manuel</td>
                    <td style={{ ...tdT, textAlign: 'right' }}>
                      {peutGerer && (
                        <button
                          type="button"
                          title="Supprimer"
                          onClick={() => demanderSuppressionMvt(m)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', padding: 4 }}
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {articleForm && (
        <div style={overlayT} onClick={() => !enCours && setArticleForm(null)}>
          <div style={modalT} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#0A1F44' }}>
              {articleForm.id ? articleForm.designation : 'Nouvel article'}
            </h3>
            <label style={lbl}>Nom de l'article</label>
            <input
              type="text"
              value={articleForm.designation}
              onChange={(e) => setArticleForm({ ...articleForm, designation: e.target.value })}
              style={{ ...inp, marginBottom: 12 }}
            />
            <label style={lbl}>Unité (ex. : boîte, rouleau, flacon)</label>
            <input
              type="text"
              value={articleForm.unite}
              onChange={(e) => setArticleForm({ ...articleForm, unite: e.target.value })}
              style={{ ...inp, marginBottom: 12 }}
            />
            <label style={lbl}>Seuil d'alerte</label>
            <input
              type="number"
              min={0}
              value={articleForm.seuilAlerte}
              onChange={(e) => setArticleForm({ ...articleForm, seuilAlerte: e.target.value })}
              style={{ ...inp, marginBottom: 12 }}
            />
            <label style={lbl}>Note</label>
            <input
              type="text"
              value={articleForm.note}
              onChange={(e) => setArticleForm({ ...articleForm, note: e.target.value })}
              style={{ ...inp, marginBottom: 12 }}
            />
            {articleForm.id && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={articleForm.actif}
                  onChange={(e) => setArticleForm({ ...articleForm, actif: e.target.checked })}
                />{' '}
                Actif
              </label>
            )}
            {fErreur && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => setArticleForm(null)}
                style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={saveArticle}
                style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {mvtForm && (
        <div style={overlayT} onClick={() => !enCours && setMvtForm(null)}>
          <div style={modalT} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: mvtForm.sens === 'entree' ? '#166534' : '#991B1B' }}>
              {mvtForm.sens === 'entree' ? '＋ Entrée' : '－ Sortie'}
            </h3>
            <label style={lbl}>Article</label>
            <select
              value={mvtForm.consommableId}
              onChange={(e) => setMvtForm({ ...mvtForm, consommableId: e.target.value })}
              style={{ ...inp, marginBottom: 12, cursor: 'pointer' }}
            >
              <option value="">—</option>
              {articles
                .filter((a) => a.actif !== false)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.designation} ({a.stock} {a.unite ?? 'unité'})
                  </option>
                ))}
            </select>
            <label style={lbl}>Quantité</label>
            <input
              type="number"
              min={1}
              value={mvtForm.quantite}
              onChange={(e) => setMvtForm({ ...mvtForm, quantite: e.target.value })}
              style={{ ...inp, marginBottom: 12 }}
            />
            <label style={lbl}>Motif</label>
            <input
              type="text"
              value={mvtForm.motif}
              onChange={(e) => setMvtForm({ ...mvtForm, motif: e.target.value })}
              style={{ ...inp, marginBottom: 16 }}
            />
            {fErreur && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => setMvtForm(null)}
                style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={saveMvt}
                style={{ background: mvtForm.sens === 'entree' ? '#166534' : '#991B1B', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmation && (
        <div style={{ ...overlayT, zIndex: 1100 }} onClick={() => !enCours && setConfirmation(null)}>
          <div style={modalT} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 10 }}>
              Confirmer
            </div>
            <div style={{ fontSize: 14, color: '#334155', marginBottom: 16 }}>
              {confirmation.message}
            </div>
            {fErreur && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => setConfirmation(null)}
                style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#334155' }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={validerConfirmation}
                style={{ background: '#991B1B', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
