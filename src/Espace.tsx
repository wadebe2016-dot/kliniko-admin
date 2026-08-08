import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  getMonApercu,
  getMesConges,
  creerMaDemandeConge,
  getMesBulletins,
  type MonApercu,
  type MesConges,
  type BulletinPaie,
  type Utilisateur,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

const MOIS_LIBELLE = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MODE_LIBELLE: Record<string, string> = {
  virement: 'Virement', momo: 'Mobile Money', especes: 'Espèces',
};
const TYPE_CONGE: Record<string, string> = {
  annuel: 'Congé annuel', maladie: 'Maladie', maternite: 'Maternité',
  exceptionnel: 'Exceptionnel', sans_solde: 'Sans solde',
};
const STATUT_CONGE: Record<string, string> = {
  en_attente: 'En attente', approuve: 'Approuvé', refuse: 'Refusé',
};
const STATUT_STYLE: Record<string, { background: string; color: string }> = {
  en_attente: { background: '#fdf3e2', color: '#b7791f' },
  approuve: { background: '#e6f4ec', color: '#1c6b3c' },
  refuse: { background: '#fdece7', color: '#8c3520' },
};

const MODALE = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16, overflowY: 'auto',
} as const;
const CARTE_MODALE = {
  background: '#fff', borderRadius: 14, padding: 24, width: '100%',
  maxWidth: 480, boxShadow: '0 10px 40px rgba(0,0,0,.2)',
} as const;

type CliniquePublique = { nom: string; ville: string | null; telephone: string | null };

