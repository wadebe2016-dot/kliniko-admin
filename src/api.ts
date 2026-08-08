// Communication avec le backend Kliniko (NestJS sur l'EC2)
const API_URL = '/api';

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

export type Utilisateur = {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  roles: string[];
  permissions: string[];
};

// Jeton garde en memoire uniquement (choix de securite retenu :
// un rafraichissement de page oblige a se reconnecter).
let jeton: string | null = null;
let utilisateurCourant: Utilisateur | null = null;

export function getUtilisateur(): Utilisateur | null {
  return utilisateurCourant;
}

// L'utilisateur connecte possede-t-il cette permission ?
export function aPermission(code: string): boolean {
  return utilisateurCourant?.permissions.includes(code) ?? false;
}

export async function login(
  email: string,
  motDePasse: string,
): Promise<Utilisateur> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, motDePasse }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Email ou mot de passe incorrect');
    }
    throw new Error('Erreur lors de la connexion');
  }
  const data = await res.json();
  jeton = data.accessToken;
  utilisateurCourant = data.utilisateur;
  return data.utilisateur;
}

export function logout(): void {
  jeton = null;
  utilisateurCourant = null;
}

// Appel API generique : ajoute le jeton, detecte la session expiree
async function appelApi(
  chemin: string,
  options: RequestInit = {},
): Promise<Response> {
  const res = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${jeton}`,
    },
  });
  if (res.status === 401) {
    logout();
    throw new Error('Session expiree, veuillez vous reconnecter');
  }
  return res;
}

// Extrait un message d'erreur lisible d'une reponse API
async function messageErreur(res: Response, defaut: string): Promise<string> {
  const err = await res.json().catch(() => ({}));
  if (Array.isArray(err.message)) return err.message.join(', ');
  return err.message || defaut;
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export type Patient = {
  id: string;
  recordNumber: string;
  firstName: string;
  lastName: string;
  sex: 'M' | 'F' | 'other' | 'unknown';
  phone?: string | null;
  email?: string | null;
  createdAt: string;
};

// Note : plus de clinicId ici. La clinique est determinee par le jeton
// de l'utilisateur connecte, jamais par le client.
export type NewPatient = {
  recordNumber: string;
  firstName: string;
  lastName: string;
  sex?: 'M' | 'F' | 'other' | 'unknown';
  phone?: string;
  email?: string;
};

// Forme renvoyee par l'API (champs en francais)
type PatientApi = {
  id: string;
  numeroDossier: string;
  nom: string;
  prenom: string | null;
  sexe: 'M' | 'F' | null;
  telephone: string | null;
  createdAt: string;
};

// Traduction API -> interface
function versPatient(p: PatientApi): Patient {
  return {
    id: p.id,
    recordNumber: p.numeroDossier,
    firstName: p.prenom ?? '',
    lastName: p.nom,
    sex: p.sexe ?? 'unknown',
    phone: p.telephone,
    email: null,
    createdAt: p.createdAt,
  };
}

// Recuperer la liste des patients de la clinique de l'utilisateur connecte
export async function getPatients(): Promise<Patient[]> {
  const res = await appelApi('/patients');
  if (!res.ok) throw new Error('Erreur lors du chargement des patients');
  const data: PatientApi[] = await res.json();
  return data.map(versPatient);
}

// Creer un patient
export async function createPatient(data: NewPatient): Promise<Patient> {
  const corps: Record<string, unknown> = {
    numeroDossier: data.recordNumber,
    nom: data.lastName,
    prenom: data.firstName || undefined,
    telephone: data.phone || undefined,
  };
  if (data.sex === 'M' || data.sex === 'F') corps.sexe = data.sex;

  const res = await appelApi('/patients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la creation du patient'),
    );
  }
  return versPatient(await res.json());
}

// ---------------------------------------------------------------------------
// Rendez-vous
// ---------------------------------------------------------------------------

export type StatutRdv = 'planifie' | 'confirme' | 'honore' | 'annule' | 'absent';

export type RendezVous = {
  id: string;
  patientId: string;
  debut: string;
  fin: string | null;
  statut: StatutRdv;
  origine: 'clinique' | 'patient';
  motif: string | null;
  patient: { nom: string; prenom: string | null; numeroDossier: string };
};

// Lister les rendez-vous, periode optionnelle (dates ISO)
export async function getRendezVous(
  du?: string,
  au?: string,
): Promise<RendezVous[]> {
  const params = new URLSearchParams();
  if (du) params.set('du', du);
  if (au) params.set('au', au);
  const q = params.toString();
  const res = await appelApi(`/rendez-vous${q ? '?' + q : ''}`);
  if (!res.ok) throw new Error('Erreur lors du chargement des rendez-vous');
  return res.json();
}

// Creer un rendez-vous
export async function createRendezVous(data: {
  praticienId?: string;
  patientId: string;
  debut: string;
  fin?: string;
  motif?: string;
}): Promise<RendezVous> {
  const res = await appelApi('/rendez-vous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la creation du rendez-vous'),
    );
  }
  return res.json();
}

// Changer le statut d'un rendez-vous (confirme, honore, absent...)
export async function changerStatutRendezVous(
  id: string,
  statut: StatutRdv,
): Promise<RendezVous> {
  const res = await appelApi(`/rendez-vous/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statut }),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors du changement de statut'),
    );
  }
  return res.json();
}

