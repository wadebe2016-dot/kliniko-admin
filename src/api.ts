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
