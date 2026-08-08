import { useCallback, useEffect, useState } from 'react';
import {
  getChambres,
  getSejours,
  creerChambre,
  modifierChambre,
  supprimerChambre,
  admettrePatient,
  sortirPatient,
  annulerSejour,
  getPatients,
  getPraticiens,
  aPermission,
  type ChambreOccupation,
  type Sejour,
  type Patient,
  type Praticien,
} from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';
const quand = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Douala',
      })
    : '—';

const STATUT_LIBELLE: Record<Sejour['statut'], string> = {
  en_cours: 'En cours',
  terminee: 'Terminé',
  annulee: 'Annulé',
};

const CHIP_LIBRE = { background: '#e6f4ec', color: '#1c6b3c' };
const CHIP_OCCUPE = { background: '#fdece7', color: '#8c3520' };

export default function Hospitalisation({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [chambres, setChambres] = useState<ChambreOccupation[]>([]);
  const [sejours, setSejours] = useState<Sejour[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [praticiens, setPraticiens] = useState<Praticien[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  // Admission
  const [aPatient, setAPatient] = useState('');
  const [aLit, setALit] = useState('');
  const [aPraticien, setAPraticien] = useState('');
  const [aMotif, setAMotif] = useState('');
  const [aNotes, setANotes] = useState('');

  // Chambres cochees dans le plan (actions Modifier / Supprimer)
  const [cochees, setCochees] = useState<string[]>([]);

  // Nouvelle chambre (creation uniquement, la modification passe par la modale)
  const [cNumero, setCNumero] = useState('');
  const [cCategorie, setCCategorie] = useState('');
  const [cTarif, setCTarif] = useState('');
  const [cNbLits, setCNbLits] = useState(2);

  // Modale (modification ou suppression)
  const [modale, setModale] = useState<'modifier' | 'supprimer' | null>(null);
  const [mChambre, setMChambre] = useState<ChambreOccupation | null>(null);
  const [mNumero, setMNumero] = useState('');
  const [mCategorie, setMCategorie] = useState('');
  const [mTarif, setMTarif] = useState('');
  const [mNbLits, setMNbLits] = useState(2);
  const [mErreur, setMErreur] = useState<string | null>(null);

  const peutGerer = aPermission('hospitalisation.gerer');

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
      const [c, s] = await Promise.all([getChambres(), getSejours()]);
      setChambres(c);
      setSejours(s);
      if (aPermission('hospitalisation.gerer')) {
        const [p, pr] = await Promise.all([getPatients(), getPraticiens()]);
        setPatients(p);
        setPraticiens(pr);
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

  const litsLibres = chambres.flatMap((c) =>
    c.lits
      .filter((l) => !l.occupe)
      .map((l) => ({
        id: l.id,
        libelle: `Chambre ${c.numero} — Lit ${l.numero}${
          c.categorie ? ` (${c.categorie})` : ''
        }${c.tarifJournalier !== null ? ` — ${XAF(c.tarifJournalier)}/jour` : ''}`,
      })),
  );

  async function validerAdmission() {
    if (!aPatient || !aLit || !aMotif.trim()) {
      setErreur("Choisissez le patient, le lit, et indiquez le motif d'admission");
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await admettrePatient({
        patientId: aPatient,
        litId: aLit,
        praticienId: aPraticien || undefined,
        motif: aMotif.trim(),
        notes: aNotes.trim() || undefined,
      });
      setAPatient('');
      setALit('');
      setAPraticien('');
      setAMotif('');
      setANotes('');
      setInfo('Admission enregistrée.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function validerChambre() {
    if (!cNumero.trim()) {
      setErreur('Indiquez le numéro de la chambre');
      return;
    }
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await creerChambre({
        numero: cNumero.trim(),
        categorie: cCategorie.trim() || undefined,
        tarifJournalier: cTarif ? Number(cTarif) : undefined,
        nbLits: cNbLits,
      });
      setInfo('Chambre créée.');
      setCNumero('');
      setCCategorie('');
      setCTarif('');
      setCNbLits(2);
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  function basculer(id: string) {
    setCochees((x) =>
      x.includes(id) ? x.filter((i) => i !== id) : [...x, id],
    );
  }

  function ouvrirModificationPour(c: ChambreOccupation) {
    setMChambre(c);
    setMNumero(c.numero);
    setMCategorie(c.categorie ?? '');
    setMTarif(c.tarifJournalier !== null ? String(c.tarifJournalier) : '');
    setMNbLits(c.lits.length);
    setMErreur(null);
    setModale('modifier');
  }

  function ouvrirModification() {
    const c = chambres.find((x) => x.id === cochees[0]);
    if (c) ouvrirModificationPour(c);
  }

  function ouvrirSuppression() {
    if (cochees.length === 0) return;
    setMErreur(null);
    setModale('supprimer');
  }

  function fermerModale() {
    setModale(null);
    setMChambre(null);
    setMErreur(null);
  }

  async function validerModification() {
    if (!mChambre) return;
    if (!mNumero.trim()) {
      setMErreur('Indiquez le numéro de la chambre');
      return;
    }
    setEnCours(true);
    setMErreur(null);
    try {
      await modifierChambre(mChambre.id, {
        numero: mNumero.trim(),
        categorie: mCategorie.trim(),
        tarifJournalier: mTarif ? Number(mTarif) : undefined,
        nbLits: mNbLits,
      });
      fermerModale();
      setCochees([]);
      setInfo('Chambre modifiée.');
      setErreur(null);
      await charger();
    } catch (e) {
      const m = (e as Error).message;
      if (m.includes('reconnecter')) onSessionExpiree();
      else setMErreur(m);
    } finally {
      setEnCours(false);
    }
  }

  async function confirmerSuppression() {
    const cibles = chambres.filter((c) => cochees.includes(c.id));
    if (cibles.length === 0) return;
    setEnCours(true);
    setMErreur(null);
    const refus: string[] = [];
    const restantes: string[] = [];
    let supprimees = 0;
    for (const c of cibles) {
      try {
        await supprimerChambre(c.id);
        supprimees += 1;
      } catch (e) {
        const m = (e as Error).message;
        if (m.includes('reconnecter')) {
          onSessionExpiree();
          return;
        }
        refus.push(m);
        restantes.push(c.id);
      }
    }
    setCochees(restantes);
    await charger();
    setEnCours(false);
    if (refus.length > 0) {
      // On laisse la modale ouverte : elle montre ce qui a ete refuse
      setMErreur(refus.join(' — '));
    } else {
      fermerModale();
      setInfo(
        supprimees > 1
          ? `${supprimees} chambres supprimées.`
          : 'Chambre supprimée.',
      );
      setErreur(null);
    }
  }

  async function sortie(s: Sejour, facturer: boolean) {
    const nom = `${s.patient.nom} ${s.patient.prenom ?? ''}`.trim();
    if (!window.confirm(`Prononcer la sortie de ${nom} ?`)) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      const r = await sortirPatient({ hospitalisationId: s.id, facturer });
      setInfo(
        `Sortie enregistrée — ${r.jours} jour${r.jours > 1 ? 's' : ''}` +
          (r.facture
            ? `, facture ${r.facture.numero} (${XAF(r.facture.montantTotal)})`
            : ''),
      );
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  async function annuler(s: Sejour) {
    const motif = window.prompt("Motif de l'annulation du séjour ?");
    if (!motif || !motif.trim()) return;
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await annulerSejour({ hospitalisationId: s.id, motif: motif.trim() });
      setInfo('Séjour annulé.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
    }
  }

  const litsTotal = chambres.reduce((n, c) => n + c.lits.length, 0);
  const litsOccupes = chambres.reduce(
    (n, c) => n + c.lits.filter((l) => l.occupe).length,
    0,
  );

  return (
    <>
      {peutGerer && (
        <section className="card form-card">
          <h2>Admettre un patient</h2>
          <div className="form">
            <div className="field">
              <label>Patient</label>
              <select value={aPatient} onChange={(e) => setAPatient(e.target.value)}>
                <option value="">Choisir…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.lastName} {p.firstName} — {p.recordNumber}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Lit</label>
              <select value={aLit} onChange={(e) => setALit(e.target.value)}>
                <option value="">
                  {litsLibres.length === 0 ? 'Aucun lit libre' : 'Choisir…'}
                </option>
                {litsLibres.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.libelle}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Médecin responsable (optionnel)</label>
              <select
                value={aPraticien}
                onChange={(e) => setAPraticien(e.target.value)}
              >
                <option value="">—</option>
                {praticiens.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.prenom ?? ''} {p.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Motif d'admission</label>
              <input
                value={aMotif}
                onChange={(e) => setAMotif(e.target.value)}
                placeholder="Paludisme sévère, observation…"
              />
            </div>
            <div className="field">
              <label>Notes</label>
              <input
                value={aNotes}
                onChange={(e) => setANotes(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              disabled={enCours}
              onClick={validerAdmission}
            >
              Admettre
            </button>

            <h2 style={{ marginTop: 18 }}>Nouvelle chambre</h2>
            <div className="row">
              <div className="field">
                <label>Numéro</label>
                <input
                  value={cNumero}
                  onChange={(e) => setCNumero(e.target.value)}
                  placeholder="103"
                />
              </div>
              <div className="field">
                <label>Catégorie</label>
                <input
                  value={cCategorie}
                  onChange={(e) => setCCategorie(e.target.value)}
                  placeholder="Standard, Privée, VIP…"
                />
              </div>
            </div>
            <div className="row">
              <div className="field">
                <label>Tarif / jour (XAF)</label>
                <input
                  type="number"
                  min={0}
                  value={cTarif}
                  onChange={(e) => setCTarif(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Nombre de lits</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={cNbLits}
                  onChange={(e) => setCNbLits(Number(e.target.value))}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={enCours}
              onClick={validerChambre}
            >
              Créer la chambre
            </button>
            {erreur && <p className="error">{erreur}</p>}
            {info && <p className="muted">{info}</p>}
          </div>
        </section>
      )}

      <section className="card list-card">
        <div className="list-header">
          <h2>Plan des chambres</h2>
          <span className="count">
            {litsOccupes}/{litsTotal} lits occupés
          </span>
          {peutGerer && cochees.length > 0 && (
            <span style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                disabled={enCours || cochees.length !== 1}
                title={
                  cochees.length !== 1
                    ? 'Cochez une seule chambre pour la modifier'
                    : ''
                }
                onClick={ouvrirModification}
              >
                Modifier
              </button>{' '}
              <button
                type="button"
                disabled={enCours}
                onClick={ouvrirSuppression}
              >
                Supprimer{cochees.length > 1 ? ` (${cochees.length})` : ''}
              </button>
            </span>
          )}
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!peutGerer && erreur && <p className="error">{erreur}</p>}
        {!chargement && chambres.length === 0 && (
          <p className="muted">Aucune chambre pour le moment.</p>
        )}
        {chambres.map((c) => (
          <div key={c.id} style={{ marginBottom: 14 }}>
            <div
              style={{
                fontWeight: 600,
                marginBottom: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: peutGerer ? 'pointer' : 'default',
                userSelect: 'none',
              }}
              title={peutGerer ? 'Double-clic pour modifier' : ''}
              onDoubleClick={() => peutGerer && ouvrirModificationPour(c)}
            >
              {peutGerer && (
                <input
                  type="checkbox"
                  checked={cochees.includes(c.id)}
                  onChange={() => basculer(c.id)}
                />
              )}
              <span>
                Chambre {c.numero}
                <span className="muted" style={{ fontWeight: 400 }}>
                  {' '}
                  {[
                    c.categorie,
                    c.tarifJournalier !== null
                      ? `${XAF(c.tarifJournalier)}/jour`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {c.lits.map((l) => (
                <span
                  key={l.id}
                  className="badge-app"
                  style={l.occupe ? CHIP_OCCUPE : CHIP_LIBRE}
                  title={
                    l.sejour
                      ? `${l.sejour.motif} — depuis le ${quand(l.sejour.dateEntree)}`
                      : ''
                  }
                >
                  Lit {l.numero} —{' '}
                  {l.occupe && l.sejour
                    ? `${l.sejour.patient.nom} ${l.sejour.patient.prenom ?? ''} (${l.sejour.patient.numeroDossier})`
                    : 'libre'}
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <div className="list-header">
          <h2>Séjours</h2>
          <span className="count">
            {sejours.filter((s) => s.statut === 'en_cours').length} en cours
          </span>
        </div>
        {sejours.length === 0 && (
          <p className="muted">Aucun séjour pour le moment.</p>
        )}
        {sejours.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Chambre / lit</th>
                <th>Motif</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>Statut</th>
                <th>Facture</th>
                {peutGerer && <th></th>}
              </tr>
            </thead>
            <tbody>
              {sejours.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.patient.nom} {s.patient.prenom ?? ''}
                    <span className="muted"> {s.patient.numeroDossier}</span>
                  </td>
                  <td className="mono">
                    {s.lit.chambre.numero} / {s.lit.numero}
                  </td>
                  <td>{s.motif}</td>
                  <td className="mono">{quand(s.dateEntree)}</td>
                  <td className="mono">{quand(s.dateSortie)}</td>
                  <td>{STATUT_LIBELLE[s.statut]}</td>
                  <td className="muted">
                    {s.facture
                      ? `${s.facture.numero} (${XAF(Number(s.facture.montantTotal))})`
                      : '—'}
                  </td>
                  {peutGerer && (
                    <td>
                      {s.statut === 'en_cours' && (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={enCours}
                            onClick={() => sortie(s, true)}
                          >
                            Sortie + facture
                          </button>{' '}
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => sortie(s, false)}
                          >
                            Sortie seule
                          </button>{' '}
                          <button
                            type="button"
                            disabled={enCours}
                            onClick={() => annuler(s)}
                          >
                            Annuler
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {modale && (
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
          onClick={() => !enCours && fermerModale()}
        >
          <div
            className="card"
            style={{ width: 'min(480px, 92vw)', maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {modale === 'modifier' && mChambre && (
              <>
                <h2>Modifier la chambre {mChambre.numero}</h2>
                <div className="form">
                  <div className="row">
                    <div className="field">
                      <label>Numéro</label>
                      <input
                        value={mNumero}
                        onChange={(e) => setMNumero(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Catégorie</label>
                      <input
                        value={mCategorie}
                        onChange={(e) => setMCategorie(e.target.value)}
                        placeholder="Standard, Privée, VIP…"
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label>Tarif / jour (XAF)</label>
                      <input
                        type="number"
                        min={0}
                        value={mTarif}
                        onChange={(e) => setMTarif(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Nombre de lits</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={mNbLits}
                        onChange={(e) => setMNbLits(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <p className="muted">
                    Augmenter le nombre de lits en crée ; le diminuer ne retire
                    que des lits jamais utilisés.
                  </p>
                  {mErreur && <p className="error">{mErreur}</p>}
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={fermerModale}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={enCours}
                      onClick={validerModification}
                    >
                      {enCours ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </>
            )}
            {modale === 'supprimer' && (
              <>
                <h2>
                  Supprimer{' '}
                  {cochees.length > 1
                    ? `${cochees.length} chambres`
                    : 'la chambre'}
                </h2>
                <p style={{ margin: '10px 0 6px' }}>
                  {chambres
                    .filter((c) => cochees.includes(c.id))
                    .map((c) => `Chambre ${c.numero}`)
                    .join(', ')}
                </p>
                <p className="muted">
                  Une chambre dont les lits ont déjà accueilli un séjour, même
                  terminé, sera refusée : l'historique est conservé.
                </p>
                {mErreur && <p className="error">{mErreur}</p>}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                    marginTop: 12,
                  }}
                >
                  <button
                    type="button"
                    disabled={enCours}
                    onClick={fermerModale}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#b91c1c' }}
                    disabled={enCours || cochees.length === 0}
                    onClick={confirmerSuppression}
                  >
                    {enCours ? 'Suppression…' : 'Supprimer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