// Annuler un rendez-vous (changement de statut cote serveur)
export async function annulerRendezVous(id: string): Promise<RendezVous> {
  const res = await appelApi(`/rendez-vous/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(await messageErreur(res, "Erreur lors de l'annulation"));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Facturation
// ---------------------------------------------------------------------------

export type Acte = {
  id: string;
  code: string;
  libelle: string;
  tarif: number | null;
  devise: string;
};

export type StatutFacture = 'ouverte' | 'partielle' | 'reglee' | 'annulee';

export type LigneFacture = {
  id: string;
  libelle: string;
  quantite: number;
  prixUnitaire: string | number;
  montant: string | number;
};

export type Paiement = {
  id: string;
  montant: string | number;
  moyen: 'especes' | 'mobile_money';
  datePaiement: string;
};

export type Facture = {
  id: string;
  numero: string;
  dateFacture: string;
  montantTotal: string | number;
  montantPaye: string | number;
  devise: string;
  statut: StatutFacture;
  patient: { nom: string; prenom: string | null; numeroDossier: string };
  lignes?: LigneFacture[];
  paiements?: Paiement[];
};

// Catalogue des actes avec tarif en vigueur
export async function getActes(): Promise<Acte[]> {
  const res = await appelApi('/actes');
  if (!res.ok) throw new Error('Erreur lors du chargement des actes');
  return res.json();
}

// Lister les factures
export async function getFactures(): Promise<Facture[]> {
  const res = await appelApi('/factures');
  if (!res.ok) throw new Error('Erreur lors du chargement des factures');
  return res.json();
}

// Detail d'une facture (lignes + paiements)
export async function getFacture(id: string): Promise<Facture> {
  const res = await appelApi(`/factures/${id}`);
  if (!res.ok) throw new Error('Erreur lors du chargement de la facture');
  return res.json();
}

// Creer une facture a partir d'actes du catalogue
export async function createFacture(data: {
  patientId: string;
  lignes: { acteId: string; quantite?: number }[];
}): Promise<Facture> {
  const res = await appelApi('/factures', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la creation de la facture'),
    );
  }
  return res.json();
}

// Encaisser un paiement sur une facture
export async function encaisserFacture(
  id: string,
  data: { montant: number; moyen: 'especes' | 'mobile_money' },
): Promise<Facture> {
  const res = await appelApi(`/factures/${id}/paiements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await messageErreur(res, "Erreur lors de l'encaissement"));
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Consultations (dossier medical)
// ---------------------------------------------------------------------------

export type Consultation = {
  id: string;
  patientId: string;
  dateConsultation: string;
  motif: string | null;
  observations: string | null;
  diagnostic: string | null;
  patient: { nom: string; prenom: string | null; numeroDossier: string };
  praticien: { nom: string; prenom: string | null; specialite: string | null } | null;
  rendezVous: { debut: string; statut: string } | null;
};

// Lister les consultations, filtrables par patient
export async function getConsultations(
  patientId?: string,
): Promise<Consultation[]> {
  const q = patientId ? `?patientId=${patientId}` : '';
  const res = await appelApi(`/consultations${q}`);
  if (!res.ok) throw new Error('Erreur lors du chargement des consultations');
  return res.json();
}

// Creer une consultation (liee ou non a un rendez-vous)
export async function createConsultation(data: {
  patientId: string;
  rendezVousId?: string;
  motif?: string;
  observations?: string;
  diagnostic?: string;
}): Promise<Consultation> {
  const res = await appelApi('/consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la creation de la consultation'),
    );
  }
  return res.json();
}

