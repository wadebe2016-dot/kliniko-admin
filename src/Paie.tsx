import { useCallback, useEffect, useState } from 'react';
import {
  getBulletinsPaie,
  getParametresPaie,
  majParametresPaie,
  majTranchesIrpp,
  genererBulletin,
  genererBulletinsTous,
  supprimerBulletin,
  versementBulletin,
  versementLotPaie,
  getPersonnel,
  type BulletinPaie,
  type MembrePersonnel,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '';

const MOIS_LIBELLE = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];
const MODE_LIBELLE: Record<string, string> = {
  virement: 'Virement',
  momo: 'Mobile Money',
  especes: 'Espèces',
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

// ---------------------------------------------------------------------------
// Bulletin imprimable (meme mecanique que les ordonnances et les recus)
// ---------------------------------------------------------------------------

type CliniquePublique = {
  nom: string;
  ville: string | null;
  telephone: string | null;
};

async function cliniqueDuBulletin(): Promise<CliniquePublique | null> {
  try {
    const res = await fetch('/api/public/cliniques');
    if (!res.ok) return null;
    const liste = (await res.json()) as CliniquePublique[];
    return liste[0] ?? null;
  } catch {
    return null;
  }
}

function echapper(t: string) {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gabaritBulletin(
  b: BulletinPaie,
  clinique: CliniquePublique | null,
): string {
  const nomComplet = `${b.personnel.nom} ${b.personnel.prenom ?? ''}`.trim();
  let primes: { libelle: string; montant: number }[] = [];
  try {
    primes = b.primesDetail ? JSON.parse(b.primesDetail) : [];
  } catch {
    primes = [];
  }
  const totalRetenues = b.cnps + b.irpp + b.cac + b.autresRetenues;
  const ligne = (lib: string, gain: number | null, retenue: number | null) =>
    `<tr><td>${echapper(lib)}</td><td class="m">${gain !== null ? XAF(gain) : ''}</td><td class="m">${retenue !== null ? XAF(retenue) : ''}</td></tr>`;

  const lignes = [
    ligne('Salaire de base', b.salaireBase, null),
    ...primes.map((p) => ligne(p.libelle, p.montant, null)),
    ligne('CNPS pension vieillesse (part salariale)', null, b.cnps),
    ligne('Retenue IRPP', null, b.irpp),
    ligne('CAC sur IRPP', null, b.cac),
    ...(b.autresRetenues > 0
      ? [ligne('Autres retenues', null, b.autresRetenues)]
      : []),
  ].join('');

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bulletin de paie ${echapper(nomComplet)} — ${MOIS_LIBELLE[b.mois - 1]} ${b.annee}</title>
<style>
@page { size: A4; margin: 16mm; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1c2733; font-size: 13px; margin: 0; }
.entete { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4f91; padding-bottom: 10px; }
.clinique { font-size: 17px; font-weight: 700; color: #1d4f91; }
.muted { color: #5b6572; font-size: 12px; }
h1 { font-size: 16px; text-align: center; margin: 16px 0 2px; letter-spacing: 1px; }
.periode { text-align: center; color: #5b6572; margin-bottom: 14px; }
.employe { display: flex; justify-content: space-between; background: #f4f7fa; border: 1px solid #dde4ec; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 11px; text-transform: uppercase; color: #5b6572; border-bottom: 2px solid #1d4f91; padding: 6px 8px; }
th.m, td.m { text-align: right; white-space: nowrap; }
td { padding: 7px 8px; border-bottom: 1px solid #e8ecef; }
.totaux td { font-weight: 700; border-top: 2px solid #1d4f91; border-bottom: none; }
.net { margin-top: 14px; text-align: right; }
.net .montant { font-size: 20px; font-weight: 800; color: #166534; }
.versement { margin-top: 6px; text-align: right; color: #5b6572; font-size: 12px; }
.pied { margin-top: 26px; border-top: 1px solid #dde4ec; padding-top: 8px; font-size: 11px; color: #8a94a1; text-align: center; }
</style></head><body>
<div class="entete">
  <div>
    <div class="clinique">${echapper(clinique?.nom ?? 'Kliniko')}</div>
    <div class="muted">${echapper(clinique?.ville ?? '')}${clinique?.telephone ? ' · ' + echapper(clinique.telephone) : ''}</div>
  </div>
  <div class="muted" style="text-align:right">Bulletin n° ${echapper(b.id.slice(0, 8).toUpperCase())}<br>Édité le ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
<h1>BULLETIN DE PAIE</h1>
<div class="periode">${MOIS_LIBELLE[b.mois - 1]} ${b.annee}</div>
<div class="employe">
  <div><strong>${echapper(nomComplet)}</strong><br><span class="muted">${echapper(b.personnel.fonction ?? '')}</span></div>
  <div style="text-align:right">Matricule : <strong>${echapper(b.personnel.matricule ?? '—')}</strong></div>
</div>
<table>
  <thead><tr><th>Rubrique</th><th class="m">Gains</th><th class="m">Retenues</th></tr></thead>
  <tbody>
    ${lignes}
    <tr class="totaux"><td>Totaux</td><td class="m">${XAF(b.brut)}</td><td class="m">${XAF(totalRetenues)}</td></tr>
  </tbody>
</table>
<div class="net">Net à payer : <span class="montant">${XAF(b.net)}</span></div>
<div class="versement">${
    b.statutVersement === 'paye'
      ? `Versé le ${jour(b.dateVersement)}${b.modeVersement ? ' par ' + (MODE_LIBELLE[b.modeVersement] ?? b.modeVersement).toLowerCase() : ''}`
      : 'Versement en attente'
  }</div>
<div class="pied">Bulletin établi via Kliniko — outil d'aide au calcul (CNPS, IRPP, CAC), à faire valider par votre comptable.</div>
</body></html>`;
}

// Impression par cadre invisible (les bloqueurs de fenetres ne s'y opposent pas)
function imprimerHtml(html: string) {
  const cadre = document.createElement('iframe');
  cadre.style.position = 'fixed';
  cadre.style.right = '0';
  cadre.style.bottom = '0';
  cadre.style.width = '0';
  cadre.style.height = '0';
  cadre.style.border = '0';
  document.body.appendChild(cadre);
  const doc = cadre.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  cadre.contentWindow?.focus();
  cadre.contentWindow?.print();
  window.setTimeout(() => document.body.removeChild(cadre), 2000);
}
const CARTE_MODALE = {
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  width: '100%',
  maxWidth: 520,
  boxShadow: '0 10px 40px rgba(0,0,0,.2)',
} as const;

type Prime = { libelle: string; montant: number | string };
type TrancheForm = { borneMin: number | string; borneMax: number | string; taux: number | string };

export default function Paie({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const maintenant = new Date();
  const [mois, setMois] = useState(maintenant.getMonth() + 1);
  const [annee, setAnnee] = useState(maintenant.getFullYear());
  const [bulletins, setBulletins] = useState<BulletinPaie[]>([]);
  const [membres, setMembres] = useState<MembrePersonnel[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Modales
  const [mErreur, setMErreur] = useState<string | null>(null);
  const [modaleBulletin, setModaleBulletin] = useState(false);
  const [bPersonnel, setBPersonnel] = useState('');
  const [bPrimes, setBPrimes] = useState<Prime[]>([]);
  const [modaleVersement, setModaleVersement] = useState<BulletinPaie | null>(null);
  const [vMode, setVMode] = useState<'virement' | 'momo' | 'especes'>('virement');
  const [vDate, setVDate] = useState(new Date().toISOString().slice(0, 10));
  const [vLot, setVLot] = useState(false);
  const [aSupprimer, setASupprimer] = useState<BulletinPaie | null>(null);
  const [apercu, setApercu] = useState<{ html: string; titre: string } | null>(
    null,
  );

  // Parametres
  const [modaleParams, setModaleParams] = useState(false);
  const [pCnps, setPCnps] = useState('');
  const [pPlafond, setPPlafond] = useState('');
  const [pAbattement, setPAbattement] = useState('');
  const [pCac, setPCac] = useState('');
  const [pTranches, setPTranches] = useState<TrancheForm[]>([]);

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
      setBulletins(await getBulletinsPaie(mois, annee));
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [mois, annee, traiter]);

  useEffect(() => {
    charger();
  }, [charger]);
  useEffect(() => {
    getPersonnel()
      .then(setMembres)
      .catch(() => setMembres([]));
  }, []);

  async function genererTous() {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await genererBulletinsTous(mois, annee);
      setInfo(
        `${r.generes} bulletin${r.generes > 1 ? 's' : ''} généré${r.generes > 1 ? 's' : ''}` +
          (r.ignores > 0 ? ` — ${r.ignores} déjà versé${r.ignores > 1 ? 's' : ''} (non touchés)` : '') +
          '.',
      );
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerBulletin() {
    if (!bPersonnel) {
      setMErreur('Choisissez un employé.');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await genererBulletin({
        personnelId: bPersonnel,
        mois,
        annee,
        primes: bPrimes
          .filter((p) => p.libelle.trim() && Number(p.montant) > 0)
          .map((p) => ({ libelle: p.libelle.trim(), montant: Number(p.montant) })),
      });
      setModaleBulletin(false);
      setInfo('Bulletin généré.');
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function validerVersement() {
    setEnCours(true);
    setMErreur(null);
    try {
      if (vLot) {
        const r = await versementLotPaie({
          mois,
          annee,
          dateVersement: vDate,
          modeVersement: vMode,
        });
        setInfo(`${r.nbPayes} bulletin${r.nbPayes > 1 ? 's' : ''} marqué${r.nbPayes > 1 ? 's' : ''} versé${r.nbPayes > 1 ? 's' : ''}.`);
      } else if (modaleVersement) {
        await versementBulletin(modaleVersement.id, {
          statut: 'paye',
          dateVersement: vDate,
          modeVersement: vMode,
        });
        setInfo('Versement enregistré.');
      }
      setModaleVersement(null);
      setVLot(false);
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function annulerVersement(b: BulletinPaie) {
    setEnCours(true);
    setErreur(null);
    try {
      await versementBulletin(b.id, { statut: 'en_attente' });
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrirApercu(b: BulletinPaie) {
    const clinique = await cliniqueDuBulletin();
    setApercu({
      html: gabaritBulletin(b, clinique),
      titre: `${b.personnel.nom} ${b.personnel.prenom ?? ''} — ${MOIS_LIBELLE[b.mois - 1]} ${b.annee}`,
    });
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setEnCours(true);
    setMErreur(null);
    try {
      await supprimerBulletin(aSupprimer.id);
      setASupprimer(null);
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrirParams() {
    setMErreur(null);
    try {
      const r = await getParametresPaie();
      setPCnps(String(r.parametres.tauxCnpsSalarial));
      setPPlafond(String(r.parametres.plafondCnps));
      setPAbattement(String(r.parametres.abattementFraisPct));
      setPCac(String(r.parametres.cacPct));
      setPTranches(
        r.tranches.map((t) => ({
          borneMin: t.borneMin,
          borneMax: t.borneMax ?? '',
          taux: t.taux,
        })),
      );
      setModaleParams(true);
    } catch (e) {
      traiter(e);
    }
  }

  async function validerParams() {
    setEnCours(true);
    setMErreur(null);
    try {
      await majParametresPaie({
        tauxCnpsSalarial: Number(pCnps) || 0,
        plafondCnps: Number(pPlafond) || 0,
        abattementFraisPct: Number(pAbattement) || 0,
        cacPct: Number(pCac) || 0,
      });
      await majTranchesIrpp(
        pTranches.map((t) => ({
          borneMin: Number(t.borneMin) || 0,
          borneMax: t.borneMax === '' ? null : Number(t.borneMax),
          taux: Number(t.taux) || 0,
        })),
      );
      setModaleParams(false);
      setInfo('Paramètres enregistrés — ils s’appliqueront aux prochains bulletins.');
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const totaux = bulletins.reduce(
    (s, b) => ({
      brut: s.brut + b.brut,
      cnps: s.cnps + b.cnps,
      irpp: s.irpp + b.irpp,
      cac: s.cac + b.cac,
      net: s.net + b.net,
    }),
    { brut: 0, cnps: 0, irpp: 0, cac: 0, net: 0 },
  );
  const nbPayes = bulletins.filter((b) => b.statutVersement === 'paye').length;

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={mois} onChange={(e) => setMois(Number(e.target.value))}>
          {MOIS_LIBELLE.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={annee}
          min={2020}
          onChange={(e) => setAnnee(Number(e.target.value))}
          style={{ width: 90 }}
        />
        <button type="button" className="btn-primary" disabled={enCours} onClick={genererTous}>
          Générer tout le personnel
        </button>
        <button
          type="button"
          disabled={enCours}
          onClick={() => {
            setBPersonnel('');
            setBPrimes([]);
            setMErreur(null);
            setModaleBulletin(true);
          }}
        >
          + Bulletin individuel
        </button>
        {bulletins.length > 0 && nbPayes < bulletins.length && (
          <button
            type="button"
            disabled={enCours}
            style={{ background: '#166534', color: '#fff', border: 'none' }}
            onClick={() => {
              setVLot(true);
              setVMode('virement');
              setVDate(new Date().toISOString().slice(0, 10));
              setMErreur(null);
              setModaleVersement(null);
            }}
          >
            Tout marquer versé
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={ouvrirParams} title="Paramètres CNPS / IRPP">
          ⚙ Paramètres
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: -6 }}>
        Moteur de calcul camerounais (CNPS salariale plafonnée, abattement frais
        professionnels, IRPP par tranches annuelles, CAC) — outil d'aide, à
        faire valider par votre comptable.
      </p>

      {erreur && <p className="error">{erreur}</p>}
      {info && <p className="muted">{info}</p>}
      {chargement && <p className="muted">Chargement…</p>}

      {!chargement && bulletins.length === 0 && (
        <p className="muted">
          Aucun bulletin pour {MOIS_LIBELLE[mois - 1]} {annee}. « Générer tout
          le personnel » crée un bulletin par employé actif ayant un salaire de
          base.
        </p>
      )}

      {!chargement && bulletins.length > 0 && (
        <section className="card list-card">
          <div className="list-header">
            <h2>
              Bulletins — {MOIS_LIBELLE[mois - 1]} {annee}
            </h2>
            <span className="count">{bulletins.length}</span>
            <span className="count" style={{ background: '#e6f4ec', color: '#1c6b3c' }}>
              {nbPayes} versé{nbPayes > 1 ? 's' : ''}
            </span>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Matricule</th>
                <th>Nom</th>
                <th>Brut</th>
                <th>CNPS</th>
                <th>IRPP</th>
                <th>CAC</th>
                <th>Net à payer</th>
                <th>Versement</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {bulletins.map((b) => (
                <tr key={b.id}>
                  <td className="mono">{b.personnel.matricule ?? '—'}</td>
                  <td>
                    {b.personnel.nom} {b.personnel.prenom ?? ''}
                    <span className="muted"> · {b.personnel.fonction ?? ''}</span>
                    {b.totalPrimes > 0 && (
                      <span className="muted"> (+{XAF(b.totalPrimes)} primes)</span>
                    )}
                  </td>
                  <td className="mono">{XAF(b.brut)}</td>
                  <td className="mono muted">{XAF(b.cnps)}</td>
                  <td className="mono muted">{XAF(b.irpp)}</td>
                  <td className="mono muted">{XAF(b.cac)}</td>
                  <td className="mono" style={{ fontWeight: 700, color: '#1c6b3c' }}>
                    {XAF(b.net)}
                  </td>
                  <td>
                    {b.statutVersement === 'paye' ? (
                      <span className="badge-app" style={{ background: '#e6f4ec', color: '#1c6b3c' }}>
                        Payé le {jour(b.dateVersement)}
                        {b.modeVersement ? ` (${MODE_LIBELLE[b.modeVersement] ?? b.modeVersement})` : ''}
                      </span>
                    ) : (
                      <span className="badge-app" style={{ background: '#fdf3e2', color: '#b7791f' }}>
                        En attente
                      </span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button
                      type="button"
                      title="Aperçu / imprimer le bulletin"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      onClick={() => ouvrirApercu(b)}
                    >
                      🖨
                    </button>
                    {b.statutVersement === 'paye' ? (
                      <button
                        type="button"
                        title="Annuler le versement"
                        disabled={enCours}
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => annulerVersement(b)}
                      >
                        ↩
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="Marquer versé"
                          disabled={enCours}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: 700 }}
                          onClick={() => {
                            setVLot(false);
                            setVMode('virement');
                            setVDate(new Date().toISOString().slice(0, 10));
                            setMErreur(null);
                            setModaleVersement(b);
                          }}
                        >
                          💰
                        </button>
                        <button
                          type="button"
                          title="Supprimer"
                          disabled={enCours}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c2f2f' }}
                          onClick={() => {
                            setMErreur(null);
                            setASupprimer(b);
                          }}
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: 700, borderTop: '2px solid #d5dbe3' }}>
                <td />
                <td>Total ({bulletins.length})</td>
                <td className="mono">{XAF(totaux.brut)}</td>
                <td className="mono">{XAF(totaux.cnps)}</td>
                <td className="mono">{XAF(totaux.irpp)}</td>
                <td className="mono">{XAF(totaux.cac)}</td>
                <td className="mono" style={{ color: '#1c6b3c' }}>
                  {XAF(totaux.net)}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {modaleBulletin && (
        <div style={MODALE} onClick={() => !enCours && setModaleBulletin(false)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              Bulletin — {MOIS_LIBELLE[mois - 1]} {annee}
            </h3>
            <div className="form">
              <div className="field">
                <label>Employé</label>
                <select value={bPersonnel} onChange={(e) => setBPersonnel(e.target.value)}>
                  <option value="">Choisir…</option>
                  {membres
                    .filter((m) => m.statut === 'actif')
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nom} {m.prenom ?? ''} — {m.fonction}
                      </option>
                    ))}
                </select>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                Primes du mois (optionnel)
              </label>
              {bPrimes.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input
                    placeholder="Libellé (prime de garde…)"
                    value={p.libelle}
                    onChange={(e) =>
                      setBPrimes(bPrimes.map((x, j) => (j === i ? { ...x, libelle: e.target.value } : x)))
                    }
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Montant"
                    value={p.montant}
                    onChange={(e) =>
                      setBPrimes(bPrimes.map((x, j) => (j === i ? { ...x, montant: e.target.value } : x)))
                    }
                    style={{ width: 120 }}
                  />
                  <button
                    type="button"
                    onClick={() => setBPrimes(bPrimes.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c2f2f' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setBPrimes([...bPrimes, { libelle: '', montant: '' }])}
                style={{ alignSelf: 'flex-start' }}
              >
                + Ajouter une prime
              </button>
              <p className="muted" style={{ fontSize: 12 }}>
                Le brut = salaire de base (fiche RH) + primes. CNPS, IRPP et CAC
                sont calculés automatiquement. Régénérer un bulletin existant le
                remplace.
              </p>
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" disabled={enCours} onClick={() => setModaleBulletin(false)}>
                  Annuler
                </button>
                <button type="button" className="btn-primary" disabled={enCours} onClick={validerBulletin}>
                  {enCours ? 'Calcul…' : 'Générer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(modaleVersement || vLot) && (
        <div
          style={MODALE}
          onClick={() => {
            if (!enCours) {
              setModaleVersement(null);
              setVLot(false);
            }
          }}
        >
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>
              {vLot
                ? `Marquer tout ${MOIS_LIBELLE[mois - 1]} ${annee} versé`
                : `Versement — ${modaleVersement?.personnel.nom} ${modaleVersement?.personnel.prenom ?? ''}`}
            </h3>
            {!vLot && modaleVersement && (
              <p>
                Net à payer :{' '}
                <strong style={{ color: '#1c6b3c' }}>{XAF(modaleVersement.net)}</strong>
              </p>
            )}
            {vLot && (
              <p className="muted">
                Tous les bulletins non versés du mois seront marqués payés.
              </p>
            )}
            <div className="form">
              <div className="row">
                <div className="field">
                  <label>Mode</label>
                  <select value={vMode} onChange={(e) => setVMode(e.target.value as typeof vMode)}>
                    <option value="virement">Virement</option>
                    <option value="momo">Mobile Money</option>
                    <option value="especes">Espèces</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={vDate} onChange={(e) => setVDate(e.target.value)} />
                </div>
              </div>
              {mErreur && <p className="error">{mErreur}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => {
                    setModaleVersement(null);
                    setVLot(false);
                  }}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  style={{ background: '#166534', color: '#fff', border: 'none' }}
                  onClick={validerVersement}
                >
                  {enCours ? 'Enregistrement…' : 'Confirmer le versement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {aSupprimer && (
        <div style={MODALE} onClick={() => !enCours && setASupprimer(null)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Supprimer ce bulletin ?</h3>
            <p>
              {aSupprimer.personnel.nom} {aSupprimer.personnel.prenom ?? ''} —{' '}
              {MOIS_LIBELLE[aSupprimer.mois - 1]} {aSupprimer.annee}, net {XAF(aSupprimer.net)}
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

      {apercu && (
        <div style={MODALE} onClick={() => setApercu(null)}>
          <div
            style={{ ...CARTE_MODALE, maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0, flex: 1 }}>Bulletin — {apercu.titre}</h3>
              <button type="button" onClick={() => setApercu(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => imprimerHtml(apercu.html)}
              >
                Imprimer
              </button>
            </div>
            <iframe
              title="Aperçu du bulletin"
              srcDoc={apercu.html}
              style={{
                width: '100%',
                height: '72vh',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                background: '#fff',
              }}
            />
          </div>
        </div>
      )}

      {modaleParams && (
        <div style={MODALE} onClick={() => !enCours && setModaleParams(false)}>
          <div style={{ ...CARTE_MODALE, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Paramètres de paie</h3>
            <div className="form">
              <div className="row">
                <div className="field">
                  <label>CNPS salariale (%)</label>
                  <input type="number" step="0.1" min={0} value={pCnps} onChange={(e) => setPCnps(e.target.value)} />
                </div>
                <div className="field">
                  <label>Plafond CNPS (XAF)</label>
                  <input type="number" min={0} value={pPlafond} onChange={(e) => setPPlafond(e.target.value)} />
                </div>
              </div>
              <div className="row">
                <div className="field">
                  <label>Abattement frais pro (%)</label>
                  <input type="number" min={0} max={100} value={pAbattement} onChange={(e) => setPAbattement(e.target.value)} />
                </div>
                <div className="field">
                  <label>CAC sur IRPP (%)</label>
                  <input type="number" min={0} max={100} value={pCac} onChange={(e) => setPCac(e.target.value)} />
                </div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                Barème IRPP (tranches ANNUELLES, dernière borne vide = sans limite)
              </label>
              {pTranches.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    min={0}
                    placeholder="De"
                    value={t.borneMin}
                    onChange={(e) =>
                      setPTranches(pTranches.map((x, j) => (j === i ? { ...x, borneMin: e.target.value } : x)))
                    }
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="À (vide = ∞)"
                    value={t.borneMax}
                    onChange={(e) =>
                      setPTranches(pTranches.map((x, j) => (j === i ? { ...x, borneMax: e.target.value } : x)))
                    }
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    placeholder="%"
                    value={t.taux}
                    onChange={(e) =>
                      setPTranches(pTranches.map((x, j) => (j === i ? { ...x, taux: e.target.value } : x)))
                    }
                    style={{ width: 80 }}
                  />
                  <button
                    type="button"
                    onClick={() => setPTranches(pTranches.filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9c2f2f' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setPTranches([...pTranches, { borneMin: '', borneMax: '', taux: '' }])}
                style={{ alignSelf: 'flex-start' }}
              >
                + Ajouter une tranche
              </button>
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
