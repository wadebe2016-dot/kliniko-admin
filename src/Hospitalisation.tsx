import { useCallback, useEffect, useState } from 'react';
import {
  getChambres,
  getSejours,
  creerChambre,
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

  // Nouvelle chambre
  const [cNumero, setCNumero] = useState('');
  const [cCategorie, setCCategorie] = useState('');
  const [cTarif, setCTarif] = useState('');
  const [cNbLits, setCNbLits] = useState(2);

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
      setCNumero('');
      setCCategorie('');
      setCTarif('');
      setCNbLits(2);
      setInfo('Chambre créée.');
      await charger();
    } catch (e) {
      traiter(e);
    } finally {
      setEnCours(false);
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
                    {p.nom} {p.prenom ?? ''} — {p.numeroDossier}
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
        </div>
        {chargement && <p className="muted">Chargement…</p>}
        {!peutGerer && erreur && <p className="error">{erreur}</p>}
        {!chargement && chambres.length === 0 && (
          <p className="muted">Aucune chambre pour le moment.</p>
        )}
        {chambres.map((c) => (
          <div key={c.id} style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
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
    </>
  );
}