// Completer ou corriger une consultation
export async function updateConsultation(
  id: string,
  data: { motif?: string; observations?: string; diagnostic?: string },
): Promise<Consultation> {
  const res = await appelApi(`/consultations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la mise a jour'),
    );
  }
  return res.json();
}

// Demander a l'IA une proposition de compte-rendu pour une consultation
export async function suggererCompteRendu(
  id: string,
): Promise<{ suggestion: string }> {
  const res = await appelApi(`/consultations/${id}/suggestion`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, "L'assistant IA est indisponible"),
    );
  }
  return res.json();
}


// ---------------------------------------------------------------------------
// Utilisateurs et mots de passe
// ---------------------------------------------------------------------------

export type Role = { id: string; code: string; libelle: string };

export type UtilisateurGere = {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  actif: boolean;
  derniereConnexion: string | null;
  roles: Role[];
};

// Catalogue des roles de la clinique
export async function getRoles(): Promise<Role[]> {
  const res = await appelApi('/utilisateurs/roles');
  if (!res.ok) throw new Error('Erreur lors du chargement des roles');
  return res.json();
}

export async function getUtilisateurs(): Promise<UtilisateurGere[]> {
  const res = await appelApi('/utilisateurs');
  if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs');
  return res.json();
}

export async function createUtilisateur(data: {
  email: string;
  motDePasse: string;
  nom: string;
  prenom?: string;
  telephone?: string;
  roleIds: string[];
}): Promise<UtilisateurGere> {
  const res = await appelApi('/utilisateurs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la creation du compte'),
    );
  }
  return res.json();
}

export async function updateUtilisateur(
  id: string,
  data: {
    actif?: boolean;
    roleIds?: string[];
    nom?: string;
    prenom?: string;
    telephone?: string;
  },
): Promise<UtilisateurGere> {
  const res = await appelApi(`/utilisateurs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(await messageErreur(res, 'Erreur lors de la modification'));
  }
  return res.json();
}

