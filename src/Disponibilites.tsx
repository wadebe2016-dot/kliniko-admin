import { useCallback, useEffect, useState } from 'react';
import {
  getPraticiens,
  getHoraires,
  creerHoraire,
  supprimerHoraire,
  getIndisponibilites,
  creerIndisponibilite,
  supprimerIndisponibilite,
  getDisponibilites,
  aPermission,
  type Praticien,
  type Horaire,
  type Indisponibilite,
  type JourCreneaux,
} from './api';

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Date du jour au Cameroun (UTC+1), sans dependre du fuseau du poste
function aujourdHui(): string {
  return new Date(Date.now() + 3600000).toISOString().slice(0, 10);
}

function dansNJours(n: number): string {
  return new Date(Date.now() + 3600000 + n * 86400000).toISOString().slice(0, 10);
}

function jourLisible(iso: string): string {
  return new Date(`${iso}T12:00:00+01:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Douala',
  });
}

function periodeLisible(i: Indisponibilite): string {
  const f = (x: string) =>
    new Date(x).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Douala',
    });
  return `${f(i.debut)} → ${f(i.fin)}`;
}

export default function Disponibilites({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [praticiens, setPraticiens] = useState<Praticien[]>([]);
  const [praticienId, setPraticienId] = useState('');
  const [horaires, setHoraires] = useState<Horaire[]>([]);
  const [indispos, setIndispos] = useState<Indisponibilite[]>([]);
  const [jours, setJours] = useState<JourCreneaux[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [fJour, setFJour] = useState(1);
  const [fDebut, setFDebut] = useState('08:00');
  const [fFin, setFFin] = useState('12:30');
  const [fDuree, setFDuree] = useState(30);

  const [iDebut, setIDebut] = useState('');
  const [iFin, setIFin] = useState('');
  const [iMotif, setIMotif] = useState('');

  const peutConfigurer = aPermission('referentiel.gerer');
  const peutAbsence = aPermission('rdv.modifier');

  const traiter = useCallback(
    (e: unknown) => {
      const message = (e as Error).message;
      if (message.includes('reconnecter')) onSessionExpiree();
      else setErreur(message);
    },
    [onSessionExpiree],
  );

  useEffect(() => {
    getPraticiens()
      .then((p) => {
        setPraticiens(p);
        if (p.length === 1) setPraticienId(p[0].id);
      })
      .catch(traiter);
  }, [traiter]);

  const recharger = useCallback(async () => {
    if (!praticienId) return;
    setChargement(true);
    try {
      const [h, i, d] = await Promise.all([
        getHoraires(praticienId),
        getIndisponibilites(praticienId),
        getDisponibilites(praticienId, aujourdHui(), dansNJours(13)),
      ]);
      setHoraires(h);
      setIndispos(i);
      setJours(d.jours);
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [praticienId, traiter]);

  useEffect(() => {
    recharger();
  }, [recharger]);

  async function ajouterHoraire() {
    try {
      await creerHoraire({
        praticienId,
        jourSemaine: fJour,
        heureDebut: fDebut,
        heureFin: fFin,
        dureeCreneau: fDuree,
      });
      await recharger();
    } catch (e) {
      traiter(e);
    }
  }

  async function retirerHoraire(id: string) {
    try {
      await supprimerHoraire(id);
      await recharger();
    } catch (e) {
      traiter(e);
    }
  }

  async function ajouterIndispo() {
    if (!iDebut || !iFin) {
      setErreur('Renseignez le debut et la fin');
      return;
    }
    try {
      await creerIndisponibilite({
        praticienId,
        debut: `${iDebut}:00+01:00`,
        fin: `${iFin}:00+01:00`,
        motif: iMotif.trim() || undefined,
      });
      setIDebut('');
      setIFin('');
      setIMotif('');
      await recharger();
    } catch (e) {
      traiter(e);
    }
  }

  async function retirerIndispo(id: string) {
    try {
      await supprimerIndisponibilite(id);
      await recharger();
    } catch (e) {
      traiter(e);
    }
  }

  return (
    <>
      <section className="card form-card">
        <h2>Praticien</h2>
        <div className="form">
          <div className="field">
            <select
              value={praticienId}
              onChange={(e) => setPraticienId(e.target.value)}
            >
              <option value="">Choisir un praticien…</option>
              {praticiens.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.prenom} {p.nom}
                  {p.specialite ? ` — ${p.specialite}` : ''}
                </option>
              ))}
            </select>
          </div>
          {erreur && <p className="error">{erreur}</p>}

          {praticienId && (
            <>
              <h3 style={{ marginTop: 12 }}>Horaires de travail</h3>
              {horaires.length === 0 && (
                <p className="muted">
                  Aucun horaire declare : aucun creneau ne peut etre propose.
                </p>
              )}
              {horaires.length > 0 && (
                <table className="table">
                  <tbody>
                    {horaires.map((h) => (
                      <tr key={h.id}>
                        <td>{JOURS[h.jourSemaine - 1]}</td>
                        <td>
                          {h.heureDebut} – {h.heureFin}
                        </td>
                        <td className="muted">{h.dureeCreneau} min</td>
                        <td style={{ width: 40 }}>
                          {peutConfigurer && (
                            <button type="button" onClick={() => retirerHoraire(h.id)}>
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {peutConfigurer && (
                <>
                  <div className="row">
                    <div className="field">
                      <label>Jour</label>
                      <select
                        value={fJour}
                        onChange={(e) => setFJour(Number(e.target.value))}
                      >
                        {JOURS.map((j, i) => (
                          <option key={j} value={i + 1}>
                            {j}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Créneau (min)</label>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        value={fDuree}
                        onChange={(e) => setFDuree(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="field">
                      <label>De</label>
                      <input
                        type="time"
                        value={fDebut}
                        onChange={(e) => setFDebut(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>À</label>
                      <input
                        type="time"
                        value={fFin}
                        onChange={(e) => setFFin(e.target.value)}
                      />
                    </div>
                  </div>
                  <button type="button" onClick={ajouterHoraire}>
                    Ajouter la plage
                  </button>
                </>
              )}

              <h3 style={{ marginTop: 16 }}>Congés et absences</h3>
              {indispos.length === 0 && (
                <p className="muted">Aucune indisponibilité à venir.</p>
              )}
              {indispos.length > 0 && (
                <table className="table">
                  <tbody>
                    {indispos.map((i) => (
                      <tr key={i.id}>
                        <td>{periodeLisible(i)}</td>
                        <td className="muted">
                          {i.praticienId ? i.motif || '—' : `Clinique : ${i.motif || '—'}`}
                        </td>
                        <td style={{ width: 40 }}>
                          {peutAbsence && (
                            <button type="button" onClick={() => retirerIndispo(i.id)}>
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {peutAbsence && (
                <>
                  <div className="row">
                    <div className="field">
                      <label>Du</label>
                      <input
                        type="datetime-local"
                        value={iDebut}
                        onChange={(e) => setIDebut(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Au</label>
                      <input
                        type="datetime-local"
                        value={iFin}
                        onChange={(e) => setIFin(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>Motif</label>
                    <input
                      value={iMotif}
                      onChange={(e) => setIMotif(e.target.value)}
                      placeholder="Congé"
                    />
                  </div>
                  <button type="button" onClick={ajouterIndispo}>
                    Déclarer l'absence
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </section>

      <section className="card list-card">
        <div className="list-header">
          <h2>Créneaux libres — 14 prochains jours</h2>
        </div>
        {!praticienId && <p className="muted">Choisissez un praticien.</p>}
        {chargement && <p className="muted">Calcul…</p>}
        {praticienId && !chargement && (
          <div>
            {jours.map((j) => (
              <div key={j.date} style={{ marginBottom: 10 }}>
                <strong style={{ textTransform: 'capitalize' }}>
                  {jourLisible(j.date)}
                </strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {j.creneaux.length === 0 && <span className="muted">—</span>}
                  {j.creneaux.map((c) => (
                    <span
                      key={c.debut}
                      style={{
                        border: '1px solid #0f766e',
                        color: '#0f766e',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: '0.85em',
                      }}
                    >
                      {c.heure}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
