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
  // Volet chaine caisse : present sur les rendez-vous pris en ligne.
  // L'etat "paye, pret pour pre-consultation" se DEDUIT de la facture liee.
  montantPrevu?: string | number | null;
  modePaiement?: 'momo' | 'especes' | null;
  acte?: { code: string; libelle: string } | null;
  assurance?: { nom: string } | null;
  facture?: {
    id: string;
    numero: string;
    statut: StatutFacture;
    montantTotal: string | number;
    montantPaye: string | number;
  } | null;
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
  note: string | null;
  actif: boolean;
  peremptionProche: string | null;
};

export type MouvementConsommable = {
  id: string;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  datePeremption: string | null;
  motif: string | null;
  createdAt: string;
  dateMouvement: string;
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
  note?: string;
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
  date?: string;
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
  date?: string;
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
// Patrimoine : actifs, interventions de maintenance et contrats
// ----------------------------------------------------------------------------

export type EtatActif = 'bon' | 'moyen' | 'en_reparation' | 'hors_service' | 'cede';

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
  etat: string;
  fournisseur: string | null;
  affecteA: string | null;
  affecte: { nom: string; prenom: string | null } | null;
  notes: string | null;
  actif: boolean;
  interventionsOuvertes: number;
  createdAt: string;
};

export type InterventionActif = {
  id: string;
  type: string;
  description: string;
  cout: number;
  statut: string;
  dateIntervention: string;
  createdAt: string;
};

export type ActifDetail = Actif & { interventions: InterventionActif[] };

export type Contrat = {
  id: string;
  type: string;
  objet: string;
  cocontractant: string | null;
  personnelId: string | null;
  personnel: { nom: string; prenom: string | null } | null;
  reference: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  montant: number;
  resilie: boolean;
  note: string | null;
  statutTemporel: string;
  joursRestants: number | null;
};

