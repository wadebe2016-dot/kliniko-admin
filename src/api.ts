// Communication avec le backend Kliniko (NestJS sur l'EC2)
const API_URL = 'http://35.180.88.49';

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
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erreur lors de la creation du patient');
  }
  return versPatient(await res.json());
}
