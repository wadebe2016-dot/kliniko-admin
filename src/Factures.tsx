import { useEffect, useState } from 'react';
import {
  aPermission,
  createFacture,
  encaisserFacture,
  getActes,
  getFacture,
  getFactures,
  getPatients,
  type Acte,
  type Facture,
  type Patient,
  type StatutFacture,
} from './api';

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

type Props = {
  onSessionExpiree: () => void;
};

function Factures({ onSessionExpiree }: Props) {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [actes, setActes] = useState<Acte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire nouvelle facture : quantite par acte (0 = non facture)
  const [patientId, setPatientId] = useState('');
  const [quantites, setQuantites] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Facture selectionnee (detail + encaissement)
  const [detail, setDetail] = useState<Facture | null>(null);
  const [montant, setMontant] = useState('');
  const [moyen, setMoyen] = useState<'especes' | 'mobile_money'>('especes');
  const [encaisseError, setEncaisseError] = useState<string | null>(null);
  const [encaissement, setEncaissement] = useState(false);

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
      setFormError('Choisis au moins un acte (quantite superieure a zero)');
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
    } catch (e) {
      gererErreur(e as Error, setError);
    }
  }

  async function handleEncaisser(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setEncaissement(true);
    setEncaisseError(null);
    try {
      const f = await encaisserFacture(detail.id, {
        montant: Number(montant),
        moyen,
      });
      setDetail(f);
      const reste = Number(f.montantTotal) - Number(f.montantPaye);
      setMontant(reste > 0 ? String(reste) : '');
      await charger();
    } catch (err) {
      gererErreur(err as Error, setEncaisseError);
    } finally {
      setEncaissement(false);
    }
  }

  const resteDetail = detail
    ? Number(detail.montantTotal) - Number(detail.montantPaye)
    : 0;

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
              style={{ padding: '2px 10px', cursor: 'pointer' }}
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
          {(detail.paiements ?? []).length > 0 && (
            <p className="muted">
              Paiements :{' '}
              {(detail.paiements ?? [])
                .map(
                  (p) =>
                    `${fmt(p.montant)} (${p.moyen === 'especes' ? 'espèces' : 'mobile money'})`,
                )
                .join(' + ')}
            </p>
          )}
          {aPermission('facture.encaisser') &&
            detail.statut !== 'reglee' &&
            detail.statut !== 'annulee' && (
              <form
                onSubmit={handleEncaisser}
                style={{
                  display: 'flex',
                  alignItems: 'center',
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
                <button
                  type="submit"
                  disabled={encaissement}
                  className="btn-primary"
                  style={{ padding: '6px 16px' }}
                >
                  {encaissement ? 'Encaissement…' : 'Encaisser'}
                </button>
              </form>
            )}
          {encaisseError && <p className="error">{encaisseError}</p>}
        </section>
      )}
    </>
  );
}

export default Factures;
