import { useEffect, useState } from 'react';
import {
  getPatients,
  listerMedicaments,
  listerOrdonnances,
  creerOrdonnance,
  validerOrdonnance,
  annulerOrdonnance,
  aPermission,
  type Patient,
  type Medicament,
  type Ordonnance,
  type LigneOrdonnance,
} from './api';
import QRCode from 'qrcode';

const LIGNE_VIDE = {
  medicamentId: '',
  libelle: '',
  posologie: '',
  duree: '',
  quantite: '',
  voie: '',
  instructions: '',
};

function echapper(t: string | null | undefined): string {
  return (t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function jour(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
}

function libelleStatut(s: Ordonnance['statut']): string {
  return s === 'brouillon' ? 'Brouillon' : s === 'validee' ? 'Signée' : 'Annulée';
}

// Le gabarit d'impression : une page A4 autonome, avec le code QR de
// verification publique. Rendu dans la modale d'apercu, puis imprime
// via un cadre invisible (les bloqueurs de fenetres ne s'y opposent pas).
function gabaritOrdonnance(o: Ordonnance, qr: string): string {
  const patient = `${o.patient.nom} ${o.patient.prenom ?? ''}`.trim();
  const age = o.patient.dateNaissance
    ? Math.floor(
        (Date.now() - new Date(o.patient.dateNaissance).getTime()) / 31557600000,
      )
    : null;
  const praticien = o.praticien
    ? `${o.praticien.prenom ?? ''} ${o.praticien.nom}`.trim()
    : '';

  const bandeau =
    o.statut === 'brouillon'
      ? '<div class="bandeau">BROUILLON — NON SIGNÉE</div>'
      : o.statut === 'annulee'
        ? '<div class="bandeau">ORDONNANCE ANNULÉE</div>'
        : '';

  const sousPatient = [
    `Dossier ${echapper(o.patient.numeroDossier)}`,
    age !== null ? `${age} ans` : '',
    o.patient.sexe ? (o.patient.sexe === 'M' ? 'Masculin' : 'Féminin') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const lignes = o.lignes
    .map(
      (l, n) => `
      <div class="ligne">
        <div class="num">${n + 1}</div>
        <div class="corps">
          <div class="med">${echapper(l.libelle)}</div>
          <div class="pos">${echapper(l.posologie)}</div>
          <div class="det">${[
            l.duree ? `Durée : ${echapper(l.duree)}` : '',
            l.quantite ? `Quantité : ${echapper(l.quantite)}` : '',
            l.voie ? `Voie : ${echapper(l.voie)}` : '',
          ]
            .filter(Boolean)
            .join('&ensp;·&ensp;')}</div>
          ${l.instructions ? `<div class="det">${echapper(l.instructions)}</div>` : ''}
        </div>
      </div>`,
    )
    .join('');

  const lieuDate = o.hopital.ville
    ? `Fait à ${echapper(o.hopital.ville)}, le ${jour(o.dateOrdonnance)}`
    : `Le ${jour(o.dateOrdonnance)}`;

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(o.numero)}</title>
<style>
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #1c2430;
         font-size: 10.5pt; padding: 16px; }
  @media print { body { padding: 0; } }
  .entete { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
  .clinique h1 { font-size: 19pt; color: #0f766e; letter-spacing: 0.5px; }
  .clinique p { color: #5b6572; font-size: 9.5pt; margin-top: 4px; }
  .cartouche { border: 1.5px solid #0f766e; border-radius: 8px; padding: 8px 14px;
               text-align: right; flex: none; }
  .cartouche .no { font-weight: 700; color: #0f766e; font-size: 11pt; white-space: nowrap; }
  .cartouche .dt { color: #5b6572; font-size: 9.5pt; margin-top: 2px; }
  .bandeau { text-align: center; color: #b91c1c; border: 2px dashed #b91c1c; border-radius: 6px;
             padding: 6px; letter-spacing: 2px; font-weight: 700; margin-top: 14px; }
  .titre { display: flex; align-items: center; gap: 14px; margin: 20px 0 16px;
           font-size: 12.5pt; letter-spacing: 4px; font-weight: 600; }
  .titre::before, .titre::after { content: ''; flex: 1; border-top: 1px solid #cbd5e1; }
  .identites { display: flex; gap: 12px; margin-bottom: 18px; }
  .boite { flex: 1; background: #f4f7f6; border: 1px solid #e2e8f0; border-radius: 8px;
           padding: 10px 14px; }
  .boite .lab { font-size: 8pt; letter-spacing: 2px; color: #0f766e; font-weight: 700;
                margin-bottom: 4px; }
  .boite .nom { font-weight: 700; font-size: 11.5pt; }
  .boite .sub { color: #5b6572; font-size: 9.5pt; margin-top: 2px; }
  .ligne { display: flex; gap: 12px; padding: 10px 2px; border-bottom: 1px dashed #d7dee6; }
  .lignes .ligne:last-child { border-bottom: none; }
  .num { width: 22px; height: 22px; border-radius: 50%; background: #0f766e; color: #fff;
         font-size: 10pt; font-weight: 700; display: flex; align-items: center;
         justify-content: center; flex: none; margin-top: 2px; }
  .med { font-weight: 700; font-size: 11.5pt; }
  .pos { font-size: 10.5pt; margin-top: 2px; }
  .det { font-size: 9.5pt; color: #5b6572; margin-top: 2px; }
  .notes { margin-top: 14px; font-style: italic; color: #374151; border-left: 3px solid #0f766e;
           background: #f8fafc; padding: 7px 12px; font-size: 10pt; border-radius: 0 6px 6px 0; }
  .final { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
  .lieu { font-size: 10pt; color: #374151; }
  .verif { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .verif img { width: 22mm; height: 22mm; }
  .verif .note { font-size: 8pt; color: #8a94a1; line-height: 1.5; }
  .signature { text-align: center; font-size: 10pt; }
  .cadre-sign { border: 1px solid #cbd5e1; border-radius: 8px; width: 68mm; height: 30mm;
                margin-top: 6px; position: relative; }
  .cadre-sign span { position: absolute; bottom: 4px; left: 0; right: 0; font-size: 8pt;
                     color: #94a3b8; }
  .pied { border-top: 1px solid #e2e8f0; margin-top: 22px; padding-top: 6px;
          font-size: 8.5pt; color: #8a94a1; text-align: center; }
</style></head><body>
<header class="entete">
  <div class="clinique">
    <h1>${echapper(o.hopital.nom)}</h1>
    <p>${[echapper(o.hopital.ville), echapper(o.hopital.telephone)].filter(Boolean).join(' — ')}</p>
  </div>
  <div class="cartouche">
    <div class="no">N° ${echapper(o.numero)}</div>
    <div class="dt">${jour(o.dateOrdonnance)}</div>
  </div>
</header>
${bandeau}
<div class="titre">ORDONNANCE MÉDICALE</div>
<div class="identites">
  <div class="boite">
    <div class="lab">PATIENT</div>
    <div class="nom">${echapper(patient)}</div>
    <div class="sub">${sousPatient}</div>
  </div>
  <div class="boite">
    <div class="lab">PRESCRIPTEUR</div>
    <div class="nom">${praticien ? echapper(praticien) : '—'}</div>
    ${o.praticien?.specialite ? `<div class="sub">${echapper(o.praticien.specialite)}</div>` : ''}
  </div>
</div>
<div class="lignes">${lignes}</div>
${o.notes ? `<div class="notes">${echapper(o.notes)}</div>` : ''}
<div class="final">
  <div>
    <div class="lieu">${lieuDate}</div>
    ${qr ? `<div class="verif"><img src="${qr}" alt="Code QR de vérification"><div class="note">Scannez pour vérifier<br>l'authenticité de<br>cette ordonnance</div></div>` : ''}
  </div>
  <div class="signature">
    <b>${praticien ? echapper(praticien) : ''}</b>
    <div class="cadre-sign"><span>Signature et cachet</span></div>
  </div>
</div>
<div class="pied">Ordonnance ${echapper(o.numero)} — ${echapper(o.hopital.nom)}</div>
</body></html>`;
}

// Impression par cadre invisible
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

export default function Ordonnances({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medicaments, setMedicaments] = useState<Medicament[]>([]);
  const [ordonnances, setOrdonnances] = useState<Ordonnance[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [patientId, setPatientId] = useState('');
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<LigneOrdonnance[]>([]);
  const [saisie, setSaisie] = useState({ ...LIGNE_VIDE });
  const [enCours, setEnCours] = useState(false);
  const [selection, setSelection] = useState<Ordonnance | null>(null);
  const [apercu, setApercu] = useState<{ numero: string; html: string } | null>(null);

  const peutRediger = aPermission('ordonnance.creer');

  async function ouvrirApercu(o: Ordonnance) {
    let qr = '';
    try {
      qr = await QRCode.toDataURL(
        `${window.location.origin}/api/public/ordonnances/${o.id}`,
        { margin: 0, width: 240 },
      );
    } catch (e) {
      // L'apercu reste possible sans QR ; la console dira pourquoi
      console.error('Generation du code QR impossible', e);
    }
    setApercu({ numero: o.numero, html: gabaritOrdonnance(o, qr) });
  }

  function traiter(e: unknown) {
    const message = (e as Error).message;
    if (message.includes('reconnecter')) onSessionExpiree();
    else setErreur(message);
  }

  async function charger() {
    try {
      setChargement(true);
      const [p, m, o] = await Promise.all([
        getPatients(),
        listerMedicaments(),
        listerOrdonnances(),
      ]);
      setPatients(p);
      setMedicaments(m);
      setOrdonnances(o);
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choisirMedicament(id: string) {
    const m = medicaments.find((x) => x.id === id);
    setSaisie((s) => ({
      ...s,
      medicamentId: id,
      libelle: m
        ? [m.denomination, m.dosage, m.forme].filter(Boolean).join(' ')
        : s.libelle,
    }));
  }

  function ajouterLigne() {
    if (!saisie.libelle.trim() || !saisie.posologie.trim()) {
      setErreur('Le médicament et la posologie sont obligatoires');
      return;
    }
    setErreur(null);
    setLignes((l) => [
      ...l,
      {
        medicamentId: saisie.medicamentId || null,
        libelle: saisie.libelle.trim(),
        posologie: saisie.posologie.trim(),
        duree: saisie.duree.trim() || null,
        quantite: saisie.quantite.trim() || null,
        voie: saisie.voie.trim() || null,
        instructions: saisie.instructions.trim() || null,
      },
    ]);
    setSaisie({ ...LIGNE_VIDE });
  }

  async function enregistrer(signer: boolean) {
    if (!patientId) {
      setErreur('Choisissez un patient');
      return;
    }
    if (lignes.length === 0) {
      setErreur('Ajoutez au moins un médicament');
      return;
    }
    setEnCours(true);
    setErreur(null);
    try {
      const creee = await creerOrdonnance({
        patientId,
        notes: notes.trim() || undefined,
        valider: signer,
        lignes,
      });
      setPatientId('');
      setNotes('');
      setLignes([]);
      setSaisie({ ...LIGNE_VIDE });
      setSelection(creee);
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function signer(o: Ordonnance) {
    setEnCours(true);
    try {
      const maj = await validerOrdonnance(o.id);
      setSelection(maj);
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function annuler(o: Ordonnance) {
    const motif = window.prompt("Motif de l'annulation (facultatif)") ?? undefined;
    setEnCours(true);
    try {
      const maj = await annulerOrdonnance(o.id, motif);
      setSelection(maj);
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      {peutRediger && (
        <section className="card form-card">
          <h2>Nouvelle ordonnance</h2>
          <div className="form">
            <div className="field">
              <label>Patient</label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="">Choisir un patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName} {p.firstName} ({p.recordNumber})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Médicament</label>
              <select
                value={saisie.medicamentId}
                onChange={(e) => choisirMedicament(e.target.value)}
              >
                <option value="">Hors catalogue (saisie libre)</option>
                {medicaments.map((m) => (
                  <option key={m.id} value={m.id}>
                    {[m.denomination, m.dosage, m.forme].filter(Boolean).join(' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Libellé prescrit</label>
              <input
                value={saisie.libelle}
                onChange={(e) => setSaisie({ ...saisie, libelle: e.target.value })}
                placeholder="Paracétamol 500 mg comprimé"
              />
            </div>

            <div className="field">
              <label>Posologie</label>
              <input
                value={saisie.posologie}
                onChange={(e) => setSaisie({ ...saisie, posologie: e.target.value })}
                placeholder="1 comprimé 3 fois par jour"
              />
            </div>

            <div className="row">
              <div className="field">
                <label>Durée</label>
                <input
                  value={saisie.duree}
                  onChange={(e) => setSaisie({ ...saisie, duree: e.target.value })}
                  placeholder="5 jours"
                />
              </div>
              <div className="field">
                <label>Quantité</label>
                <input
                  value={saisie.quantite}
                  onChange={(e) => setSaisie({ ...saisie, quantite: e.target.value })}
                  placeholder="15 comprimés"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label>Voie</label>
                <input
                  value={saisie.voie}
                  onChange={(e) => setSaisie({ ...saisie, voie: e.target.value })}
                  placeholder="Orale"
                />
              </div>
              <div className="field">
                <label>Instructions</label>
                <input
                  value={saisie.instructions}
                  onChange={(e) =>
                    setSaisie({ ...saisie, instructions: e.target.value })
                  }
                  placeholder="À prendre au cours des repas"
                />
              </div>
            </div>

            <button type="button" onClick={ajouterLigne}>
              Ajouter à l'ordonnance
            </button>

            {lignes.length > 0 && (
              <table className="table" style={{ marginTop: 12 }}>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <strong>{l.libelle}</strong>
                        <br />
                        <span className="muted">
                          {[l.posologie, l.duree, l.quantite]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </td>
                      <td style={{ width: 40 }}>
                        <button
                          type="button"
                          onClick={() =>
                            setLignes(lignes.filter((_, j) => j !== i))
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="field" style={{ marginTop: 12 }}>
              <label>Notes au patient</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Revoir le patient dans une semaine si la fièvre persiste."
              />
            </div>

            {erreur && <p className="error">{erreur}</p>}

            <div className="row">
              <button
                type="button"
                disabled={enCours}
                onClick={() => enregistrer(false)}
              >
                Enregistrer en brouillon
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={enCours}
                onClick={() => enregistrer(true)}
              >
                {enCours ? 'Enregistrement…' : 'Signer et enregistrer'}
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Ordonnances</h2>
          <span className="count">{ordonnances.length}</span>
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!chargement && !peutRediger && erreur && <p className="error">{erreur}</p>}
        {!chargement && ordonnances.length === 0 && (
          <p className="muted">Aucune ordonnance pour le moment.</p>
        )}
        {ordonnances.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Patient</th>
                <th>Date</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ordonnances.map((o) => (
                <tr key={o.id}>
                  <td className="mono">{o.numero}</td>
                  <td>
                    {o.patient.nom} {o.patient.prenom}
                  </td>
                  <td>{jour(o.dateOrdonnance)}</td>
                  <td>{libelleStatut(o.statut)}</td>
                  <td>
                    <button type="button" onClick={() => setSelection(o)}>
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {selection && (
        <section className="card">
          <div className="list-header">
            <h2>
              {selection.numero} — {selection.patient.nom}{' '}
              {selection.patient.prenom}
            </h2>
            <button type="button" onClick={() => setSelection(null)}>
              Fermer
            </button>
          </div>
          <p className="muted">
            {libelleStatut(selection.statut)} · {jour(selection.dateOrdonnance)}
            {selection.praticien
              ? ` · ${selection.praticien.prenom ?? ''} ${selection.praticien.nom}`
              : ''}
            {selection.motifAnnulation
              ? ` · Motif : ${selection.motifAnnulation}`
              : ''}
          </p>
          <ol>
            {selection.lignes.map((l) => (
              <li key={l.id ?? l.libelle} style={{ marginBottom: 10 }}>
                <strong>{l.libelle}</strong>
                <br />
                {l.posologie}
                <br />
                <span className="muted">
                  {[
                    l.duree ? `Durée : ${l.duree}` : '',
                    l.quantite ? `Quantité : ${l.quantite}` : '',
                    l.voie ? `Voie : ${l.voie}` : '',
                    l.instructions,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </li>
            ))}
          </ol>
          {selection.notes && <p>{selection.notes}</p>}
          <div className="row">
            <button type="button" onClick={() => ouvrirApercu(selection)}>
              Aperçu / Imprimer
            </button>
            {peutRediger && selection.statut === 'brouillon' && (
              <button
                type="button"
                className="btn-primary"
                disabled={enCours}
                onClick={() => signer(selection)}
              >
                Signer
              </button>
            )}
            {peutRediger && selection.statut !== 'annulee' && (
              <button
                type="button"
                disabled={enCours}
                onClick={() => annuler(selection)}
              >
                Annuler l'ordonnance
              </button>
            )}
          </div>
        </section>
      )}

      {apercu && (
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
          onClick={() => setApercu(null)}
        >
          <div
            className="card"
            style={{
              width: 'min(820px, 96vw)',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ marginRight: 'auto' }}>
                Ordonnance {apercu.numero}
              </h2>
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
              title="Aperçu de l'ordonnance"
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
    </>
  );
}