import { useEffect, useState } from 'react';
import { getTableauDeBord, type TableauDeBordStats } from './api';

const XAF = (n: number) => n.toLocaleString('fr-FR') + ' XAF';

function quand(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Douala',
  });
}

export default function TableauDeBord({
  onSessionExpiree,
  onAller,
}: {
  onSessionExpiree: () => void;
  onAller: (vue: string) => void;
}) {
  const [stats, setStats] = useState<TableauDeBordStats | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getTableauDeBord()
      .then(setStats)
      .catch((e) => {
        const m = (e as Error).message;
        if (m.includes('reconnecter')) onSessionExpiree();
        else setErreur(m);
      });
  }, [onSessionExpiree]);

  if (erreur) return <p className="error">{erreur}</p>;
  if (!stats) return <p className="muted">Chargement du tableau de bord…</p>;

  return (
    <div className="tdb">
      {(stats.demandesEnAttente ?? 0) > 0 && (
        <div className="tdb-alerte" onClick={() => onAller('agenda')}>
          <b>{stats.demandesEnAttente}</b>&nbsp;
          {stats.demandesEnAttente === 1
            ? "demande de rendez-vous venue de l'application patient attend votre réponse."
            : "demandes de rendez-vous venues de l'application patient attendent votre réponse."}
          <span className="tdb-alerte-action">Ouvrir l'agenda ›</span>
        </div>
      )}

      <div className="tdb-kpis">
        {stats.patientsTotal !== undefined && (
          <div className="kpi">
            <div className="kpi-lab">Patients</div>
            <div className="kpi-val">{stats.patientsTotal}</div>
            <div className="kpi-note">dossiers actifs</div>
          </div>
        )}
        {stats.rdvAujourdHui !== undefined && (
          <div className="kpi">
            <div className="kpi-lab">Rendez-vous aujourd'hui</div>
            <div className="kpi-val">{stats.rdvAujourdHui}</div>
            <div className="kpi-note">planifiés, confirmés ou honorés</div>
          </div>
        )}
        {stats.consultationsAujourdHui !== undefined && (
          <div className="kpi">
            <div className="kpi-lab">Consultations aujourd'hui</div>
            <div className="kpi-val">{stats.consultationsAujourdHui}</div>
            <div className="kpi-note">dossiers médicaux du jour</div>
          </div>
        )}
        {stats.encaisseAujourdHui !== undefined && (
          <div className="kpi">
            <div className="kpi-lab">Encaissé aujourd'hui</div>
            <div className="kpi-val">{XAF(stats.encaisseAujourdHui)}</div>
            <div className="kpi-note">espèces et Mobile Money confirmé</div>
          </div>
        )}
        {stats.facturesOuvertes !== undefined && (
          <div className="kpi">
            <div className="kpi-lab">Factures ouvertes</div>
            <div className="kpi-val">{stats.facturesOuvertes}</div>
            <div className="kpi-note">
              {XAF(stats.montantImpaye ?? 0)} à recouvrer
            </div>
          </div>
        )}
      </div>

      {stats.prochainsRdv && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="list-header">
            <h2>Prochains rendez-vous</h2>
            <button type="button" onClick={() => onAller('agenda')}>
              Ouvrir l'agenda
            </button>
          </div>
          {stats.prochainsRdv.length === 0 && (
            <p className="muted">Aucun rendez-vous à venir.</p>
          )}
          {stats.prochainsRdv.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>Quand</th>
                  <th>Patient</th>
                  <th>Praticien</th>
                  <th>Motif</th>
                  <th>Origine</th>
                </tr>
              </thead>
              <tbody>
                {stats.prochainsRdv.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{quand(r.debut)}</td>
                    <td>
                      {r.patient.nom} {r.patient.prenom ?? ''}
                      <span className="muted"> ({r.patient.numeroDossier})</span>
                    </td>
                    <td>
                      {r.praticien
                        ? `${r.praticien.prenom ?? ''} ${r.praticien.nom}`
                        : '—'}
                    </td>
                    <td>{r.motif || '—'}</td>
                    <td>
                      {r.origine === 'patient' ? (
                        <span className="badge-app">Application</span>
                      ) : (
                        <span className="muted">Clinique</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