async function cliniquePublique(): Promise<CliniquePublique | null> {
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
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function gabaritBulletin(b: BulletinPaie, clinique: CliniquePublique | null, qr: string): string {
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
    ...(b.autresRetenues > 0 ? [ligne('Autres retenues', null, b.autresRetenues)] : []),
  ].join('');
  const info = (libelle: string, valeur: string | null | undefined) =>
    `<div class="cellule"><span class="etiquette">${libelle}</span><span class="valeur">${echapper(valeur || '—')}</span></div>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Bulletin de paie ${echapper(nomComplet)} — ${MOIS_LIBELLE[b.mois - 1]} ${b.annee}</title>
<style>
@page { size: A4; margin: 16mm; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1c2733; font-size: 13px; margin: 0; }
.entete { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1d4f91; padding-bottom: 10px; }
.clinique { font-size: 17px; font-weight: 700; color: #1d4f91; }
.muted { color: #5b6572; font-size: 12px; }
h1 { font-size: 16px; text-align: center; margin: 14px 0 2px; letter-spacing: 1.5px; }
.periode { text-align: center; color: #5b6572; margin-bottom: 12px; }
.employe { background: #f4f7fa; border: 1px solid #dde4ec; border-radius: 8px; padding: 12px 16px; margin-bottom: 14px; }
.employe .nom { font-size: 15px; font-weight: 700; margin-bottom: 8px; }
.grille { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px 18px; }
.cellule { font-size: 12px; }
.etiquette { display: block; color: #8a94a1; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
.valeur { font-weight: 600; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 11px; text-transform: uppercase; color: #5b6572; border-bottom: 2px solid #1d4f91; padding: 6px 8px; }
th.m, td.m { text-align: right; white-space: nowrap; }
td { padding: 7px 8px; border-bottom: 1px solid #e8ecef; }
.totaux td { font-weight: 700; border-top: 2px solid #1d4f91; border-bottom: none; }
.bas { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 16px; }
.verif { text-align: center; }
.verif img { width: 84px; height: 84px; }
.verif .note { font-size: 9px; color: #8a94a1; margin-top: 2px; }
.net-bloc { text-align: right; }
.net-bloc .montant { font-size: 21px; font-weight: 800; color: #166534; }
.versement { margin-top: 4px; color: #5b6572; font-size: 12px; }
.signatures { display: flex; justify-content: space-between; margin-top: 34px; font-size: 12px; color: #5b6572; }
.signatures div { width: 40%; border-top: 1px solid #9aa5b1; padding-top: 6px; text-align: center; }
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
  <div class="nom">${echapper(nomComplet)}</div>
  <div class="grille">
    ${info('Matricule', b.personnel.matricule)}
    ${info('Poste occupé', b.personnel.fonction)}
    ${info('Service', b.personnel.service)}
    ${info("Date d'embauche", b.personnel.dateEmbauche ? jour(b.personnel.dateEmbauche) : null)}
    ${info('Type de contrat', b.personnel.typeContrat)}
    ${info('Situation matrimoniale', b.personnel.situationFamille)}
    ${info('N° CNPS', b.personnel.numeroCnps)}
    ${info('NIU', b.personnel.niu)}
  </div>
</div>
<table>
  <thead><tr><th>Rubrique</th><th class="m">Gains</th><th class="m">Retenues</th></tr></thead>
  <tbody>
    ${lignes}
    <tr class="totaux"><td>Totaux</td><td class="m">${XAF(b.brut)}</td><td class="m">${XAF(totalRetenues)}</td></tr>
  </tbody>
</table>
<div class="bas">
  ${qr ? `<div class="verif"><img src="${qr}" alt="Code QR"><div class="note">Scannez pour vérifier<br>l'authenticité de ce bulletin</div></div>` : '<div></div>'}
  <div class="net-bloc">
    Net à payer : <span class="montant">${XAF(b.net)}</span>
    <div class="versement">${
      b.statutVersement === 'paye'
        ? `Versé le ${jour(b.dateVersement)}${b.modeVersement ? ' par ' + (MODE_LIBELLE[b.modeVersement] ?? b.modeVersement).toLowerCase() : ''}`
        : 'Versement en attente'
    }</div>
  </div>
</div>
<div class="signatures">
  <div>L'employeur</div>
  <div>L'employé(e)</div>
</div>
</body></html>`;
}

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

function joursOuvrables(debut: string, fin: string): number {
  if (!debut || !fin) return 0;
  const d1 = new Date(debut + 'T00:00:00Z');
  const d2 = new Date(fin + 'T00:00:00Z');
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime()) || d2 < d1) return 0;
  let n = 0;
  const cur = new Date(d1);
  while (cur <= d2) {
    const j = cur.getUTCDay();
    if (j !== 0 && j !== 6) n++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return n;
}

export default function Espace({
  onSessionExpiree,
  utilisateur,
}: {
  onSessionExpiree: () => void;
  utilisateur: Utilisateur;
}) {
  const [apercu, setApercu] = useState<MonApercu | null>(null);
  const [conges, setConges] = useState<MesConges | null>(null);
  const [bulletins, setBulletins] = useState<BulletinPaie[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const [modaleDemande, setModaleDemande] = useState(false);
  const [dType, setDType] = useState('annuel');
  const [dDebut, setDDebut] = useState('');
  const [dFin, setDFin] = useState('');
  const [dMotif, setDMotif] = useState('');
  const [mErreur, setMErreur] = useState<string | null>(null);
  const [apercuBulletin, setApercuBulletin] = useState<{ html: string; titre: string } | null>(null);

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
      const a = await getMonApercu();
      setApercu(a);
      if (a.lie) {
        const [c, b] = await Promise.all([getMesConges(), getMesBulletins()]);
        setConges(c);
        setBulletins(b);
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

  async function validerDemande() {
    if (!dDebut || !dFin) {
      setMErreur('Choisissez les deux dates.');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await creerMaDemandeConge({
        type: dType,
        dateDebut: dDebut,
        dateFin: dFin,
        motif: dMotif.trim() || undefined,
      });
      setModaleDemande(false);
      setInfo('Demande envoyée — elle sera examinée par la RH.');
      await charger();
    } catch (e) {
      setMErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function ouvrirBulletin(b: BulletinPaie) {
    const clinique = await cliniquePublique();
    let qr = '';
    try {
      qr = await QRCode.toDataURL(
        `${window.location.origin}/api/public/bulletins/${b.id}`,
        { margin: 0, width: 240 },
      );
    } catch {
      qr = '';
    }
    setApercuBulletin({
      html: gabaritBulletin(b, clinique, qr),
      titre: `${MOIS_LIBELLE[b.mois - 1]} ${b.annee}`,
    });
  }

  const heure = new Date().getHours();
  const salutation = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir';
  const dateFr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const apercuJours = joursOuvrables(dDebut, dFin);

  if (chargement) return <p className="muted">Chargement…</p>;

  return (
    <>
      <section
        className="card"
        style={{ background: '#1d4f91', color: '#fff', marginBottom: 16 }}
      >
        <h2 style={{ margin: 0, color: '#fff', fontSize: 22 }}>
          {salutation}, {utilisateur.prenom} 👋
        </h2>
        <p style={{ margin: '6px 0 8px', opacity: 0.9 }}>
          Bienvenue dans votre espace de travail — tout ce qui vous concerne est
          réuni ici.
        </p>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
          {dateFr.charAt(0).toUpperCase() + dateFr.slice(1)}
          {apercu?.lie && apercu.personnel
            ? ` · ${apercu.personnel.fonction ?? ''}${apercu.personnel.service ? ' · ' + apercu.personnel.service : ''}${apercu.personnel.matricule ? ' · ' + apercu.personnel.matricule : ''}`
            : ''}
        </p>
      </section>

      {erreur && <p className="error">{erreur}</p>}
      {info && <p className="muted">{info}</p>}

      {apercu && !apercu.lie && (
        <section className="card">
          <h2>Compte non relié</h2>
          <p className="muted">
            Aucune fiche personnel n'est reliée à votre compte. Demandez à
            l'administrateur de renseigner votre adresse email (
            {(utilisateur as { email?: string }).email ?? 'celle de votre compte'}
            ) dans votre fiche du module Personnel — le lien se fera
            automatiquement.
          </p>
        </section>
      )}

      {apercu?.lie && conges && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <section className="card" style={{ margin: 0 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Congés restants
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#1c6b3c' }}>
                {conges.solde.restant} <span style={{ fontSize: 13, fontWeight: 400, color: '#8a94a1' }}>jours</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {conges.solde.pris} pris / {conges.solde.acquis} acquis en {conges.solde.annee}
              </div>
            </section>
            <section className="card" style={{ margin: 0 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Demandes en attente
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: apercu.conges && apercu.conges.enAttente > 0 ? '#b7791f' : '#1c2733' }}>
                {apercu.conges?.enAttente ?? 0}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>examinées par la RH</div>
            </section>
            <section className="card" style={{ margin: 0 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Bulletins de paie
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{apercu.bulletins?.nb ?? 0}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {apercu.bulletins?.dernier
                  ? `Dernier : ${MOIS_LIBELLE[apercu.bulletins.dernier.mois - 1]} ${apercu.bulletins.dernier.annee}`
                  : 'Aucun pour le moment'}
              </div>
            </section>
            <section className="card" style={{ margin: 0 }}>
              <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase' }}>
                Dans l'établissement depuis
              </div>
              <div style={{ fontSize: 26, fontWeight: 800 }}>
                {apercu.personnel?.dateEmbauche
                  ? `${Math.max(0, Math.floor((Date.now() - new Date(apercu.personnel.dateEmbauche).getTime()) / (365.25 * 86400000)))} an(s)`
                  : '—'}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                {apercu.personnel?.dateEmbauche
                  ? `embauché(e) le ${jour(apercu.personnel.dateEmbauche)}`
                  : "date d'embauche non renseignée"}
              </div>
            </section>
          </div>

          <section className="card list-card">
            <div className="list-header">
              <h2>Mes congés</h2>
              <span className="count">{conges.demandes.length}</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn-primary" onClick={() => {
                setDType('annuel');
                setDDebut('');
                setDFin('');
                setDMotif('');
                setMErreur(null);
                setModaleDemande(true);
              }}>
                + Demander un congé
              </button>
            </div>
            {conges.demandes.length === 0 && <p className="muted">Aucune demande pour le moment.</p>}
            {conges.demandes.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Du</th>
                    <th>Au</th>
                    <th>Jours ouvr.</th>
                    <th>Motif</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {conges.demandes.map((d) => (
                    <tr key={d.id}>
                      <td>{TYPE_CONGE[d.type] ?? d.type}</td>
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
                          {STATUT_CONGE[d.statut] ?? d.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card list-card">
            <div className="list-header">
              <h2>Mes bulletins de paie</h2>
              <span className="count">{bulletins.length}</span>
            </div>
            {bulletins.length === 0 && <p className="muted">Aucun bulletin pour le moment.</p>}
            {bulletins.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>Période</th>
                    <th>Brut</th>
                    <th>Net</th>
                    <th>Versement</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {MOIS_LIBELLE[b.mois - 1]} {b.annee}
                      </td>
                      <td className="mono">{XAF(b.brut)}</td>
                      <td className="mono" style={{ fontWeight: 700, color: '#1c6b3c' }}>{XAF(b.net)}</td>
                      <td>
                        {b.statutVersement === 'paye' ? (
                          <span className="badge-app" style={{ background: '#e6f4ec', color: '#1c6b3c' }}>
                            Payé le {jour(b.dateVersement)}
                          </span>
                        ) : (
                          <span className="badge-app" style={{ background: '#fdf3e2', color: '#b7791f' }}>
                            En attente
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          title="Aperçu / imprimer"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                          onClick={() => ouvrirBulletin(b)}
                        >
                          🖨
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {modaleDemande && (
        <div style={MODALE} onClick={() => !enCours && setModaleDemande(false)}>
          <div style={CARTE_MODALE} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Demander un congé</h3>
            <div className="form">
              <div className="field">
                <label>Type</label>
                <select value={dType} onChange={(e) => setDType(e.target.value)}>
                  {Object.entries(TYPE_CONGE).map(([cle, lib]) => (
                    <option key={cle} value={cle}>{lib}</option>
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
                  {apercuJours} jour{apercuJours > 1 ? 's' : ''} ouvrable{apercuJours > 1 ? 's' : ''}
                  {dType === 'annuel' && conges ? ` — solde restant : ${conges.solde.restant}` : ''}
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
                  {enCours ? 'Envoi…' : 'Envoyer la demande'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {apercuBulletin && (
        <div style={MODALE} onClick={() => setApercuBulletin(null)}>
          <div style={{ ...CARTE_MODALE, maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <h3 style={{ margin: 0, flex: 1 }}>Bulletin — {apercuBulletin.titre}</h3>
              <button type="button" onClick={() => setApercuBulletin(null)}>Fermer</button>
              <button type="button" className="btn-primary" onClick={() => imprimerHtml(apercuBulletin.html)}>
                Imprimer
              </button>
            </div>
            <iframe
              title="Aperçu du bulletin"
              srcDoc={apercuBulletin.html}
              style={{ width: '100%', height: '72vh', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}
            />
          </div>
        </div>
      )}
    </>
  );
}
