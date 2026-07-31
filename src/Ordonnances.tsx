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

// L'impression passe par un cadre invisible plutot que par une fenetre :
// les bloqueurs de fenetres surgissantes ne s'y opposent pas.
function imprimer(o: Ordonnance) {
  const patient = `${o.patient.nom} ${o.patient.prenom ?? ''}`.trim();
  const age = o.patient.dateNaissance
    ? Math.floor(
        (Date.now() - new Date(o.patient.dateNaissance).getTime()) / 31557600000,
      )
    : null;
  const praticien = o.praticien
    ? `${o.praticien.prenom ?? ''} ${o.praticien.nom}`.trim()
    : '—';

  const bandeau =
    o.statut === 'brouillon'
      ? '<p class="bandeau">BROUILLON — NON SIGNÉE</p>'
      : o.statut === 'annulee'
        ? '<p class="bandeau">ORDONNANCE ANNULÉE</p>'
        : '';

  const lignes = o.lignes
    .map(
      (l) => `
      <li>
        <div class="med">${echapper(l.libelle)}</div>
        <div class="pos">${echapper(l.posologie)}</div>
        <div class="det">${[
          l.duree ? `Durée : ${echapper(l.duree)}` : '',
          l.quantite ? `Quantité : ${echapper(l.quantite)}` : '',
          l.voie ? `Voie : ${echapper(l.voie)}` : '',
        ]
          .filter(Boolean)
          .join(' &nbsp;·&nbsp; ')}</div>
        ${l.instructions ? `<div class="det">${echapper(l.instructions)}</div>` : ''}
      </li>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(o.numero)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; margin: 28mm 20mm; }
  header { border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 22px; }
  header h1 { margin: 0; font-size: 20pt; color: #0f766e; }
  header p { margin: 2px 0 0; font-size: 10pt; color: #444; }
  h2 { text-align: center; letter-spacing: 3px; font-size: 13pt; margin: 26px 0 18px; }
  .bandeau { text-align: center; color: #b91c1c; border: 2px solid #b91c1c;
             padding: 6px; letter-spacing: 2px; font-weight: bold; margin-bottom: 18px; }
  .bloc { display: flex; justify-content: space-between; font-size: 11pt; margin-bottom: 18px; }
  ol { padding-left: 20px; }
  li { margin-bottom: 14px; }
  .med { font-weight: bold; font-size: 12pt; }
  .pos { font-size: 11pt; }
  .det { font-size: 10pt; color: #444; }
  .notes { margin-top: 22px; font-size: 10.5pt; font-style: italic; }
  footer { margin-top: 46px; display: flex; justify-content: flex-end; }
  .signature { text-align: center; font-size: 10.5pt; }
  .trait { border-top: 1px solid #111; width: 62mm; margin-top: 42px; padding-top: 4px; }
  .pied { margin-top: 28px; font-size: 8.5pt; color: #666; text-align: center; }
</style></head><body>
<header>
  <h1>${echapper(o.hopital.nom)}</h1>
  <p>${[echapper(o.hopital.ville), echapper(o.hopital.telephone)].filter(Boolean).join(' — ')}</p>
</header>
${bandeau}
<h2>ORDONNANCE MÉDICALE</h2>
<div class="bloc">
  <div>
    <strong>${echapper(patient)}</strong><br>
    Dossier ${echapper(o.patient.numeroDossier)}${age !== null ? ` — ${age} ans` : ''}
    ${o.patient.sexe ? ` — ${o.patient.sexe === 'M' ? 'Masculin' : 'Féminin'}` : ''}
  </div>
  <div style="text-align:right">
    N° ${echapper(o.numero)}<br>
    ${jour(o.dateOrdonnance)}
  </div>
</div>
<ol>${lignes}</ol>
${o.notes ? `<div class="notes">${echapper(o.notes)}</div>` : ''}
<footer>
  <div class="signature">
    ${echapper(praticien)}${o.praticien?.specialite ? `<br>${echapper(o.praticien.specialite)}` : ''}
    <div class="trait">Signature et cachet</div>
  </div>
</footer>
<div class="pied">Ordonnance ${echapper(o.numero)} — ${echapper(o.hopital.nom)}</div>
</body></html>`;

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

  const peutRediger = aPermission('ordonnance.creer');

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
                  {lignes.map((l) => (
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
            <button type="button" onClick={() => imprimer(selection)}>
              Imprimer
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
    </>
  );
}