// Reinitialisation par un administrateur
export async function reinitialiserMotDePasse(
  id: string,
  motDePasse: string,
): Promise<{ message: string }> {
  const res = await appelApi(`/utilisateurs/${id}/mot-de-passe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motDePasse }),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la reinitialisation'),
    );
  }
  return res.json();
}

// Changement par l utilisateur connecte
export async function changerMonMotDePasse(
  ancienMotDePasse: string,
  nouveauMotDePasse: string,
): Promise<{ message: string }> {
  const res = await appelApi('/utilisateurs/moi/mot-de-passe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ancienMotDePasse, nouveauMotDePasse }),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors du changement de mot de passe'),
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Paiement Mobile Money (Campay)
// ---------------------------------------------------------------------------

export type DemandePaiementMobile = {
  paiementId: string;
  reference: string;
  operateur: string | null;
  ussdCode: string | null;
  message: string;
};

// Envoie la demande de paiement sur le telephone du client
export async function demanderPaiementMobile(data: {
  factureId: string;
  montant: number;
  telephone: string;
}): Promise<DemandePaiementMobile> {
  const res = await appelApi('/paiements/mobile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors de la demande de paiement'),
    );
  }
  return res.json();
}

// Demande a Campay le statut reel de la transaction
export async function verifierPaiementMobile(
  reference: string,
): Promise<{ statutPaiement: string; facture: Facture }> {
  const res = await appelApi(`/paiements/${reference}/verifier`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await messageErreur(res, 'Erreur lors de la verification'));
  }
  return res.json();
}

// ----------------------------------------------------------------------------
// Ordonnances et referentiel medicaments
// ----------------------------------------------------------------------------

export type Medicament = {
  id: string;
  code: string | null;
  denomination: string;
  forme: string | null;
  dosage: string | null;
};

export type LigneOrdonnance = {
  id?: string;
  medicamentId?: string | null;
  libelle: string;
  posologie: string;
  duree?: string | null;
  quantite?: string | null;
  voie?: string | null;
  instructions?: string | null;
  ordre?: number;
};

export type Ordonnance = {
  id: string;
  numero: string;
  dateOrdonnance: string;
  statut: 'brouillon' | 'validee' | 'annulee';
  notes: string | null;
  valideeLe: string | null;
  annuleeLe: string | null;
  motifAnnulation: string | null;
  consultationId: string | null;
  hopital: { nom: string; ville: string | null; telephone: string | null };
  patient: {
    id: string;
    numeroDossier: string;
    nom: string;
    prenom: string | null;
    dateNaissance: string | null;
    sexe: string | null;
  };
  praticien: {
    id: string;
    nom: string;
    prenom: string | null;
    specialite: string | null;
  } | null;
  lignes: LigneOrdonnance[];
};

async function echecOrdonnance(res: Response, defaut: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const m = err.message;
  throw new Error(Array.isArray(m) ? m.join(' - ') : m || defaut);
}

export async function listerMedicaments(): Promise<Medicament[]> {
  const res = await appelApi('/medicaments');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des medicaments');
  return res.json();
}

export async function listerOrdonnances(
  patientId?: string,
): Promise<Ordonnance[]> {
  const suffixe = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
  const res = await appelApi(`/ordonnances${suffixe}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des ordonnances');
  return res.json();
}

export async function creerOrdonnance(data: {
  patientId: string;
  consultationId?: string;
  notes?: string;
  valider?: boolean;
  lignes: LigneOrdonnance[];
}): Promise<Ordonnance> {
  const res = await appelApi('/ordonnances', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la creation de l'ordonnance");
  return res.json();
}

export async function validerOrdonnance(id: string): Promise<Ordonnance> {
  const res = await appelApi(`/ordonnances/${id}/valider`, { method: 'POST' });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la validation');
  return res.json();
}

export async function annulerOrdonnance(
  id: string,
  motif?: string,
): Promise<Ordonnance> {
  const res = await appelApi(`/ordonnances/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ motif }),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'annulation");
  return res.json();
}

// ----------------------------------------------------------------------------
// Disponibilites : praticiens, horaires, indisponibilites, creneaux
// ----------------------------------------------------------------------------

export type Praticien = {
  id: string;
  nom: string;
  prenom: string | null;
  specialite: string | null;
};

export type Horaire = {
  id: string;
  praticienId: string;
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
  dureeCreneau: number;
};

export type Indisponibilite = {
  id: string;
  praticienId: string | null;
  debut: string;
  fin: string;
  motif: string | null;
};

export type JourCreneaux = {
  date: string;
  creneaux: { debut: string; fin: string; heure: string }[];
};

export async function getPraticiens(): Promise<Praticien[]> {
  const res = await appelApi('/praticiens');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des praticiens');
  return res.json();
}

export async function getHoraires(praticienId: string): Promise<Horaire[]> {
  const res = await appelApi(`/horaires?praticienId=${encodeURIComponent(praticienId)}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des horaires');
  return res.json();
}

export async function creerHoraire(data: {
  praticienId: string;
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
  dureeCreneau?: number;
}): Promise<Horaire> {
  const res = await appelApi('/horaires', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la creation de l'horaire");
  return res.json();
}

export async function supprimerHoraire(id: string): Promise<void> {
  const res = await appelApi(`/horaires/${id}`, { method: 'DELETE' });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression');
}

export async function getIndisponibilites(
  praticienId: string,
): Promise<Indisponibilite[]> {
  const res = await appelApi(
    `/indisponibilites?praticienId=${encodeURIComponent(praticienId)}`,
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des indisponibilites');
  return res.json();
}

export async function creerIndisponibilite(data: {
  praticienId?: string;
  debut: string;
  fin: string;
  motif?: string;
}): Promise<Indisponibilite> {
  const res = await appelApi('/indisponibilites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la creation de l'indisponibilite");
  return res.json();
}

export async function supprimerIndisponibilite(id: string): Promise<void> {
  const res = await appelApi(`/indisponibilites/${id}`, { method: 'DELETE' });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression');
}

export async function getDisponibilites(
  praticienId: string,
  du: string,
  au: string,
): Promise<{ jours: JourCreneaux[] }> {
  const res = await appelApi(
    `/disponibilites?praticienId=${encodeURIComponent(praticienId)}&du=${du}&au=${au}`,
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du calcul des creneaux');
  return res.json();
}

// ----------------------------------------------------------------------------
// Tableau de bord
// ----------------------------------------------------------------------------

export type RdvProche = {
  id: string;
  debut: string;
  statut: StatutRdv;
  origine: 'clinique' | 'patient';
  motif: string | null;
  patient: { nom: string; prenom: string | null; numeroDossier: string };
  praticien: { nom: string; prenom: string | null } | null;
};

export type TableauDeBordStats = {
  patientsTotal?: number;
  rdvAujourdHui?: number;
  demandesEnAttente?: number;
  prochainsRdv?: RdvProche[];
  encaisseAujourdHui?: number;
  facturesOuvertes?: number;
  montantImpaye?: number;
  consultationsAujourdHui?: number;
};

export async function getTableauDeBord(): Promise<TableauDeBordStats> {
  const res = await appelApi('/stats/tableau-de-bord');
  if (!res.ok) throw new Error('Erreur lors du chargement du tableau de bord');
  return res.json();
}

// ----------------------------------------------------------------------------
// Pharmacie et stock
// ----------------------------------------------------------------------------

export type ArticleStock = {
  id: string;
  code: string | null;
  denomination: string;
  forme: string | null;
  dosage: string | null;
  prixVente: number | null;
  seuilAlerte: number;
  stock: number;
  sousSeuil: boolean;
  peremptionProche: string | null;
};

export type MouvementStock = {
  id: string;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  datePeremption: string | null;
  motif: string | null;
  createdAt: string;
  medicament: { denomination: string; dosage: string | null };
  ordonnance: { numero: string } | null;
  facture: { numero: string } | null;
};

export async function getStockPharmacie(): Promise<ArticleStock[]> {
  const res = await appelApi('/pharmacie/stock');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du stock');
  return res.json();
}

export async function getMouvementsStock(): Promise<MouvementStock[]> {
  const res = await appelApi('/pharmacie/mouvements');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des mouvements');
  return res.json();
}

export async function entreeStock(data: {
  medicamentId: string;
  quantite: number;
  datePeremption?: string;
  prixAchat?: number;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/pharmacie/entrees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'entree de stock");
}

export async function ajustementStock(data: {
  medicamentId: string;
  quantite: number;
  motif: string;
}): Promise<void> {
  const res = await appelApi('/pharmacie/ajustements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'ajustement");
}

export async function dispenserOrdonnance(data: {
  ordonnanceId: string;
  lignes: { medicamentId: string; quantite: number }[];
  facturer?: boolean;
}): Promise<{
  ordonnance: string;
  lignesDispensees: number;
  facture: { id: string; numero: string; montantTotal: number } | null;
}> {
  const res = await appelApi('/pharmacie/dispensations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la dispensation');
  return res.json();
}

// ----------------------------------------------------------------------------
// Hospitalisation : chambres, lits, sejours
// ----------------------------------------------------------------------------

export type LitOccupation = {
  id: string;
  numero: string;
  occupe: boolean;
  sejour: {
    id: string;
    dateEntree: string;
    motif: string;
    patient: { nom: string; prenom: string | null; numeroDossier: string };
  } | null;
};

export type ChambreOccupation = {
  id: string;
  numero: string;
  categorie: string | null;
  tarifJournalier: number | null;
  lits: LitOccupation[];
};

export type Sejour = {
  id: string;
  statut: 'en_cours' | 'terminee' | 'annulee';
  motif: string;
  notes: string | null;
  dateEntree: string;
  dateSortie: string | null;
  patient: { nom: string; prenom: string | null; numeroDossier: string };
  lit: { numero: string; chambre: { numero: string; categorie: string | null } };
  praticien: { nom: string; prenom: string | null } | null;
  facture: { numero: string; montantTotal: number | string } | null;
};

export async function getChambres(): Promise<ChambreOccupation[]> {
  const res = await appelApi('/hospitalisation/chambres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des chambres');
  return res.json();
}

export async function getSejours(): Promise<Sejour[]> {
  const res = await appelApi('/hospitalisation/sejours');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des séjours');
  return res.json();
}

export async function creerChambre(data: {
  numero: string;
  categorie?: string;
  tarifJournalier?: number;
  nbLits: number;
}): Promise<void> {
  const res = await appelApi('/hospitalisation/chambres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création de la chambre');
}

export async function admettrePatient(data: {
  patientId: string;
  litId: string;
  praticienId?: string;
  motif: string;
  notes?: string;
}): Promise<void> {
  const res = await appelApi('/hospitalisation/admissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'admission");
}

export async function sortirPatient(data: {
  hospitalisationId: string;
  facturer?: boolean;
}): Promise<{
  jours: number;
  facture: { id: string; numero: string; montantTotal: number } | null;
}> {
  const res = await appelApi('/hospitalisation/sorties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la sortie');
  return res.json();
}

export async function annulerSejour(data: {
  hospitalisationId: string;
  motif: string;
}): Promise<void> {
  const res = await appelApi('/hospitalisation/annulations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'annulation du séjour");
}

export async function modifierChambre(
  chambreId: string,
  data: {
    numero?: string;
    categorie?: string;
    tarifJournalier?: number;
    nbLits?: number;
  },
): Promise<void> {
  const res = await appelApi(
    `/hospitalisation/chambres/${encodeURIComponent(chambreId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la modification de la chambre');
}

export async function supprimerChambre(chambreId: string): Promise<void> {
  const res = await appelApi(
    `/hospitalisation/chambres/${encodeURIComponent(chambreId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression de la chambre');
}

// ----------------------------------------------------------------------------
// Consommables : stock non medical par mouvements
// ----------------------------------------------------------------------------

export type ArticleConsommable = {
  id: string;
  code: string | null;
  designation: string;
  unite: string | null;
  seuilAlerte: number;
  prixUnitaire: number | null;
  stock: number;
  sousSeuil: boolean;
  peremptionProche: string | null;
};

export type MouvementConsommable = {
  id: string;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  datePeremption: string | null;
  motif: string | null;
  createdAt: string;
  consommable: { designation: string; unite: string | null };
};

export async function getStockConsommables(): Promise<ArticleConsommable[]> {
  const res = await appelApi('/consommables/stock');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du stock');
  return res.json();
}

export async function getMouvementsConsommables(): Promise<MouvementConsommable[]> {
  const res = await appelApi('/consommables/mouvements');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des mouvements');
  return res.json();
}

export async function creerConsommable(data: {
  designation: string;
  code?: string;
  unite?: string;
  seuilAlerte?: number;
  prixUnitaire?: number;
}): Promise<void> {
  const res = await appelApi('/consommables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du consommable');
}

export async function entreeConsommable(data: {
  consommableId: string;
  quantite: number;
  datePeremption?: string;
  prixAchat?: number;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/consommables/entrees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'entrée de stock");
}

export async function sortieConsommable(data: {
  consommableId: string;
  quantite: number;
  motif: string;
}): Promise<void> {
  const res = await appelApi('/consommables/sorties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la sortie');
}

export async function ajustementConsommable(data: {
  consommableId: string;
  quantite: number;
  motif: string;
}): Promise<void> {
  const res = await appelApi('/consommables/ajustements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'ajustement");
}

export async function modifierLignesFacture(
  factureId: string,
  data: { lignes: { ligneId: string; quantite: number }[] },
): Promise<Facture> {
  const res = await appelApi(
    `/factures/${encodeURIComponent(factureId)}/lignes`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la modification de la facture');
  return res.json();
}

export async function annulerFacture(
  factureId: string,
  motif: string,
): Promise<Facture> {
  const res = await appelApi(
    `/factures/${encodeURIComponent(factureId)}/annulation`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motif }),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'annulation de la facture");
  return res.json();
}

// ----------------------------------------------------------------------------
// Tarifs : la mercuriale des prix (actes dates, prix des medicaments)
// ----------------------------------------------------------------------------

export type ActeTarif = {
  id: string;
  code: string;
  libelle: string;
  tarif: number | null;
  devise: string;
  depuis: string | null;
};

export type MedicamentPrix = {
  id: string;
  code: string | null;
  denomination: string;
  dosage: string | null;
  forme: string | null;
  prixVente: number | null;
};

export async function getTarifsActes(): Promise<ActeTarif[]> {
  const res = await appelApi('/tarifs/actes');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des actes');
  return res.json();
}

export async function creerActe(data: {
  code: string;
  libelle: string;
  montant?: number;
}): Promise<void> {
  const res = await appelApi('/tarifs/actes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la création de l'acte");
}

export async function modifierActe(
  acteId: string,
  data: { libelle: string },
): Promise<void> {
  const res = await appelApi(`/tarifs/actes/${encodeURIComponent(acteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la modification de l'acte");
}

export async function nouveauTarifActe(
  acteId: string,
  data: { montant: number },
): Promise<void> {
  const res = await appelApi(
    `/tarifs/actes/${encodeURIComponent(acteId)}/tarif`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du changement de tarif');
}

export async function getTarifsMedicaments(): Promise<MedicamentPrix[]> {
  const res = await appelApi('/tarifs/medicaments');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des médicaments');
  return res.json();
}

export async function modifierPrixMedicament(
  medicamentId: string,
  data: { prixVente: number },
): Promise<void> {
  const res = await appelApi(
    `/tarifs/medicaments/${encodeURIComponent(medicamentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du changement de prix');
}

export async function creerMedicament(data: {
  denomination: string;
  dosage?: string;
  forme?: string;
  code?: string;
  prixVente?: number;
  seuilAlerte?: number;
}): Promise<void> {
  const res = await appelApi('/tarifs/medicaments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du médicament');
}

// ----------------------------------------------------------------------------
// Patrimoine : les actifs de la clinique et leur journal
// ----------------------------------------------------------------------------

export type EtatActif = 'en_service' | 'en_maintenance' | 'en_panne' | 'reforme';

export type Actif = {
  id: string;
  code: string | null;
  designation: string;
  categorie: string | null;
  localisation: string | null;
  dateAcquisition: string | null;
  valeurAcquisition: number | null;
  dureeAmortAnnees: number | null;
  valeurResiduelle: number | null;
  etat: EtatActif;
  notes: string | null;
  createdAt: string;
};

export type EvenementActif = {
  id: string;
  type: string;
  detail: string | null;
  createdAt: string;
  actif: { designation: string; code: string | null };
};

export async function getActifs(): Promise<Actif[]> {
  const res = await appelApi('/patrimoine/actifs');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du patrimoine');
  return res.json();
}

export async function getEvenementsActifs(): Promise<EvenementActif[]> {
  const res = await appelApi('/patrimoine/evenements');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du journal');
  return res.json();
}

export async function creerActif(data: {
  designation: string;
  code?: string;
  categorie?: string;
  localisation?: string;
  dateAcquisition?: string;
  valeurAcquisition?: number;
  notes?: string;
}): Promise<void> {
  const res = await appelApi('/patrimoine/actifs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la création de l'actif");
}

export async function modifierActif(
  actifId: string,
  data: {
    designation?: string;
    categorie?: string;
    localisation?: string;
    valeurAcquisition?: number;
    dureeAmortAnnees?: number;
    notes?: string;
  },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la modification de l'actif");
}

export async function changerEtatActif(
  actifId: string,
  data: { etat: EtatActif; motif: string },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}/etat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du changement d'état");
}
