import { useEffect, useState } from 'react';
import {
  aPermission,
  createFacture,
  demanderPaiementMobile,
  encaisserFacture,
  getActes,
  getFacture,
  getFactures,
  getPatients,
  verifierPaiementMobile,
  type Acte,
  type DemandePaiementMobile,
  type Facture,
  type Patient,
  type StatutFacture,
} from './api';
import QRCode from 'qrcode';

const STATUT_LABEL: Record<StatutFacture, string> = {
  ouverte: 'Ouverte',
  partielle: 'Partielle',
  reglee: 'Réglée',
  annulee: 'Annulée',
};

const STATUT_FOND: Record<StatutFacture, string> = {
  ouverte: '#e2ecfb',
  partielle: '#f6e7c9',
  reglee: '#c5e8d2',
  annulee: '#f8d9dc',
};

const fmt = (n: string | number) => Number(n).toLocaleString('fr-FR');

// Les paiements portent des champs Campay que le type de base ne declare pas
type PaiementAffiche = {
  id: string;
  montant: string | number;
  moyen: 'especes' | 'mobile_money';
  datePaiement: string;
  campayStatut?: string | null;
};

const LIBELLE_STATUT_CAMPAY: Record<string, string> = {
  PENDING: 'en attente',
  INITIE: 'en attente',
  SUCCESSFUL: 'confirmé',
  FAILED: 'échoué',
};