export async function getActifs(
  categorie?: string,
  etat?: string,
): Promise<Actif[]> {
  const params = new URLSearchParams();
  if (categorie) params.set('categorie', categorie);
  if (etat) params.set('etat', etat);
  const q = params.toString();
  const res = await appelApi(`/patrimoine/actifs${q ? `?${q}` : ''}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du patrimoine');
  return res.json();
}

export async function getActifDetail(id: string): Promise<ActifDetail> {
  const res = await appelApi(`/patrimoine/actifs/${encodeURIComponent(id)}`);
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du chargement de l'actif");
  return res.json();
}

export async function creerActif(data: {
  designation: string;
  categorie?: string;
  localisation?: string;
  etat?: string;
  dateAcquisition?: string;
  valeurAcquisition?: number;
  dureeAmortAnnees?: number;
  fournisseur?: string;
  affecteA?: string;
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
    etat?: string;
    dateAcquisition?: string;
    valeurAcquisition?: number;
    dureeAmortAnnees?: number;
    fournisseur?: string;
    affecteA?: string;
    notes?: string;
    actif?: boolean;
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

export async function supprimerActif(actifId: string): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la suppression de l'actif");
}

export async function creerIntervention(
  actifId: string,
  data: { type?: string; description: string; cout?: number; date?: string },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}/interventions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la création de l'intervention");
}

export async function majIntervention(
  interventionId: string,
  data: { statut?: string; cout?: number; description?: string },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/interventions/${encodeURIComponent(interventionId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la mise à jour de l'intervention");
}

export async function getContrats(type?: string): Promise<Contrat[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  const res = await appelApi(`/patrimoine/contrats${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des contrats');
  return res.json();
}

export async function creerContrat(data: {
  type?: string;
  objet: string;
  cocontractant?: string;
  personnelId?: string;
  dateDebut?: string;
  dateFin?: string;
  montant?: number;
  note?: string;
}): Promise<void> {
  const res = await appelApi('/patrimoine/contrats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du contrat');
}

export async function modifierContrat(
  contratId: string,
  data: {
    type?: string;
    objet?: string;
    cocontractant?: string;
    personnelId?: string;
    dateDebut?: string;
    dateFin?: string;
    montant?: number;
    note?: string;
    resilie?: boolean;
  },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/contrats/${encodeURIComponent(contratId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la modification du contrat');
}

export async function supprimerContrat(contratId: string): Promise<void> {
  const res = await appelApi(
    `/patrimoine/contrats/${encodeURIComponent(contratId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression du contrat');
}

// ----------------------------------------------------------------------------
// Personnel : fiche de base pour tous, volet RH sensible pour personnel.rh
// ----------------------------------------------------------------------------

export type StatutPersonnel = 'actif' | 'conge' | 'suspendu' | 'parti';

export type MembrePersonnel = {
  id: string;
  matricule: string | null;
  nom: string;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  fonction: string;
  service: string | null;
  statut: StatutPersonnel;
  // presents uniquement si le jeton porte personnel.rh
  typeContrat?: string | null;
  dateEmbauche?: string | null;
  salaireBase?: number | null;
};

export type FicheRh = MembrePersonnel & {
  dateNaissance: string | null;
  sexe: 'M' | 'F' | null;
  adresse: string | null;
  cni: string | null;
  numeroCnps: string | null;
  niu: string | null;
  situationFamille: string | null;
  typeContrat: string | null;
  dateEmbauche: string | null;
  dateFinContrat: string | null;
  salaireBase: number | null;
  diplome: string | null;
  contactUrgenceNom: string | null;
  contactUrgenceTel: string | null;
};

export async function getPersonnel(): Promise<MembrePersonnel[]> {
  const res = await appelApi('/personnel');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du personnel');
  return res.json();
}

export async function getFicheRh(personnelId: string): Promise<FicheRh> {
  const res = await appelApi(`/personnel/${encodeURIComponent(personnelId)}/rh`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement de la fiche RH');
  return res.json();
}

export async function creerPersonnel(data: {
  nom: string;
  fonction: string;
  prenom?: string;
  matricule?: string;
  telephone?: string;
  email?: string;
  service?: string;
}): Promise<void> {
  const res = await appelApi('/personnel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création de la fiche');
}

export async function modifierPersonnel(
  personnelId: string,
  data: {
    nom?: string;
    fonction?: string;
    prenom?: string;
    matricule?: string;
    telephone?: string;
    email?: string;
    service?: string;
    statut?: StatutPersonnel;
  },
): Promise<void> {
  const res = await appelApi(`/personnel/${encodeURIComponent(personnelId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la modification de la fiche');
}

export async function modifierFicheRh(
  personnelId: string,
  data: {
    dateNaissance?: string;
    sexe?: 'M' | 'F';
    adresse?: string;
    cni?: string;
    numeroCnps?: string;
    niu?: string;
    situationFamille?: string;
    typeContrat?: string;
    dateEmbauche?: string;
    dateFinContrat?: string;
    salaireBase?: number;
    diplome?: string;
    contactUrgenceNom?: string;
    contactUrgenceTel?: string;
  },
): Promise<void> {
  const res = await appelApi(
    `/personnel/${encodeURIComponent(personnelId)}/rh`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la mise à jour du volet RH');
}

export type TableauRh = {
  effectif: number;
  masseSalariale: number;
  contratsEcheance: {
    nom: string;
    prenom: string | null;
    fonction: string;
    typeContrat: string | null;
    dateFinContrat: string | null;
  }[];
  parContrat: { cle: string; nombre: number }[];
  parSexe: { cle: string; nombre: number }[];
  masseParFonction: { fonction: string; masse: number }[];
};

export async function getTableauRh(): Promise<TableauRh> {
  const res = await appelApi('/personnel/tableau-de-bord');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du tableau RH');
  return res.json();
}

// ----------------------------------------------------------------------------
// Tresorerie : comptes, categories, mouvements
// ----------------------------------------------------------------------------

export type CompteTresorerie = {
  id: string;
  nom: string;
  type: 'caisse' | 'banque' | 'mobile_money';
  solde: number;
};

export type CategorieTresorerie = {
  id: string;
  nom: string;
  sens: 'recette' | 'depense';
};

export type MouvementTresorerie = {
  id: string;
  type: 'recette' | 'depense' | 'transfert';
  libelle: string;
  beneficiaire: string | null;
  montant: number | string;
  dateMouvement: string;
  factureId: string | null;
  compte: { nom: string };
  compteDest: { nom: string } | null;
  categorie: { nom: string } | null;
};

export async function getComptesTresorerie(): Promise<CompteTresorerie[]> {
  const res = await appelApi('/tresorerie/comptes');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des comptes');
  return res.json();
}

export async function getCategoriesTresorerie(): Promise<CategorieTresorerie[]> {
  const res = await appelApi('/tresorerie/categories');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des catégories');
  return res.json();
}

export async function getMouvementsTresorerie(
  du?: string,
  au?: string,
): Promise<MouvementTresorerie[]> {
  const q = new URLSearchParams();
  if (du) q.set('du', du);
  if (au) q.set('au', au);
  const res = await appelApi(`/tresorerie/mouvements?${q.toString()}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des mouvements');
  return res.json();
}

export async function creerCompteTresorerie(data: {
  nom: string;
  type: 'caisse' | 'banque' | 'mobile_money';
}): Promise<void> {
  const res = await appelApi('/tresorerie/comptes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du compte');
}

export async function creerCategorieTresorerie(data: {
  nom: string;
  sens: 'recette' | 'depense';
}): Promise<void> {
  const res = await appelApi('/tresorerie/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création de la catégorie');
}

type DonneesMouvement = {
  compteId: string;
  categorieId?: string;
  libelle: string;
  beneficiaire?: string;
  montant: number;
  date?: string;
};

export async function creerRecette(data: DonneesMouvement): Promise<void> {
  const res = await appelApi('/tresorerie/recettes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement de la recette");
}

export async function creerDepense(data: DonneesMouvement): Promise<void> {
  const res = await appelApi('/tresorerie/depenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement de la dépense");
}

export async function creerTransfert(data: {
  compteId: string;
  compteDestId: string;
  montant: number;
  libelle?: string;
  date?: string;
}): Promise<void> {
  const res = await appelApi('/tresorerie/transferts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du transfert');
}

export async function supprimerMouvement(mouvementId: string): Promise<void> {
  const res = await appelApi(
    `/tresorerie/mouvements/${encodeURIComponent(mouvementId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression');
}

// ----------------------------------------------------------------------------
// Controle de gestion : budget annuel par categorie
// ----------------------------------------------------------------------------

export type LigneBudgetResume = {
  id: string | null;
  categorie: { id: string; nom: string; sens: 'recette' | 'depense' };
  prevu: number;
  realise: number;
  ecart: number;
  consomme: number;
};

export type BudgetResume = {
  annee: number;
  lignes: LigneBudgetResume[];
  totaux: {
    recettesPrevu: number;
    recettesRealise: number;
    depensesPrevu: number;
    depensesRealise: number;
    execution: number;
    realisation: number;
    marge: number;
    depassements: number;
  };
};

export async function getBudget(annee: number): Promise<BudgetResume> {
  const res = await appelApi(`/tresorerie/budget?annee=${annee}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du budget');
  return res.json();
}

export async function definirLigneBudget(data: {
  annee: number;
  categorieId: string;
  montantPrevu: number;
}): Promise<void> {
  const res = await appelApi('/tresorerie/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du budget");
}

export async function supprimerLigneBudget(ligneId: string): Promise<void> {
  const res = await appelApi(
    `/tresorerie/budget/${encodeURIComponent(ligneId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression de la ligne');
}

// ----------------------------------------------------------------------------
// Analytique : centres de cout et cout par patient
// ----------------------------------------------------------------------------

export type CentreCout = {
  id: string;
  code: string;
  nom: string;
};

export type LigneAnalytique = {
  id: string | null;
  code: string | null;
  nom: string;
  actif: boolean;
  depenses: number;
  recettes: number;
  marge: number;
  ecritures: number;
  part: number;
  coutParPatient: number;
};

export type AnalytiqueResume = {
  nbPatients: number;
  lignes: LigneAnalytique[];
  nonImpute: LigneAnalytique;
  totaux: {
    depenses: number;
    recettes: number;
    ecritures: number;
    coutParPatient: number;
    coutMedicalParPatient: number;
    coutAdminParPatient: number;
  };
};

export async function getCentresCout(): Promise<CentreCout[]> {
  const res = await appelApi('/tresorerie/centres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des centres');
  return res.json();
}

export async function creerCentreCout(data: {
  code: string;
  nom: string;
}): Promise<CentreCout> {
  const res = await appelApi('/tresorerie/centres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la creation du centre');
  return res.json();
}

export async function getAnalytique(
  du?: string,
  au?: string,
): Promise<AnalytiqueResume> {
  const params = new URLSearchParams();
  if (du) params.set('du', du);
  if (au) params.set('au', au);
  const q = params.toString();
  const res = await appelApi(`/tresorerie/analytique${q ? `?${q}` : ''}`);
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du chargement de l'analytique");
  return res.json();
}

export async function supprimerMouvementConsommable(id: string): Promise<void> {
  const res = await appelApi(
    `/consommables/mouvements/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression du mouvement');
}

export async function modifierConsommable(
  id: string,
  data: {
    designation?: string;
    unite?: string;
    seuilAlerte?: number;
    note?: string;
    actif?: boolean;
  },
): Promise<void> {
  const res = await appelApi(`/consommables/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la modification de l'article");
}

export async function supprimerConsommable(id: string): Promise<void> {
  const res = await appelApi(`/consommables/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la suppression de l'article");
}

// ----------------------------------------------------------------------------
// Paie : bulletins, versements, parametres CNPS / IRPP
// ----------------------------------------------------------------------------

export type ParametresPaie = {
  tauxCnpsSalarial: number;
  plafondCnps: number;
  abattementFraisPct: number;
  cacPct: number;
};

export type TrancheIrpp = {
  borneMin: number;
  borneMax: number | null;
  taux: number;
};

export type BulletinPaie = {
  id: string;
  personnelId: string;
  mois: number;
  annee: number;
  salaireBase: number;
  totalPrimes: number;
  primesDetail: string | null;
  brut: number;
  cnps: number;
  irpp: number;
  cac: number;
  autresRetenues: number;
  net: number;
  statutVersement: 'paye' | 'en_attente';
  dateVersement: string | null;
  modeVersement: string | null;
  genereLe: string;
  personnel: {
    nom: string;
    prenom: string | null;
    fonction: string | null;
    matricule: string | null;
    service: string | null;
    typeContrat: string | null;
    dateEmbauche: string | null;
    numeroCnps: string | null;
    niu: string | null;
    situationFamille: string | null;
  };
};

export async function getParametresPaie(): Promise<{
  parametres: ParametresPaie;
  tranches: TrancheIrpp[];
}> {
  const res = await appelApi('/paie/parametres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des paramètres');
  return res.json();
}

export async function majParametresPaie(data: ParametresPaie): Promise<void> {
  const res = await appelApi('/paie/parametres', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement des paramètres");
}

export async function majTranchesIrpp(tranches: TrancheIrpp[]): Promise<void> {
  const res = await appelApi('/paie/tranches', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tranches }),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du barème");
}

export async function getBulletinsPaie(
  mois: number,
  annee: number,
): Promise<BulletinPaie[]> {
  const res = await appelApi(`/paie/bulletins?mois=${mois}&annee=${annee}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des bulletins');
  return res.json();
}

export async function genererBulletin(data: {
  personnelId: string;
  mois: number;
  annee: number;
  primes?: { libelle: string; montant: number }[];
}): Promise<void> {
  const res = await appelApi('/paie/bulletins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la génération du bulletin');
}

export async function genererBulletinsTous(
  mois: number,
  annee: number,
): Promise<{ generes: number; ignores: number; total: number }> {
  const res = await appelApi('/paie/bulletins/tous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mois, annee }),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la génération');
  return res.json();
}

export async function supprimerBulletin(id: string): Promise<void> {
  const res = await appelApi(`/paie/bulletins/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression du bulletin');
}

export async function versementBulletin(
  id: string,
  data: {
    statut: 'paye' | 'en_attente';
    dateVersement?: string;
    modeVersement?: 'virement' | 'momo' | 'especes';
  },
): Promise<void> {
  const res = await appelApi(
    `/paie/bulletins/${encodeURIComponent(id)}/versement`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du versement");
}

export async function versementLotPaie(data: {
  mois: number;
  annee: number;
  dateVersement?: string;
  modeVersement?: 'virement' | 'momo' | 'especes';
}): Promise<{ nbPayes: number }> {
  const res = await appelApi('/paie/versements/lot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du versement en lot');
  return res.json();
}

export async function simulerPaie(data: {
  salaireBase: number;
  totalPrimes?: number;
}): Promise<{
  brut: number;
  cnps: number;
  irpp: number;
  cac: number;
  baseImposable: number;
  net: number;
}> {
  const res = await appelApi('/paie/simuler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la simulation');
  return res.json();
}

// ----------------------------------------------------------------------------
// Conges : demandes, validation et soldes annuels
// ----------------------------------------------------------------------------

export type DemandeConge = {
  id: string;
  personnelId: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  nbJoursOuvrables: number;
  motif: string | null;
  statut: 'en_attente' | 'approuve' | 'refuse';
  commentaireValidation: string | null;
  valideLe: string | null;
  createdAt: string;
  personnel: {
    nom: string;
    prenom: string | null;
    fonction: string | null;
    matricule: string | null;
  };
};

export type SoldesConges = {
  annee: number;
  joursAcquisAnnuel: number;
  soldes: {
    personnelId: string;
    nom: string;
    prenom: string | null;
    fonction: string | null;
    matricule: string | null;
    acquis: number;
    pris: number;
    restant: number;
  }[];
};

export async function getDemandesConges(
  statut?: string,
): Promise<DemandeConge[]> {
  const q = statut ? `?statut=${encodeURIComponent(statut)}` : '';
  const res = await appelApi(`/conges${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des demandes');
  return res.json();
}

export async function getSoldesConges(annee?: number): Promise<SoldesConges> {
  const q = annee ? `?annee=${annee}` : '';
  const res = await appelApi(`/conges/soldes${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des soldes');
  return res.json();
}

export async function getParametresConges(): Promise<{
  joursAcquisAnnuel: number;
}> {
  const res = await appelApi('/conges/parametres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des paramètres');
  return res.json();
}

export async function majParametresConges(data: {
  joursAcquisAnnuel: number;
}): Promise<void> {
  const res = await appelApi('/conges/parametres', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du paramètre");
}

export async function creerDemandeConge(data: {
  personnelId: string;
  type?: string;
  dateDebut: string;
  dateFin: string;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/conges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création de la demande');
}

export async function statuerDemandeConge(
  id: string,
  data: { statut: 'approuve' | 'refuse'; commentaire?: string },
): Promise<void> {
  const res = await appelApi(`/conges/${encodeURIComponent(id)}/statut`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la décision');
}

export async function supprimerDemandeConge(id: string): Promise<void> {
  const res = await appelApi(`/conges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression de la demande');
}

// ----------------------------------------------------------------------------
// Mon espace : les donnees de l'utilisateur connecte uniquement
// ----------------------------------------------------------------------------

export type MonApercu = {
  lie: boolean;
  personnel?: {
    nom: string;
    prenom: string | null;
    fonction: string | null;
    service: string | null;
    matricule: string | null;
    dateEmbauche: string | null;
    typeContrat: string | null;
  };
  conges?: {
    annee: number;
    acquis: number;
    pris: number;
    restant: number;
    enAttente: number;
  };
  bulletins?: {
    nb: number;
    dernier: { mois: number; annee: number; statutVersement: string } | null;
  };
};

export type MesConges = {
  solde: { annee: number; acquis: number; pris: number; restant: number };
  demandes: DemandeConge[];
};

export async function getMonApercu(): Promise<MonApercu> {
  const res = await appelApi('/moi/apercu');
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du chargement de l'espace");
  return res.json();
}

export async function getMesConges(): Promise<MesConges> {
  const res = await appelApi('/moi/conges');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement de vos congés');
  return res.json();
}

export async function creerMaDemandeConge(data: {
  type?: string;
  dateDebut: string;
  dateFin: string;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/moi/conges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'envoi de la demande");
}

export async function getMesBulletins(annee?: number): Promise<BulletinPaie[]> {
  const q = annee ? `?annee=${annee}` : '';
  const res = await appelApi(`/moi/bulletins${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement de vos bulletins');
  return res.json();
}

// ---------------------------------------------------------------------------
// Pre-consultations : les constantes prises par l'infirmiere avant la
// consultation. Jamais modifiees apres coup — on en reprend une si besoin.
// ---------------------------------------------------------------------------

export type PreConsultation = {
  id: string;
  patientId: string;
  rendezVousId: string | null;
  datePrise: string;
  tensionSys: number | null;
  tensionDia: number | null;
  temperature: string | number | null;
  poids: string | number | null;
  taille: number | null;
  pouls: number | null;
  saturation: number | null;
  notes: string | null;
  patient: { nom: string; prenom: string | null; numeroDossier: string };
  utilisateur: { nom: string; prenom: string | null } | null;
  rendezVous: { id: string; debut: string } | null;
};

// Lister : par patient (dossier), ou par periode (file du jour)
export async function getPreConsultations(
  patientId?: string,
  du?: string,
  au?: string,
): Promise<PreConsultation[]> {
  const params = new URLSearchParams();
  if (patientId) params.set('patientId', patientId);
  if (du) params.set('du', du);
  if (au) params.set('au', au);
  const q = params.toString();
  const res = await appelApi(`/pre-consultations${q ? '?' + q : ''}`);
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, 'Erreur lors du chargement des pré-consultations'),
    );
  }
  return res.json();
}

// Prendre les parametres d'un patient (avec ou sans rendez-vous lie)
export async function createPreConsultation(data: {
  patientId: string;
  rendezVousId?: string;
  tensionSys?: number;
  tensionDia?: number;
  temperature?: number;
  poids?: number;
  taille?: number;
  pouls?: number;
  saturation?: number;
  notes?: string;
}): Promise<PreConsultation> {
  const res = await appelApi('/pre-consultations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(
      await messageErreur(res, "Erreur lors de l'enregistrement des paramètres"),
    );
  }
  return res.json();
}
