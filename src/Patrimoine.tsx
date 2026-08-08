import { useCallback, useEffect, useState } from 'react';
import {
  getActifs,
  getActifDetail,
  creerActif,
  modifierActif,
  supprimerActif,
  creerIntervention,
  majIntervention,
  getContrats,
  creerContrat,
  modifierContrat,
  supprimerContrat,
  getPersonnel,
  aPermission,
  type Actif,
  type ActifDetail,
  type Contrat,
  type MembrePersonnel,
} from './api';

// --- Styles repris du design Edufo -----------------------------------------
const inp = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  fontSize: 14,
  boxSizing: 'border-box',
} as const;
const lbl = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 4,
} as const;
const thT = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 12,
  color: '#475569',
  fontWeight: 600,
  textTransform: 'uppercase',
} as const;
const tdT = { padding: '10px 12px', color: '#1E293B' } as const;
const overlayT = {
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
const modalT = {
  background: '#fff',
  borderRadius: 14,
  padding: 24,
  width: '100%',
  maxWidth: 440,
  boxShadow: '0 10px 40px rgba(0,0,0,.2)',
} as const;
const BRAND = '#1d4f91';

const fcfa = (n: number | null) =>
  (Number(n) || 0).toLocaleString('fr-FR') + ' FCFA';
const jour = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

const CATS = [
  'batiment',
  'salle',
  'materiel_medical',
  'materiel_informatique',
  'mobilier',
  'vehicule',
  'equipement',
  'autre',
] as const;
const CAT_LIBELLE: Record<string, string> = {
  batiment: 'Bâtiment',
  salle: 'Salle',
  materiel_medical: 'Matériel médical',
  materiel_informatique: 'Matériel informatique',
  mobilier: 'Mobilier',
  vehicule: 'Véhicule',
  equipement: 'Équipement',
  autre: 'Autre',
};
const ETATS = ['bon', 'moyen', 'en_reparation', 'hors_service', 'cede'] as const;
const ETAT_LIBELLE: Record<string, string> = {
  bon: 'Bon',
  moyen: 'Moyen',
  en_reparation: 'En réparation',
  hors_service: 'Hors service',
  cede: 'Cédé',
};
const IV_TYPES = ['panne', 'reparation', 'entretien', 'controle'] as const;
const IV_TYPE_LIBELLE: Record<string, string> = {
  panne: 'Panne',
  reparation: 'Réparation',
  entretien: 'Entretien',
  controle: 'Contrôle',
};
const IV_STATUT_LIBELLE: Record<string, string> = {
  ouverte: 'Ouverte',
  en_cours: 'En cours',
  terminee: 'Terminée',
  annulee: 'Annulée',
};
const CTR_TYPES = [
  'travail',
  'vacataire',
  'prestataire',
  'bail',
  'assurance',
  'maintenance',
  'autre',
] as const;
const CTR_TYPE_LIBELLE: Record<string, string> = {
  travail: 'Contrat de travail',
  vacataire: 'Vacataire',
  prestataire: 'Prestataire',
  bail: 'Bail',
  assurance: 'Assurance',
  maintenance: 'Maintenance',
  autre: 'Autre',
};
const CTR_STATUT_LIBELLE: Record<string, string> = {
  a_venir: 'À venir',
  en_cours: 'En cours',
  expire_bientot: 'Expire bientôt',
  expire: 'Expiré',
  resilie: 'Résilié',
};

function etatBadge(e: string) {
  const m =
    {
      bon: { bg: '#DCFCE7', fg: '#166534' },
      moyen: { bg: '#FEF9C3', fg: '#854D0E' },
      en_reparation: { bg: '#FFEDD5', fg: '#9A3412' },
      hors_service: { bg: '#FEE2E2', fg: '#991B1B' },
      cede: { bg: '#F1F5F9', fg: '#475569' },
    }[e] ?? { bg: '#F1F5F9', fg: '#334155' };
  return (
    <span style={{ background: m.bg, color: m.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {ETAT_LIBELLE[e] ?? e}
    </span>
  );
}
function ivBadge(s: string) {
  const m =
    {
      ouverte: { bg: '#FEE2E2', fg: '#991B1B' },
      en_cours: { bg: '#FEF9C3', fg: '#854D0E' },
      terminee: { bg: '#DCFCE7', fg: '#166534' },
      annulee: { bg: '#F1F5F9', fg: '#475569' },
    }[s] ?? { bg: '#F1F5F9', fg: '#334155' };
  return (
    <span style={{ background: m.bg, color: m.fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {IV_STATUT_LIBELLE[s] ?? s}
    </span>
  );
}
function ctrBadge(s: string) {
  const m =
    {
      a_venir: { bg: '#DBEAFE', fg: '#1E40AF' },
      en_cours: { bg: '#DCFCE7', fg: '#166534' },
      expire_bientot: { bg: '#FEF9C3', fg: '#854D0E' },
      expire: { bg: '#FEE2E2', fg: '#991B1B' },
      resilie: { bg: '#F1F5F9', fg: '#475569' },
    }[s] ?? { bg: '#F1F5F9', fg: '#334155' };
  return (
    <span style={{ background: m.bg, color: m.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {CTR_STATUT_LIBELLE[s] ?? s}
    </span>
  );
}

type FormActif = {
  id?: string;
  designation: string;
  categorie: string;
  etat: string;
  localisation: string;
  dateAcquisition: string;
  valeurAcquisition: number | string;
  dureeAmortAnnees: number | string;
  fournisseur: string;
  affecteA: string;
  notes: string;
  actif: boolean;
};
type FormIv = { type: string; description: string; cout: number | string };
type FormCtr = {
  id?: string;
  type: string;
  objet: string;
  cocontractant: string;
  personnelId: string;
  dateDebut: string;
  dateFin: string;
  montant: number | string;
  note: string;
  resilie: boolean;
};
type Confirmation = { message: string; action: () => Promise<void> };

export default function Patrimoine({
  onSessionExpiree,
}: {
  onSessionExpiree: () => void;
}) {
  const [tab, setTab] = useState<'actifs' | 'contrats'>('actifs');
  const [actifs, setActifs] = useState<Actif[]>([]);
  const [personnel, setPersonnel] = useState<MembrePersonnel[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [filtreCat, setFiltreCat] = useState('');
  const [filtreEtat, setFiltreEtat] = useState('');
  const [recherche, setRecherche] = useState('');

  const [actifForm, setActifForm] = useState<FormActif | null>(null);
  const [actifDetail, setActifDetail] = useState<ActifDetail | null>(null);
  const [ivForm, setIvForm] = useState<FormIv | null>(null);
  const [fErreur, setFErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const [ctrList, setCtrList] = useState<Contrat[]>([]);
  const [ctrForm, setCtrForm] = useState<FormCtr | null>(null);
  const [ctrFiltreType, setCtrFiltreType] = useState('');

  const peutGerer = aPermission('patrimoine.gerer');

  const traiter = useCallback(
    (e: unknown) => {
      const m = (e as Error).message;
      if (m.includes('reconnecter')) onSessionExpiree();
      else setErreur(m);
    },
    [onSessionExpiree],
  );

  const chargerActifs = useCallback(async () => {
    try {
      setChargement(true);
      setActifs(await getActifs(filtreCat || undefined, filtreEtat || undefined));
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [filtreCat, filtreEtat, traiter]);

  const chargerContrats = useCallback(async () => {
    try {
      setChargement(true);
      setCtrList(await getContrats(ctrFiltreType || undefined));
      setErreur(null);
    } catch (e) {
      traiter(e);
    } finally {
      setChargement(false);
    }
  }, [ctrFiltreType, traiter]);

  useEffect(() => {
    chargerActifs();
  }, [chargerActifs]);
  useEffect(() => {
    if (tab === 'contrats') chargerContrats();
  }, [tab, chargerContrats]);
  useEffect(() => {
    getPersonnel()
      .then(setPersonnel)
      .catch(() => setPersonnel([]));
  }, []);

  const q = recherche.trim().toLowerCase();
  const actifsFiltres = actifs.filter(
    (a) =>
      !q ||
      [a.code, a.designation, a.localisation, a.fournisseur]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
  );
  const ctrFiltres = ctrList.filter(
    (c) =>
      !q ||
      [c.reference, c.objet, c.cocontractant, c.personnel?.prenom, c.personnel?.nom]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
  );

  async function ouvrirActif(id: string) {
    try {
      setActifDetail(await getActifDetail(id));
      setIvForm(null);
      setFErreur(null);
    } catch (e) {
      traiter(e);
    }
  }

  async function saveActif() {
    if (!actifForm) return;
    if (!actifForm.designation.trim()) {
      setFErreur("Le nom de l'actif est requis.");
      return;
    }
    setEnCours(true);
    setFErreur(null);
    try {
      if (actifForm.id) {
        await modifierActif(actifForm.id, {
          designation: actifForm.designation.trim(),
          categorie: actifForm.categorie || 'equipement',
          localisation: actifForm.localisation.trim(),
          etat: actifForm.etat || 'bon',
          dateAcquisition: actifForm.dateAcquisition,
          valeurAcquisition: Number(actifForm.valeurAcquisition) || 0,
          dureeAmortAnnees: actifForm.dureeAmortAnnees
            ? Number(actifForm.dureeAmortAnnees)
            : undefined,
          fournisseur: actifForm.fournisseur.trim(),
          affecteA: actifForm.affecteA,
          notes: actifForm.notes.trim(),
          actif: actifForm.actif,
        });
      } else {
        await creerActif({
          designation: actifForm.designation.trim(),
          categorie: actifForm.categorie || 'equipement',
          localisation: actifForm.localisation.trim() || undefined,
          etat: actifForm.etat || 'bon',
          dateAcquisition: actifForm.dateAcquisition || undefined,
          valeurAcquisition: Number(actifForm.valeurAcquisition) || 0,
          dureeAmortAnnees: actifForm.dureeAmortAnnees
            ? Number(actifForm.dureeAmortAnnees)
            : undefined,
          fournisseur: actifForm.fournisseur.trim() || undefined,
          affecteA: actifForm.affecteA || undefined,
          notes: actifForm.notes.trim() || undefined,
        });
      }
      setActifForm(null);
      await chargerActifs();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  function demanderSuppressionActif(a: ActifDetail) {
    setFErreur(null);
    setConfirmation({
      message: 'Supprimer cet actif ?',
      action: async () => {
        await supprimerActif(a.id);
        setActifDetail(null);
      },
    });
  }

  async function saveIntervention() {
    if (!ivForm || !actifDetail) return;
    if (!ivForm.description.trim()) {
      setFErreur('La description est requise.');
      return;
    }
    setEnCours(true);
    setFErreur(null);
    try {
      await creerIntervention(actifDetail.id, {
        type: ivForm.type,
        description: ivForm.description.trim(),
        cout: Number(ivForm.cout) || 0,
      });
      setIvForm(null);
      await ouvrirActif(actifDetail.id);
      await chargerActifs();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function cloturerIntervention(ivId: string) {
    if (!actifDetail) return;
    setEnCours(true);
    setFErreur(null);
    try {
      await majIntervention(ivId, { statut: 'terminee' });
      await ouvrirActif(actifDetail.id);
      await chargerActifs();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  async function saveContrat() {
    if (!ctrForm) return;
    if (!ctrForm.objet.trim()) {
      setFErreur("L'objet du contrat est requis.");
      return;
    }
    setEnCours(true);
    setFErreur(null);
    try {
      if (ctrForm.id) {
        await modifierContrat(ctrForm.id, {
          type: ctrForm.type || 'prestataire',
          objet: ctrForm.objet.trim(),
          cocontractant: ctrForm.personnelId ? '' : ctrForm.cocontractant.trim(),
          personnelId: ctrForm.personnelId,
          dateDebut: ctrForm.dateDebut,
          dateFin: ctrForm.dateFin,
          montant: Number(ctrForm.montant) || 0,
          note: ctrForm.note.trim(),
          resilie: ctrForm.resilie,
        });
      } else {
        await creerContrat({
          type: ctrForm.type || 'prestataire',
          objet: ctrForm.objet.trim(),
          cocontractant: ctrForm.personnelId
            ? undefined
            : ctrForm.cocontractant.trim() || undefined,
          personnelId: ctrForm.personnelId || undefined,
          dateDebut: ctrForm.dateDebut || undefined,
          dateFin: ctrForm.dateFin || undefined,
          montant: Number(ctrForm.montant) || 0,
          note: ctrForm.note.trim() || undefined,
        });
      }
      setCtrForm(null);
      await chargerContrats();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  function demanderSuppressionContrat(c: Contrat) {
    setFErreur(null);
    setConfirmation({
      message: 'Supprimer ce contrat ?',
      action: async () => {
        await supprimerContrat(c.id);
      },
    });
  }

  async function validerConfirmation() {
    if (!confirmation) return;
    setEnCours(true);
    setFErreur(null);
    try {
      await confirmation.action();
      setConfirmation(null);
      await chargerActifs();
      if (tab === 'contrats') await chargerContrats();
    } catch (e) {
      setFErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const tabBtn = (k: 'actifs' | 'contrats', label: string) => (
    <button
      type="button"
      onClick={() => setTab(k)}
      style={{
        padding: '8px 14px',
        border: '1px solid ' + (tab === k ? BRAND : '#CBD5E1'),
        background: tab === k ? BRAND : '#fff',
        color: tab === k ? '#fff' : '#334155',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );

  const nouvelActif = (): FormActif => ({
    designation: '',
    categorie: 'equipement',
    etat: 'bon',
    localisation: '',
    dateAcquisition: '',
    valeurAcquisition: '',
    dureeAmortAnnees: '',
    fournisseur: '',
    affecteA: '',
    notes: '',
    actif: true,
  });

  return (
    <>
      <p style={{ color: '#64748B', fontSize: 14, marginTop: -6, marginBottom: 14 }}>
        Registre des actifs, amortissement et interventions de maintenance.
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tabBtn('actifs', 'Actifs')}
        {tabBtn('contrats', 'Contrats')}
      </div>

      {erreur && <p className="error">{erreur}</p>}

      {tab === 'actifs' && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px' }}>
            <div>
              <label style={lbl}>Catégorie</label>
              <select value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)} style={{ ...inp, width: 200, cursor: 'pointer' }}>
                <option value="">*</option>
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {CAT_LIBELLE[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>État</label>
              <select value={filtreEtat} onChange={(e) => setFiltreEtat(e.target.value)} style={{ ...inp, width: 180, cursor: 'pointer' }}>
                <option value="">*</option>
                {ETATS.map((e2) => (
                  <option key={e2} value={e2}>
                    {ETAT_LIBELLE[e2]}
                  </option>
                ))}
              </select>
            </div>
            {peutGerer && (
              <button
                type="button"
                onClick={() => {
                  setFErreur(null);
                  setActifForm(nouvelActif());
                }}
                style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                + Nouvel actif
              </button>
            )}
            <input
              type="text"
              placeholder="🔍 Rechercher…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{ ...inp, width: 240 }}
            />
          </div>

          {chargement ? (
            <div style={{ color: '#94A3B8', fontSize: 14 }}>…</div>
          ) : actifsFiltres.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 14 }}>
              {actifs.length === 0
                ? 'Aucun actif. Enregistrez votre premier actif pour démarrer le registre.'
                : 'Aucun résultat.'}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 860 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={thT}>Code</th>
                    <th style={thT}>Désignation</th>
                    <th style={thT}>Catégorie</th>
                    <th style={thT}>Localisation</th>
                    <th style={thT}>État</th>
                    <th style={{ ...thT, textAlign: 'right' }}>Valeur d'acquisition</th>
                    <th style={{ ...thT, textAlign: 'right' }}>Valeur résiduelle</th>
                  </tr>
                </thead>
                <tbody>
                  {actifsFiltres.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => ouvrirActif(a.id)}
                      style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', opacity: a.actif === false ? 0.5 : 1 }}
                    >
                      <td style={{ ...tdT, whiteSpace: 'nowrap', fontWeight: 600 }}>{a.code}</td>
                      <td style={tdT}>
                        {a.designation}
                        {a.interventionsOuvertes > 0 && (
                          <span style={{ marginLeft: 6, background: '#FEE2E2', color: '#991B1B', padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                            🔧 {a.interventionsOuvertes}
                          </span>
                        )}
                      </td>
                      <td style={tdT}>{a.categorie ? (CAT_LIBELLE[a.categorie] ?? a.categorie) : '—'}</td>
                      <td style={tdT}>{a.localisation || '—'}</td>
                      <td style={tdT}>{etatBadge(a.etat)}</td>
                      <td style={{ ...tdT, textAlign: 'right', whiteSpace: 'nowrap' }}>{fcfa(a.valeurAcquisition)}</td>
                      <td style={{ ...tdT, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600, color: '#166534' }}>{fcfa(a.valeurResiduelle)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'contrats' && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px' }}>
            <div>
              <label style={lbl}>Type</label>
              <select value={ctrFiltreType} onChange={(e) => setCtrFiltreType(e.target.value)} style={{ ...inp, width: 220, cursor: 'pointer' }}>
                <option value="">*</option>
                {CTR_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {CTR_TYPE_LIBELLE[ty]}
                  </option>
                ))}
              </select>
            </div>
            {peutGerer && (
              <button
                type="button"
                onClick={() => {
                  setFErreur(null);
                  setCtrForm({
                    type: 'prestataire',
                    objet: '',
                    cocontractant: '',
                    personnelId: '',
                    dateDebut: '',
                    dateFin: '',
                    montant: '',
                    note: '',
                    resilie: false,
                  });
                }}
                style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              >
                + Nouveau contrat
              </button>
            )}
            <input
              type="text"
              placeholder="🔍 Rechercher…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{ ...inp, width: 240 }}
            />
          </div>

          {chargement ? (
            <div style={{ color: '#94A3B8', fontSize: 14 }}>…</div>
          ) : ctrFiltres.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: 14 }}>
              {ctrList.length === 0
                ? 'Aucun contrat. Enregistrez votre premier contrat pour démarrer le registre.'
                : 'Aucun résultat.'}
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={thT}>Référence</th>
                    <th style={thT}>Objet</th>
                    <th style={thT}>Type</th>
                    <th style={thT}>Partie</th>
                    <th style={thT}>Fin</th>
                    <th style={{ ...thT, textAlign: 'right' }}>Montant</th>
                    <th style={thT}>Statut</th>
                    <th style={thT}></th>
                  </tr>
                </thead>
                <tbody>
                  {ctrFiltres.map((c) => (
                    <tr key={c.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td
                        style={{ ...tdT, whiteSpace: 'nowrap', fontWeight: 600, cursor: 'pointer' }}
                        onClick={() =>
                          setCtrForm({
                            id: c.id,
                            type: c.type,
                            objet: c.objet,
                            cocontractant: c.cocontractant ?? '',
                            personnelId: c.personnelId ?? '',
                            dateDebut: c.dateDebut ? c.dateDebut.slice(0, 10) : '',
                            dateFin: c.dateFin ? c.dateFin.slice(0, 10) : '',
                            montant: c.montant,
                            note: c.note ?? '',
                            resilie: c.resilie,
                          })
                        }
                      >
                        {c.reference || '—'}
                      </td>
                      <td style={tdT}>{c.objet}</td>
                      <td style={tdT}>{CTR_TYPE_LIBELLE[c.type] ?? c.type}</td>
                      <td style={tdT}>
                        {c.personnel
                          ? `${c.personnel.prenom ?? ''} ${c.personnel.nom}`.trim()
                          : c.cocontractant || '—'}
                      </td>
                      <td style={{ ...tdT, whiteSpace: 'nowrap' }}>
                        {jour(c.dateFin)}
                        {c.statutTemporel === 'expire_bientot' && c.joursRestants != null && (
                          <span style={{ marginLeft: 6, color: '#854D0E', fontSize: 11, fontWeight: 700 }}>
                            J-{c.joursRestants}
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdT, textAlign: 'right', whiteSpace: 'nowrap' }}>{fcfa(c.montant)}</td>
                      <td style={tdT}>{ctrBadge(c.statutTemporel)}</td>
                      <td style={{ ...tdT, whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {peutGerer && (
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => demanderSuppressionContrat(c)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991B1B', padding: 4 }}
                          >
                            🗑
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {actifForm && (
        <div style={overlayT} onClick={() => !enCours && setActifForm(null)}>
          <div style={{ ...modalT, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#0A1F44' }}>
              {actifForm.id ? actifForm.designation : '+ Nouvel actif'}
            </h3>
            <label style={lbl}>Désignation</label>
            <input type="text" value={actifForm.designation} onChange={(e) => setActifForm({ ...actifForm, designation: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={lbl}>Catégorie</label>
                <select value={actifForm.categorie} onChange={(e) => setActifForm({ ...actifForm, categorie: e.target.value })} style={{ ...inp, marginBottom: 12, cursor: 'pointer' }}>
                  {CATS.map((c) => (
                    <option key={c} value={c}>
                      {CAT_LIBELLE[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={lbl}>État</label>
                <select value={actifForm.etat} onChange={(e) => setActifForm({ ...actifForm, etat: e.target.value })} style={{ ...inp, marginBottom: 12, cursor: 'pointer' }}>
                  {ETATS.map((e2) => (
                    <option key={e2} value={e2}>
                      {ETAT_LIBELLE[e2]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label style={lbl}>Localisation</label>
            <input type="text" value={actifForm.localisation} onChange={(e) => setActifForm({ ...actifForm, localisation: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Date d'acquisition</label>
                <input type="date" value={actifForm.dateAcquisition} onChange={(e) => setActifForm({ ...actifForm, dateAcquisition: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Valeur d'acquisition</label>
                <input type="number" min={0} value={actifForm.valeurAcquisition} onChange={(e) => setActifForm({ ...actifForm, valeurAcquisition: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={lbl}>Amortissement (ans)</label>
                <input type="number" min={0} value={actifForm.dureeAmortAnnees} onChange={(e) => setActifForm({ ...actifForm, dureeAmortAnnees: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl}>Fournisseur</label>
                <input type="text" value={actifForm.fournisseur} onChange={(e) => setActifForm({ ...actifForm, fournisseur: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl}>Affecté à</label>
                <select value={actifForm.affecteA} onChange={(e) => setActifForm({ ...actifForm, affecteA: e.target.value })} style={{ ...inp, marginBottom: 12, cursor: 'pointer' }}>
                  <option value="">—</option>
                  {personnel.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label style={lbl}>Note</label>
            <input type="text" value={actifForm.notes} onChange={(e) => setActifForm({ ...actifForm, notes: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
            {actifForm.id && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={actifForm.actif} onChange={(e) => setActifForm({ ...actifForm, actif: e.target.checked })} /> Actif
              </label>
            )}
            {fErreur && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" disabled={enCours} onClick={() => setActifForm(null)} style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
                Fermer
              </button>
              <button type="button" disabled={enCours} onClick={saveActif} style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {actifDetail && (
        <div style={overlayT} onClick={() => !enCours && setActifDetail(null)}>
          <div style={{ ...modalT, maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#0A1F44' }}>
              {actifDetail.code} — {actifDetail.designation}
            </h3>
            <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {etatBadge(actifDetail.etat)}
              <span style={{ fontSize: 13, color: '#64748B' }}>
                {actifDetail.categorie ? (CAT_LIBELLE[actifDetail.categorie] ?? actifDetail.categorie) : ''}
                {actifDetail.localisation ? ` · ${actifDetail.localisation}` : ''}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 12 }}>
              <div>
                <span style={{ color: '#64748B' }}>Valeur d'acquisition :</span>{' '}
                <strong>{fcfa(actifDetail.valeurAcquisition)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748B' }}>Valeur résiduelle :</span>{' '}
                <strong style={{ color: '#166534' }}>{fcfa(actifDetail.valeurResiduelle)}</strong>
              </div>
              {actifDetail.dateAcquisition && (
                <div>
                  <span style={{ color: '#64748B' }}>Date d'acquisition :</span> {jour(actifDetail.dateAcquisition)}
                </div>
              )}
              {actifDetail.dureeAmortAnnees && (
                <div>
                  <span style={{ color: '#64748B' }}>Amortissement :</span> {actifDetail.dureeAmortAnnees} ans
                </div>
              )}
              {actifDetail.fournisseur && (
                <div>
                  <span style={{ color: '#64748B' }}>Fournisseur :</span> {actifDetail.fournisseur}
                </div>
              )}
              {actifDetail.affecte && (
                <div>
                  <span style={{ color: '#64748B' }}>Affecté à :</span> {actifDetail.affecte.prenom} {actifDetail.affecte.nom}
                </div>
              )}
              {actifDetail.notes && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <span style={{ color: '#64748B' }}>Note :</span> {actifDetail.notes}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <strong style={{ fontSize: 14, color: '#0A1F44' }}>Interventions de maintenance</strong>
              {peutGerer && (
                <button
                  type="button"
                  onClick={() => setIvForm({ type: 'panne', description: '', cout: '' })}
                  style={{ background: '#991B1B', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  🔧 Nouvelle intervention
                </button>
              )}
            </div>
            {actifDetail.interventions.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 12 }}>Aucune intervention.</div>
            ) : (
              actifDetail.interventions.map((iv) => (
                <div key={iv.id} style={{ borderTop: '1px solid #F1F5F9', padding: '8px 0', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {ivBadge(iv.statut)}
                  <span style={{ fontWeight: 600 }}>{IV_TYPE_LIBELLE[iv.type] ?? iv.type}</span>
                  <span style={{ flex: 1, minWidth: 120 }}>{iv.description}</span>
                  {iv.cout > 0 && <span style={{ color: '#64748B', whiteSpace: 'nowrap' }}>{fcfa(iv.cout)}</span>}
                  <span style={{ color: '#94A3B8', fontSize: 11, whiteSpace: 'nowrap' }}>{jour(iv.dateIntervention)}</span>
                  {peutGerer && (iv.statut === 'ouverte' || iv.statut === 'en_cours') && (
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => cloturerIntervention(iv.id)}
                      style={{ background: '#166534', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                    >
                      ✓ Clôturer
                    </button>
                  )}
                </div>
              ))
            )}

            {fErreur && !ivForm && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setActifDetail(null)} style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
                Fermer
              </button>
              {peutGerer && actifDetail.interventions.length === 0 && (
                <button
                  type="button"
                  onClick={() => demanderSuppressionActif(actifDetail)}
                  style={{ background: '#fff', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  🗑
                </button>
              )}
              {peutGerer && (
                <button
                  type="button"
                  onClick={() => {
                    setActifForm({
                      id: actifDetail.id,
                      designation: actifDetail.designation,
                      categorie: actifDetail.categorie ?? 'equipement',
                      etat: actifDetail.etat,
                      localisation: actifDetail.localisation ?? '',
                      dateAcquisition: actifDetail.dateAcquisition ? actifDetail.dateAcquisition.slice(0, 10) : '',
                      valeurAcquisition: actifDetail.valeurAcquisition ?? '',
                      dureeAmortAnnees: actifDetail.dureeAmortAnnees ?? '',
                      fournisseur: actifDetail.fournisseur ?? '',
                      affecteA: actifDetail.affecteA ?? '',
                      notes: actifDetail.notes ?? '',
                      actif: actifDetail.actif !== false,
                    });
                    setActifDetail(null);
                  }}
                  style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                >
                  Modifier
                </button>
              )}
            </div>

            {ivForm && (
              <div style={{ marginTop: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 140 }}>
                    <label style={lbl}>Type</label>
                    <select value={ivForm.type} onChange={(e) => setIvForm({ ...ivForm, type: e.target.value })} style={{ ...inp, marginBottom: 10, cursor: 'pointer' }}>
                      {IV_TYPES.map((ty) => (
                        <option key={ty} value={ty}>
                          {IV_TYPE_LIBELLE[ty]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={lbl}>Description</label>
                    <input type="text" value={ivForm.description} onChange={(e) => setIvForm({ ...ivForm, description: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
                  </div>
                  <div style={{ minWidth: 120 }}>
                    <label style={lbl}>Coût</label>
                    <input type="number" min={0} value={ivForm.cout} onChange={(e) => setIvForm({ ...ivForm, cout: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
                  </div>
                </div>
                {fErreur && <p className="error">{fErreur}</p>}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" disabled={enCours} onClick={() => setIvForm(null)} style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    Fermer
                  </button>
                  <button type="button" disabled={enCours} onClick={saveIntervention} style={{ background: '#991B1B', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {ctrForm && (
        <div style={overlayT} onClick={() => !enCours && setCtrForm(null)}>
          <div style={{ ...modalT, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: '#0A1F44' }}>
              {ctrForm.id ? 'Contrat' : '+ Nouveau contrat'}
            </h3>
            <label style={lbl}>Objet</label>
            <input type="text" value={ctrForm.objet} onChange={(e) => setCtrForm({ ...ctrForm, objet: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl}>Type</label>
                <select value={ctrForm.type} onChange={(e) => setCtrForm({ ...ctrForm, type: e.target.value })} style={{ ...inp, marginBottom: 12, cursor: 'pointer' }}>
                  {CTR_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {CTR_TYPE_LIBELLE[ty]}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label style={lbl}>Membre du personnel</label>
                <select value={ctrForm.personnelId} onChange={(e) => setCtrForm({ ...ctrForm, personnelId: e.target.value })} style={{ ...inp, marginBottom: 12, cursor: 'pointer' }}>
                  <option value="">—</option>
                  {personnel.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.prenom} {p.nom}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!ctrForm.personnelId && (
              <>
                <label style={lbl}>Cocontractant</label>
                <input type="text" value={ctrForm.cocontractant} onChange={(e) => setCtrForm({ ...ctrForm, cocontractant: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Début</label>
                <input type="date" value={ctrForm.dateDebut} onChange={(e) => setCtrForm({ ...ctrForm, dateDebut: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Fin</label>
                <input type="date" value={ctrForm.dateFin} onChange={(e) => setCtrForm({ ...ctrForm, dateFin: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>Montant</label>
                <input type="number" min={0} value={ctrForm.montant} onChange={(e) => setCtrForm({ ...ctrForm, montant: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
              </div>
            </div>
            <label style={lbl}>Note</label>
            <input type="text" value={ctrForm.note} onChange={(e) => setCtrForm({ ...ctrForm, note: e.target.value })} style={{ ...inp, marginBottom: 12 }} />
            {ctrForm.id && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 12, cursor: 'pointer', color: '#991B1B' }}>
                <input type="checkbox" checked={ctrForm.resilie} onChange={(e) => setCtrForm({ ...ctrForm, resilie: e.target.checked })} /> Résilié
              </label>
            )}
            {fErreur && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" disabled={enCours} onClick={() => setCtrForm(null)} style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
                Fermer
              </button>
              <button type="button" disabled={enCours} onClick={saveContrat} style={{ background: BRAND, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmation && (
        <div style={{ ...overlayT, zIndex: 1100 }} onClick={() => !enCours && setConfirmation(null)}>
          <div style={modalT} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0A1F44', marginBottom: 10 }}>Confirmer</div>
            <div style={{ fontSize: 14, color: '#334155', marginBottom: 16 }}>{confirmation.message}</div>
            {fErreur && <p className="error">{fErreur}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                disabled={enCours}
                onClick={() => setConfirmation(null)}
                style={{ background: '#fff', border: '1px solid #CBD5E1', padding: '9px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#334155' }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={validerConfirmation}
                style={{ background: '#991B1B', border: 'none', padding: '9px 18px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#fff' }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
