import { useCallback, useEffect, useState } from 'react';
import {
  getComptesTresorerie,
  getCategoriesTresorerie,
  getMouvementsTresorerie,
  creerCompteTresorerie,
  creerCategorieTresorerie,
  creerRecette,
  creerDepense,
  creerTransfert,
  supprimerMouvement,
  getBudget,
  definirLigneBudget,
  supprimerLigneBudget,
  aPermission,
  type CompteTresorerie,
  type CategorieTresorerie,
  type MouvementTresorerie,
  type BudgetResume,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';
const jourFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');
const iso = (d: Date) => d.toISOString().slice(0, 10);

const TYPE_COMPTE_LIBELLE: Record<CompteTresorerie['type'], string> = {
  caisse: 'Caisse',
  banque: 'Banque',
  mobile_money: 'Mobile Money',
};

type Onglet = 'vue' | 'mouvements' | 'cdg' | 'comptes' | 'categories';
type Saisie = 'recette' | 'depense' | 'transfert';

export default function Tresorerie({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [onglet, setOnglet] = useState<Onglet>('vue');
  const [comptes, setComptes] = useState<CompteTresorerie[]>([]);
  const [categories, setCategories] = useState<CategorieTresorerie[]>([]);
  const [mouvements, setMouvements] = useState<MouvementTresorerie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Periode (defaut : le mois en cours)
  const debutMois = new Date();
  debutMois.setDate(1);
  const [du, setDu] = useState(iso(debutMois));
  const [au, setAu] = useState(iso(new Date()));
  const [recherche, setRecherche] = useState('');

  // Modale de saisie
  const [saisie, setSaisie] = useState<Saisie | null>(null);
  const [sCompte, setSCompte] = useState('');
  const [sCompteDest, setSCompteDest] = useState('');
  const [sCategorie, setSCategorie] = useState('');
  const [sLibelle, setSLibelle] = useState('');
  const [sBeneficiaire, setSBeneficiaire] = useState('');
  const [sMontant, setSMontant] = useState('');
  const [sDate, setSDate] = useState(iso(new Date()));
  const [sErreur, setSErreur] = useState<string | null>(null);

  // Controle de gestion
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [budget, setBudget] = useState<BudgetResume | null>(null);
  const [bModale, setBModale] = useState(false);
  const [bCategorie, setBCategorie] = useState('');
  const [bMontant, setBMontant] = useState('');
  const [bErreur, setBErreur] = useState<string | null>(null);

  // Nouveaux compte / categorie
  const [cNom, setCNom] = useState('');
  const [cType, setCType] = useState<CompteTresorerie['type']>('caisse');
  const [gNom, setGNom] = useState('');
  const [gSens, setGSens] = useState<'recette' | 'depense'>('depense');

  const peutGerer = aPermission('tresorerie.gerer');

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
      const [c, g, m] = await Promise.all([
        getComptesTresorerie(),
        getCategoriesTresorerie(),
        getMouvementsTresorerie(du, au),
      ]);
      setComptes(c);
      setCategories(g);
      setMouvements(m);
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [traiter, du, au]);

  useEffect(() => {
    charger();
  }, [charger]);

  const chargerBudget = useCallback(async () => {
    try {
      setBudget(await getBudget(annee));
    } catch (e) {
      traiter(e);
    }
  }, [annee, traiter]);

  useEffect(() => {
    if (onglet === 'cdg') chargerBudget();
  }, [onglet, chargerBudget]);

  function ouvrirLigneBudget(categorieId?: string, prevu?: number) {
    setBCategorie(categorieId ?? '');
    setBMontant(prevu !== undefined ? String(prevu) : '');
    setBErreur(null);
    setBModale(true);
  }

  async function validerLigneBudget() {
    if (!bCategorie) {
      setBErreur('Choisissez une catégorie');
      return;
    }
    if (bMontant === '' || Number(bMontant) < 0) {
      setBErreur('Indiquez le montant prévu');
      return;
    }
    setEnCours(true);
    setBErreur(null);
    try {
      await definirLigneBudget({
        annee,
        categorieId: bCategorie,
        montantPrevu: Number(bMontant),
      });
      setBModale(false);
      await chargerBudget();
    } catch (e) {
      const m = (e as Error).message;
      if (m.includes('reconnecter')) onSessionExpiree();
      else setBErreur(m);
    } finally {
      setEnCours(false);
    }
  }

  async function retirerLigneBudget(id: string) {
    if (!window.confirm('Retirer cette ligne de budget ?')) return;
    setEnCours(true);
    try {
      await supprimerLigneBudget(id);
      await chargerBudget();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  function raccourci(quoi: 'mois' | 'dernier' | 'trois') {
    const now = new Date();
    if (quoi === 'mois') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      setDu(iso(d));
      setAu(iso(now));
    } else if (quoi === 'dernier') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const f = new Date(now.getFullYear(), now.getMonth(), 0);
      setDu(iso(d));
      setAu(iso(f));
    } else {
      const d = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      setDu(iso(d));
      setAu(iso(now));
    }
  }

  function ouvrirSaisie(type: Saisie) {
    setSaisie(type);
    setSCompte(comptes[0]?.id ?? '');
    setSCompteDest(comptes[1]?.id ?? '');
    setSCategorie('');
    setSLibelle('');
    setSBeneficiaire('');
    setSMontant('');
    setSDate(iso(new Date()));
    setSErreur(null);
  }

  async function validerSaisie() {
    if (!saisie) return;
    if (!sMontant || Number(sMontant) <= 0) {
      setSErreur('Indiquez un montant positif');
      return;
    }
    if (saisie !== 'transfert' && !sLibelle.trim()) {
      setSErreur('Indiquez un libellé');
      return;
    }
    setEnCours(true);
    setSErreur(null);
    try {
      if (saisie === 'transfert') {
        await creerTransfert({
          compteId: sCompte,
          compteDestId: sCompteDest,
          montant: Number(sMontant),
          libelle: sLibelle.trim() || undefined,
          date: sDate,
        });
      } else {
        const donnees = {
          compteId: sCompte,
          categorieId: sCategorie || undefined,
          libelle: sLibelle.trim(),
          beneficiaire: sBeneficiaire.trim() || undefined,
          montant: Number(sMontant),
          date: sDate,
        };
        if (saisie === 'recette') await creerRecette(donnees);
        else await creerDepense(donnees);
      }
      setSaisie(null);
      setInfo('Mouvement enregistré.');
      setErreur(null);
      await charger();
    } catch (e) {
      const m = (e as Error).message;
      if (m.includes('reconnecter')) onSessionExpiree();
      else setSErreur(m);
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer(m: MouvementTresorerie) {
    if (!window.confirm(`Supprimer « ${m.libelle} » (${XAF(Number(m.montant))}) ?`))
      return;
    setEnCours(true);
    try {
      await supprimerMouvement(m.id);
      setInfo('Mouvement supprimé.');
      setErreur(null);
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerCompte() {
    if (!cNom.trim()) return;
    setEnCours(true);
    try {
      await creerCompteTresorerie({ nom: cNom.trim(), type: cType });
      setCNom('');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerCategorie() {
    if (!gNom.trim()) return;
    setEnCours(true);
    try {
      await creerCategorieTresorerie({ nom: gNom.trim(), sens: gSens });
      setGNom('');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  const filtres = mouvements.filter((m) => {
    if (!recherche.trim()) return true;
    const r = recherche.toLowerCase();
    return (
      m.libelle.toLowerCase().includes(r) ||
      (m.beneficiaire ?? '').toLowerCase().includes(r)
    );
  });

  const totalRecettes = mouvements
    .filter((m) => m.type === 'recette')
    .reduce((s, m) => s + Number(m.montant), 0);
  const totalDepenses = mouvements
    .filter((m) => m.type === 'depense')
    .reduce((s, m) => s + Number(m.montant), 0);
  const soldeTotal = comptes.reduce((s, c) => s + c.solde, 0);

  const ONGLETS: { cle: Onglet; libelle: string }[] = [
    { cle: 'vue', libelle: "Vue d'ensemble" },
    { cle: 'mouvements', libelle: 'Mouvements' },
    { cle: 'cdg', libelle: 'CDG' },
    { cle: 'comptes', libelle: 'Comptes' },
    { cle: 'categories', libelle: 'Catégories' },
  ];

  const barre = (pct: number, depasse: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 90,
          height: 8,
          borderRadius: 4,
          background: '#e8ecef',
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        <div
          style={{
            width: `${Math.min(100, pct)}%`,
            height: '100%',
            background: depasse ? '#b91c1c' : pct >= 80 ? '#e9a922' : '#1d4f91',
          }}
        />
      </div>
      <span
        className="mono"
        style={{ fontSize: 12, color: depasse ? '#b91c1c' : undefined }}
      >
        {pct.toFixed(pct >= 100 ? 0 : 1)}%
      </span>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {ONGLETS.map((o) => (
          <button
            key={o.cle}
            type="button"
            className={onglet === o.cle ? 'btn-primary' : ''}
            style={{ padding: '6px 16px' }}
            onClick={() => setOnglet(o.cle)}
          >
            {o.libelle}
          </button>
        ))}
      </div>

      {erreur && <p className="error">{erreur}</p>}
      {info && <p className="muted">{info}</p>}

      {onglet === 'vue' && (
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
                TRÉSORERIE TOTALE
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: soldeTotal >= 0 ? '#1c6b3c' : '#b91c1c',
                }}
              >
                {XAF(soldeTotal)}
              </div>
            </section>
            <section className="card">
              <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                RECETTES ({jourFr(du)} → {jourFr(au)})
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1c6b3c' }}>
                +{XAF(totalRecettes)}
              </div>
            </section>
            <section className="card">
              <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                DÉPENSES ({jourFr(du)} → {jourFr(au)})
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#b91c1c' }}>
                −{XAF(totalDepenses)}
              </div>
            </section>
          </div>
          <section className="card">
            <div className="list-header">
              <h2>Soldes par compte</h2>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Compte</th>
                  <th>Type</th>
                  <th>Solde</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.nom}</td>
                    <td className="muted">{TYPE_COMPTE_LIBELLE[c.type]}</td>
                    <td
                      className="mono"
                      style={{ color: c.solde >= 0 ? '#1c6b3c' : '#b91c1c' }}
                    >
                      {XAF(c.solde)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {onglet === 'mouvements' && (
        <>
          <section className="card" style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                alignItems: 'flex-end',
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <label>Du</label>
                <input type="date" value={du} onChange={(e) => setDu(e.target.value)} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label>Au</label>
                <input type="date" value={au} onChange={(e) => setAu(e.target.value)} />
              </div>
              <button type="button" onClick={() => raccourci('mois')}>
                Ce mois-ci
              </button>
              <button type="button" onClick={() => raccourci('dernier')}>
                Mois dernier
              </button>
              <button type="button" onClick={() => raccourci('trois')}>
                3 derniers mois
              </button>
            </div>
            {peutGerer && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#1c9d55' }}
                  onClick={() => ouvrirSaisie('recette')}
                >
                  + Nouvelle recette
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#b91c1c' }}
                  onClick={() => ouvrirSaisie('depense')}
                >
                  − Nouvelle dépense
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#1d4f91' }}
                  onClick={() => ouvrirSaisie('transfert')}
                >
                  ⇄ Transfert
                </button>
              </div>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher (libellé, bénéficiaire)…"
              />
            </div>
          </section>

          <section className="card">
            <div className="list-header">
              <h2>Mouvements</h2>
              <span className="count">{filtres.length}</span>
            </div>
            {chargement && <p className="muted">Chargement…</p>}
            {!chargement && filtres.length === 0 && (
              <p className="muted">Aucun mouvement sur la période.</p>
            )}
            {!chargement && filtres.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Libellé</th>
                    <th>Catégorie</th>
                    <th>Compte</th>
                    <th>Montant</th>
                    {peutGerer && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtres.map((m) => (
                    <tr key={m.id}>
                      <td className="mono">{jourFr(m.dateMouvement)}</td>
                      <td>
                        {m.libelle}
                        {m.beneficiaire && (
                          <span className="muted"> · {m.beneficiaire}</span>
                        )}
                      </td>
                      <td className="muted">{m.categorie?.nom ?? '—'}</td>
                      <td className="muted">
                        {m.type === 'transfert'
                          ? `${m.compte.nom} → ${m.compteDest?.nom ?? '?'}`
                          : m.compte.nom}
                      </td>
                      <td
                        className="mono"
                        style={{
                          color:
                            m.type === 'recette'
                              ? '#1c6b3c'
                              : m.type === 'depense'
                                ? '#b91c1c'
                                : '#1d4f91',
                          fontWeight: 600,
                        }}
                      >
                        {m.type === 'recette' ? '+' : m.type === 'depense' ? '−' : '⇄'}
                        {XAF(Number(m.montant))}
                      </td>
                      {peutGerer && (
                        <td>
                          {!m.factureId && (
                            <button
                              type="button"
                              style={{ padding: '2px 8px', cursor: 'pointer' }}
                              disabled={enCours}
                              onClick={() => supprimer(m)}
                            >
                              Supprimer
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {onglet === 'cdg' && (
        <>
          <section className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0 }}>
                <label>Année</label>
                <select
                  value={annee}
                  onChange={(e) => setAnnee(Number(e.target.value))}
                >
                  {[0, 1, 2].map((n) => {
                    const a = new Date().getFullYear() - n;
                    return (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    );
                  })}
                </select>
              </div>
              {peutGerer && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => ouvrirLigneBudget()}
                >
                  + Nouvelle ligne de budget
                </button>
              )}
            </div>
          </section>

          {budget && (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <section className="card">
                  <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                    RECETTES (RÉALISÉ / PRÉVU)
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>
                    <span style={{ color: '#1c6b3c' }}>
                      {XAF(budget.totaux.recettesRealise)}
                    </span>{' '}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      / {XAF(budget.totaux.recettesPrevu)}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Réalisation : {budget.totaux.realisation.toFixed(0)} %
                  </div>
                </section>
                <section className="card">
                  <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                    DÉPENSES (RÉALISÉ / PRÉVU)
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700 }}>
                    <span style={{ color: '#b91c1c' }}>
                      {XAF(budget.totaux.depensesRealise)}
                    </span>{' '}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      / {XAF(budget.totaux.depensesPrevu)}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Exécution : {budget.totaux.execution.toFixed(0)} %
                  </div>
                </section>
                <section className="card">
                  <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                    MARGE BUDGÉTAIRE
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: budget.totaux.marge >= 0 ? '#1c6b3c' : '#b91c1c',
                    }}
                  >
                    {XAF(budget.totaux.marge)}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Recettes − dépenses réalisées
                  </div>
                </section>
                <section className="card">
                  <div className="muted" style={{ fontSize: 12, letterSpacing: 1 }}>
                    POSTES EN DÉPASSEMENT
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      color: budget.totaux.depassements > 0 ? '#b91c1c' : undefined,
                    }}
                  >
                    {budget.totaux.depassements}
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    Réalisé supérieur au budget
                  </div>
                </section>
              </div>

              <section className="card">
                <div className="list-header">
                  <h2>Budget {budget.annee}</h2>
                </div>
                {budget.lignes.length === 0 && (
                  <p className="muted">
                    Aucune ligne de budget pour {budget.annee}. Créez-en avec le
                    bouton ci-dessus.
                  </p>
                )}
                {budget.lignes.length > 0 && (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Poste</th>
                        <th>Prévu</th>
                        <th>Réalisé</th>
                        <th>Écart</th>
                        <th>Consommé</th>
                        {peutGerer && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {budget.lignes.map((l, i) => {
                        const depasse =
                          l.categorie.sens === 'depense' && l.realise > l.prevu;
                        const entete =
                          i === 0 ||
                          budget.lignes[i - 1].categorie.sens !== l.categorie.sens;
                        return (
                          <>
                            {entete && (
                              <tr key={`${l.categorie.sens}-tete`}>
                                <td
                                  colSpan={peutGerer ? 6 : 5}
                                  style={{
                                    background:
                                      l.categorie.sens === 'recette'
                                        ? '#e6f4ec'
                                        : '#fdece7',
                                    fontWeight: 700,
                                    fontSize: 12,
                                    letterSpacing: 1,
                                  }}
                                >
                                  {l.categorie.sens === 'recette'
                                    ? 'RECETTES'
                                    : 'DÉPENSES'}
                                </td>
                              </tr>
                            )}
                            <tr key={l.categorie.id}>
                              <td>{l.categorie.nom}</td>
                              <td className="mono">{XAF(l.prevu)}</td>
                              <td className="mono">{XAF(l.realise)}</td>
                              <td
                                className="mono"
                                style={{
                                  color: l.ecart < 0 ? '#b91c1c' : undefined,
                                }}
                              >
                                {XAF(l.ecart)}
                              </td>
                              <td>{barre(l.consomme, depasse)}</td>
                              {peutGerer && (
                                <td>
                                  <button
                                    type="button"
                                    style={{ padding: '2px 8px', cursor: 'pointer' }}
                                    onClick={() =>
                                      ouvrirLigneBudget(l.categorie.id, l.prevu)
                                    }
                                  >
                                    Modifier
                                  </button>{' '}
                                  {l.id && (
                                    <button
                                      type="button"
                                      style={{ padding: '2px 8px', cursor: 'pointer' }}
                                      disabled={enCours}
                                      onClick={() => retirerLigneBudget(l.id as string)}
                                    >
                                      Retirer
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>
            </>
          )}
        </>
      )}

      {onglet === 'comptes' && (
        <section className="card">
          <div className="list-header">
            <h2>Comptes</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Compte</th>
                <th>Type</th>
                <th>Solde</th>
              </tr>
            </thead>
            <tbody>
              {comptes.map((c) => (
                <tr key={c.id}>
                  <td>{c.nom}</td>
                  <td className="muted">{TYPE_COMPTE_LIBELLE[c.type]}</td>
                  <td className="mono">{XAF(c.solde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {peutGerer && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                value={cNom}
                onChange={(e) => setCNom(e.target.value)}
                placeholder="Nom du compte"
              />
              <select
                value={cType}
                onChange={(e) =>
                  setCType(e.target.value as CompteTresorerie['type'])
                }
              >
                <option value="caisse">Caisse</option>
                <option value="banque">Banque</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
              <button
                type="button"
                className="btn-primary"
                disabled={enCours}
                onClick={validerCompte}
              >
                Créer le compte
              </button>
            </div>
          )}
        </section>
      )}

      {onglet === 'categories' && (
        <section className="card">
          <div className="list-header">
            <h2>Catégories</h2>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Sens</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((g) => (
                <tr key={g.id}>
                  <td>{g.nom}</td>
                  <td>
                    <span
                      className="badge-app"
                      style={
                        g.sens === 'recette'
                          ? { background: '#e6f4ec', color: '#1c6b3c' }
                          : { background: '#fdece7', color: '#8c3520' }
                      }
                    >
                      {g.sens === 'recette' ? 'Recette' : 'Dépense'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {peutGerer && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <input
                value={gNom}
                onChange={(e) => setGNom(e.target.value)}
                placeholder="Nom de la catégorie"
              />
              <select
                value={gSens}
                onChange={(e) => setGSens(e.target.value as 'recette' | 'depense')}
              >
                <option value="depense">Dépense</option>
                <option value="recette">Recette</option>
              </select>
              <button
                type="button"
                className="btn-primary"
                disabled={enCours}
                onClick={validerCategorie}
              >
                Créer la catégorie
              </button>
            </div>
          )}
        </section>
      )}

      {bModale && (
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
          onClick={() => !enCours && setBModale(false)}
        >
          <div
            className="card"
            style={{ width: 'min(420px, 92vw)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Ligne de budget {annee}</h2>
            <div className="form">
              <div className="field">
                <label>Catégorie</label>
                <select
                  value={bCategorie}
                  onChange={(e) => setBCategorie(e.target.value)}
                >
                  <option value="">Choisir…</option>
                  {categories.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nom} ({g.sens === 'recette' ? 'recette' : 'dépense'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Montant prévu pour l'année (FCFA)</label>
                <input
                  type="number"
                  min={0}
                  value={bMontant}
                  onChange={(e) => setBMontant(e.target.value)}
                />
              </div>
              {bErreur && <p className="error">{bErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setBModale(false)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enCours}
                  onClick={validerLigneBudget}
                >
                  {enCours ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saisie && (
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
          onClick={() => !enCours && setSaisie(null)}
        >
          <div
            className="card"
            style={{ width: 'min(460px, 92vw)', maxHeight: '88vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {saisie === 'recette'
                ? 'Nouvelle recette'
                : saisie === 'depense'
                  ? 'Nouvelle dépense'
                  : 'Transfert entre comptes'}
            </h2>
            <div className="form">
              <div className="row">
                <div className="field">
                  <label>{saisie === 'transfert' ? 'Depuis le compte' : 'Compte'}</label>
                  <select value={sCompte} onChange={(e) => setSCompte(e.target.value)}>
                    {comptes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nom}
                      </option>
                    ))}
                  </select>
                </div>
                {saisie === 'transfert' ? (
                  <div className="field">
                    <label>Vers le compte</label>
                    <select
                      value={sCompteDest}
                      onChange={(e) => setSCompteDest(e.target.value)}
                    >
                      {comptes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="field">
                    <label>Catégorie</label>
                    <select
                      value={sCategorie}
                      onChange={(e) => setSCategorie(e.target.value)}
                    >
                      <option value="">—</option>
                      {categories
                        .filter((g) => g.sens === saisie)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.nom}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="field">
                <label>Libellé</label>
                <input
                  value={sLibelle}
                  onChange={(e) => setSLibelle(e.target.value)}
                  placeholder={
                    saisie === 'transfert' ? 'Transfert entre comptes' : 'Achat de…'
                  }
                />
              </div>
              {saisie !== 'transfert' && (
                <div className="field">
                  <label>Bénéficiaire / payeur</label>
                  <input
                    value={sBeneficiaire}
                    onChange={(e) => setSBeneficiaire(e.target.value)}
                  />
                </div>
              )}
              <div className="row">
                <div className="field">
                  <label>Montant (FCFA)</label>
                  <input
                    type="number"
                    min={1}
                    value={sMontant}
                    onChange={(e) => setSMontant(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={sDate}
                    onChange={(e) => setSDate(e.target.value)}
                  />
                </div>
              </div>
              {sErreur && <p className="error">{sErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setSaisie(null)}>
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={enCours}
                  onClick={validerSaisie}
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