function echapper(t: string | null | undefined): string {
  return (t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// La clinique affichee en tete du recu. La surface publique la fournit ;
// tant que Kliniko sert une clinique a la fois, la premiere est la bonne.
type CliniquePublique = {
  id: string;
  nom: string;
  ville: string | null;
  telephone: string | null;
};

async function cliniqueDuRecu(): Promise<CliniquePublique | null> {
  try {
    const res = await fetch('/api/public/cliniques');
    if (!res.ok) return null;
    const liste = (await res.json()) as CliniquePublique[];
    return liste[0] ?? null;
  } catch {
    return null;
  }
}

// Le recu de caisse : une page compacte, verifiable par code QR.
function gabaritRecu(
  f: Facture,
  clinique: CliniquePublique | null,
  qr: string,
): string {
  const infos = f as unknown as { dateFacture?: string; createdAt?: string };
  const date = new Date(
    infos.dateFacture ?? infos.createdAt ?? Date.now(),
  ).toLocaleDateString('fr-FR');
  const patient = `${f.patient.nom} ${f.patient.prenom ?? ''}`.trim();
  const reste = Number(f.montantTotal) - Number(f.montantPaye);
  const paiements = (f.paiements ?? []) as unknown as PaiementAffiche[];

  const lignes = (f.lignes ?? [])
    .map(
      (l) => `
      <tr>
        <td>${echapper(l.libelle)}</td>
        <td class="mono centre">${l.quantite}</td>
        <td class="mono droite">${fmt(l.prixUnitaire)}</td>
        <td class="mono droite">${fmt(l.montant)}</td>
      </tr>`,
    )
    .join('');

  const listePaiements = paiements
    .filter((p) => !p.campayStatut || p.campayStatut === 'SUCCESSFUL')
    .map(
      (p) => `
      <tr>
        <td>${new Date(p.datePaiement).toLocaleDateString('fr-FR')}</td>
        <td>${p.moyen === 'especes' ? 'Espèces' : 'Mobile Money'}</td>
        <td class="mono droite">${fmt(p.montant)}</td>
      </tr>`,
    )
    .join('');

  const COULEURS: Record<StatutFacture, [string, string]> = {
    ouverte: ['#e2ecfb', '#1d4f91'],
    partielle: ['#fdf3e2', '#b7791f'],
    reglee: ['#e6f4ec', '#1c6b3c'],
    annulee: ['#fdece7', '#b91c1c'],
  };
  const [fond, encre] = COULEURS[f.statut];

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(f.numero)}</title>
<style>
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #1c2430;
         font-size: 10.5pt; padding: 16px; max-width: 640px; }
  @media print { body { padding: 0; } }
  .entete { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
  .clinique h1 { font-size: 17pt; color: #0f766e; }
  .clinique p { color: #5b6572; font-size: 9.5pt; margin-top: 4px; }
  .cartouche { border: 1.5px solid #0f766e; border-radius: 8px; padding: 8px 14px;
               text-align: right; flex: none; }
  .cartouche .no { font-weight: 700; color: #0f766e; font-size: 11pt; white-space: nowrap; }
  .cartouche .dt { color: #5b6572; font-size: 9.5pt; margin-top: 2px; }
  .titre { display: flex; align-items: center; gap: 14px; margin: 18px 0 6px;
           font-size: 12pt; letter-spacing: 4px; font-weight: 600; }
  .titre::before, .titre::after { content: ''; flex: 1; border-top: 1px solid #cbd5e1; }
  .statut { text-align: center; margin-bottom: 14px; }
  .statut span { display: inline-block; background: ${fond}; color: ${encre};
                 border-radius: 999px; padding: 4px 16px; font-weight: 700;
                 letter-spacing: 1px; font-size: 10.5pt; }
  .patient { background: #f4f7f6; border: 1px solid #e2e8f0; border-radius: 8px;
             padding: 8px 14px; margin-bottom: 14px; }
  .patient .lab { font-size: 8pt; letter-spacing: 2px; color: #0f766e; font-weight: 700; }
  .patient .nom { font-weight: 700; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  th { text-align: left; font-size: 8.5pt; letter-spacing: 1px; color: #5b6572;
       border-bottom: 1.5px solid #cbd5e1; padding: 5px 6px; }
  td { padding: 6px; border-bottom: 1px dashed #e2e8f0; font-size: 10pt; }
  .mono { font-variant-numeric: tabular-nums; }
  .droite { text-align: right; }
  .centre { text-align: center; }
  th.droite { text-align: right; }
  .totaux { margin: 10px 0 4px; display: flex; flex-direction: column; align-items: flex-end;
            gap: 3px; font-size: 10.5pt; }
  .totaux .grand { font-size: 12.5pt; font-weight: 700; color: #0f766e; }
  .sous { color: #5b6572; font-size: 9pt; letter-spacing: 1px; margin: 14px 0 4px;
          font-weight: 700; }
  .verif { display: flex; align-items: center; gap: 8px; margin-top: 18px; }
  .verif img { width: 20mm; height: 20mm; }
  .verif .note { font-size: 8pt; color: #8a94a1; line-height: 1.5; }
  .pied { border-top: 1px solid #e2e8f0; margin-top: 16px; padding-top: 6px;
          font-size: 8.5pt; color: #8a94a1; text-align: center; }
</style></head><body>
<header class="entete">
  <div class="clinique">
    <h1>${echapper(clinique?.nom ?? 'Kliniko')}</h1>
    <p>${[echapper(clinique?.ville), echapper(clinique?.telephone)].filter(Boolean).join(' — ')}</p>
  </div>
  <div class="cartouche">
    <div class="no">${echapper(f.numero)}</div>
    <div class="dt">${date}</div>
  </div>
</header>
<div class="titre">REÇU DE CAISSE</div>
<div class="statut"><span>${
    { ouverte: 'NON RÉGLÉE', partielle: 'PAIEMENT PARTIEL', reglee: 'RÉGLÉE', annulee: 'ANNULÉE' }[f.statut]
  }</span></div>
<div class="patient">
  <div class="lab">PATIENT</div>
  <div class="nom">${echapper(patient)}</div>
</div>
<table>
  <thead><tr><th>DÉSIGNATION</th><th class="centre">QTÉ</th><th class="droite">P.U.</th><th class="droite">MONTANT</th></tr></thead>
  <tbody>${lignes}</tbody>
</table>
<div class="totaux">
  <div class="grand">Total : ${fmt(f.montantTotal)} ${f.devise}</div>
  <div>Payé : <b>${fmt(f.montantPaye)} ${f.devise}</b></div>
  ${reste > 0 ? `<div>Reste à payer : <b>${fmt(reste)} ${f.devise}</b></div>` : ''}
</div>
${
  listePaiements
    ? `<div class="sous">RÈGLEMENTS</div>
<table>
  <thead><tr><th>DATE</th><th>MOYEN</th><th class="droite">MONTANT</th></tr></thead>
  <tbody>${listePaiements}</tbody>
</table>`
    : ''
}
${qr ? `<div class="verif"><img src="${qr}" alt="Code QR"><div class="note">Scannez pour vérifier<br>l'authenticité de ce reçu</div></div>` : ''}
<div class="pied">${echapper(f.numero)} — ${echapper(clinique?.nom ?? 'Kliniko')} — édité via Kliniko</div>
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

type Props = {
  onSessionExpiree: () => void;
};

function Factures({ onSessionExpiree }: Props) {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [actes, setActes] = useState<Acte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detail, setDetail] = useState<Facture | null>(null);
  const [montant, setMontant] = useState('');
  const [moyen, setMoyen] = useState<'especes' | 'mobile_money'>('especes');
  const [telephone, setTelephone] = useState('');
  const [encaisseError, setEncaisseError] = useState<string | null>(null);
  const [encaissement, setEncaissement] = useState(false);

  // Apercu du recu de caisse
  const [recu, setRecu] = useState<{ numero: string; html: string } | null>(
    null,
  );

  // Paiement Mobile Money en cours de validation par le client
  const [attente, setAttente] = useState<DemandePaiementMobile | null>(null);
  const [messagePaiement, setMessagePaiement] = useState<string | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState(false);

  function gererErreur(e: Error, poserErreur: (m: string) => void) {
    if (e.message.includes('reconnecter')) {
      onSessionExpiree();
    } else {
      poserErreur(e.message);
    }
  }

  async function charger() {
    try {
      setLoading(true);
      const [listeFactures, listePatients, listeActes] = await Promise.all([
        getFactures(),
        getPatients(),
        getActes(),
      ]);
      setFactures(listeFactures);
      setPatients(listePatients);
      setActes(listeActes);
      setError(null);
    } catch (e) {
      gererErreur(e as Error, setError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tant qu un paiement mobile est en attente, on interroge Campay
  // toutes les 5 secondes (2 minutes au maximum).
  useEffect(() => {
    if (!attente) return;
    let annule = false;
    let essais = 0;
    const minuteur = setInterval(async () => {
      essais += 1;
      if (essais > 24) {
        clearInterval(minuteur);
        setMessagePaiement(
          "Toujours sans réponse. Utilise « Vérifier maintenant » quand le client aura validé.",
        );
        return;
      }
      try {
        const v = await verifierPaiementMobile(attente.reference);
        if (annule) return;
        if (v.statutPaiement !== 'PENDING' && v.statutPaiement !== 'INITIE') {
          clearInterval(minuteur);
          setAttente(null);
          setDetail(v.facture);
          setMessagePaiement(
            v.statutPaiement === 'SUCCESSFUL'
              ? 'Paiement confirmé et encaissé.'
              : `Paiement ${LIBELLE_STATUT_CAMPAY[v.statutPaiement] ?? v.statutPaiement}.`,
          );
          await charger();
        }
      } catch {
        // reseau ou service momentanement indisponible : on retentera
      }
    }, 5000);
    return () => {
      annule = true;
      clearInterval(minuteur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attente]);

  const totalEstime = actes.reduce(
    (somme, a) => somme + (quantites[a.id] ?? 0) * (a.tarif ?? 0),
    0,
  );

  async function handleFacturer(e: React.FormEvent) {
    e.preventDefault();
    const lignes = actes
      .filter((a) => (quantites[a.id] ?? 0) > 0)
      .map((a) => ({ acteId: a.id, quantite: quantites[a.id] }));
    if (lignes.length === 0) {
      setFormError('Choisis au moins un acte (quantité supérieure à zéro)');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const facture = await createFacture({ patientId, lignes });
      setPatientId('');
      setQuantites({});
      await charger();
      await ouvrirDetail(facture.id);
    } catch (err) {
      gererErreur(err as Error, setFormError);
    } finally {
      setSubmitting(false);
    }
  }

  async function ouvrirDetail(id: string) {
    try {
      const f = await getFacture(id);
      setDetail(f);
      const reste = Number(f.montantTotal) - Number(f.montantPaye);
      setMontant(reste > 0 ? String(reste) : '');
      setEncaisseError(null);
      setAttente(null);
      setMessagePaiement(null);
    } catch (e) {
      gererErreur(e as Error, setError);
    }
  }

  async function handleEncaisser(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setEncaissement(true);
    setEncaisseError(null);
    setMessagePaiement(null);
    try {
      if (moyen === 'mobile_money') {
        const demande = await demanderPaiementMobile({
          factureId: detail.id,
          montant: Number(montant),
          telephone,
        });
        setAttente(demande);
        setMessagePaiement(
          'Demande envoyée. Le client doit valider sur son téléphone.',
        );
      } else {
        const f = await encaisserFacture(detail.id, {
          montant: Number(montant),
          moyen: 'especes',
        });
        setDetail(f);
        const reste = Number(f.montantTotal) - Number(f.montantPaye);
        setMontant(reste > 0 ? String(reste) : '');
        await charger();
      }
    } catch (err) {
      gererErreur(err as Error, setEncaisseError);
    } finally {
      setEncaissement(false);
    }
  }

  async function verifierMaintenant() {
    if (!attente) return;
    setVerificationEnCours(true);
    setEncaisseError(null);
    try {
      const v = await verifierPaiementMobile(attente.reference);
      setDetail(v.facture);
      if (v.statutPaiement === 'PENDING' || v.statutPaiement === 'INITIE') {
        setMessagePaiement('Toujours en attente de validation par le client.');
      } else {
        setAttente(null);
        setMessagePaiement(
          v.statutPaiement === 'SUCCESSFUL'
            ? 'Paiement confirmé et encaissé.'
            : `Paiement ${LIBELLE_STATUT_CAMPAY[v.statutPaiement] ?? v.statutPaiement}.`,
        );
      }
      await charger();
    } catch (err) {
      gererErreur(err as Error, setEncaisseError);
    } finally {
      setVerificationEnCours(false);
    }
  }

  function abandonner() {
    setAttente(null);
    setMessagePaiement(null);
  }

  async function ouvrirRecu(f: Facture) {
    const clinique = await cliniqueDuRecu();
    let qr = '';
    try {
      qr = await QRCode.toDataURL(
        `${window.location.origin}/api/public/factures/${f.id}`,
        { margin: 0, width: 240 },
      );
    } catch (e) {
      console.error('Generation du code QR impossible', e);
    }
    setRecu({ numero: f.numero, html: gabaritRecu(f, clinique, qr) });
  }

  const resteDetail = detail
    ? Number(detail.montantTotal) - Number(detail.montantPaye)
    : 0;

  const paiements = (detail?.paiements ?? []) as unknown as PaiementAffiche[];

  return (
    <>
      {aPermission('facture.creer') && (
        <section className="card form-card">
          <h2>Nouvelle facture</h2>
          <form onSubmit={handleFacturer} className="form">
            <div className="field">
              <label>Patient</label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                required
              >
                <option value="">Choisir un patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.recordNumber} — {p.lastName} {p.firstName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Actes (indique les quantités)</label>
              {actes.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <input
                    type="number"
                    min={0}
                    value={quantites[a.id] ?? 0}
                    onChange={(e) =>
                      setQuantites({
                        ...quantites,
                        [a.id]: Math.max(0, Number(e.target.value)),
                      })
                    }
                    style={{ width: 64 }}
                  />
                  <span>
                    {a.libelle}{' '}
                    <span className="muted">
                      ({a.tarif !== null ? `${fmt(a.tarif)} ${a.devise}` : 'sans tarif'})
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p>
              Total estimé : <strong>{fmt(totalEstime)} XAF</strong>
            </p>
            {formError && <p className="error">{formError}</p>}
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Facturation…' : 'Facturer'}
            </button>
          </form>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Factures</h2>
          <span className="count">{factures.length}</span>
        </div>
        {loading && <p className="muted">Chargement…</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && factures.length === 0 && (
          <p className="muted">Aucune facture pour le moment.</p>
        )}
        {!loading && !error && factures.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Patient</th>
                <th>Payé / Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id}>
                  <td className="mono">{f.numero}</td>
                  <td>
                    {f.patient.nom} {f.patient.prenom ?? ''}
                  </td>
                  <td className="mono">
                    {fmt(f.montantPaye)} / {fmt(f.montantTotal)} {f.devise}
                  </td>
                  <td>
                    <span
                      style={{
                        background: STATUT_FOND[f.statut],
                        borderRadius: 10,
                        padding: '2px 10px',
                        fontSize: '0.85em',
                      }}
                    >
                      {STATUT_LABEL[f.statut]}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      style={{ padding: '2px 10px', cursor: 'pointer' }}
                      onClick={() => ouvrirDetail(f.id)}
                    >
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {detail && (
        <section className="card list-card">
          <div className="list-header">
            <h2>
              {detail.numero} — {detail.patient.nom}{' '}
              {detail.patient.prenom ?? ''}
            </h2>
            <button
              type="button"
              className="btn-primary"
              style={{
                marginLeft: 'auto',
                padding: '2px 12px',
                cursor: 'pointer',
              }}
              onClick={() => ouvrirRecu(detail)}
            >
              Reçu
            </button>
            <button
              type="button"
              style={{
                padding: '2px 10px',
                cursor: 'pointer',
              }}
              onClick={() => setDetail(null)}
            >
              Fermer
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Acte</th>
                <th>Qté</th>
                <th>P.U.</th>
                <th>Montant</th>
              </tr>
            </thead>
            <tbody>
              {(detail.lignes ?? []).map((l) => (
                <tr key={l.id}>
                  <td>{l.libelle}</td>
                  <td className="mono">{l.quantite}</td>
                  <td className="mono">{fmt(l.prixUnitaire)}</td>
                  <td className="mono">{fmt(l.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Total : <strong>{fmt(detail.montantTotal)} {detail.devise}</strong>
            {' — '}Payé : <strong>{fmt(detail.montantPaye)}</strong>
            {' — '}Reste : <strong>{fmt(resteDetail)}</strong>
          </p>
          {paiements.length > 0 && (
            <p className="muted">
              Paiements :{' '}
              {paiements
                .map((p) => {
                  const moyenLisible =
                    p.moyen === 'especes' ? 'espèces' : 'mobile money';
                  const etat = p.campayStatut
                    ? `, ${LIBELLE_STATUT_CAMPAY[p.campayStatut] ?? p.campayStatut}`
                    : '';
                  return `${fmt(p.montant)} (${moyenLisible}${etat})`;
                })
                .join(' · ')}
            </p>
          )}

          {attente && (
            <div
              style={{
                background: '#f6e7c9',
                borderRadius: 8,
                padding: '0.8rem 1rem',
                marginTop: 8,
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>En attente de validation</strong> — le client doit
                confirmer le paiement sur son téléphone
                {attente.ussdCode ? ` (code ${attente.ussdCode})` : ''}
                {attente.operateur ? `, opérateur ${attente.operateur}` : ''}.
              </p>
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  onClick={verifierMaintenant}
                  disabled={verificationEnCours}
                  style={{
                    padding: '4px 12px',
                    marginRight: 8,
                    cursor: 'pointer',
                  }}
                >
                  {verificationEnCours ? 'Vérification…' : 'Vérifier maintenant'}
                </button>
                <button
                  type="button"
                  onClick={abandonner}
                  style={{ padding: '4px 12px', cursor: 'pointer' }}
                >
                  Masquer
                </button>
              </div>
            </div>
          )}

          {messagePaiement && <p className="muted">{messagePaiement}</p>}

          {aPermission('facture.encaisser') &&
            !attente &&
            detail.statut !== 'reglee' &&
            detail.statut !== 'annulee' && (
              <form
                onSubmit={handleEncaisser}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginTop: 8,
                }}
              >
                <input
                  type="number"
                  min={1}
                  max={resteDetail}
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  required
                  style={{ width: 110 }}
                />
                <select
                  value={moyen}
                  onChange={(e) =>
                    setMoyen(e.target.value as 'especes' | 'mobile_money')
                  }
                >
                  <option value="especes">Espèces</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
                {moyen === 'mobile_money' && (
                  <input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="6XX XXX XXX"
                    required
                    style={{ width: 150 }}
                  />
                )}
                <button
                  type="submit"
                  disabled={encaissement}
                  className="btn-primary"
                  style={{ padding: '6px 16px', margin: 0 }}
                >
                  {encaissement
                    ? 'Envoi…'
                    : moyen === 'mobile_money'
                      ? 'Demander le paiement'
                      : 'Encaisser'}
                </button>
              </form>
            )}
          {encaisseError && <p className="error">{encaisseError}</p>}
        </section>
      )}

      {recu && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(12, 42, 40, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={() => setRecu(null)}
        >
          <div
            className="card"
            style={{
              width: 'min(760px, 96vw)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ marginRight: 'auto' }}>Reçu {recu.numero}</h2>
              <button type="button" onClick={() => setRecu(null)}>
                Fermer
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => imprimerHtml(recu.html)}
              >
                Imprimer
              </button>
            </div>
            <iframe
              title="Aperçu du reçu"
              srcDoc={recu.html}
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
    </>
  );
}

export default Factures;
