// Communication avec le backend Kliniko (NestJS sur le port 3000)

const API_URL = 'http://localhost:3000';

// L'identifiant de la clinique de démo (à remplacer plus tard par la clinique connectée)
export const CLINIC_ID = 'f82fafd7-7a52-4a26-895b-4f508ae0baad';

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

export type NewPatient = {
  clinicId: string;
  recordNumber: string;
  firstName: string;
  lastName: string;
  sex?: 'M' | 'F' | 'other' | 'unknown';
  phone?: string;
  email?: string;
};

// Récupérer la liste des patients d'une clinique
export async function getPatients(): Promise<Patient[]> {
  const res = await fetch(`${API_URL}/patients?clinicId=${CLINIC_ID}`);
  if (!res.ok) throw new Error('Erreur lors du chargement des patients');
  return res.json();
}

// Créer un patient
export async function createPatient(data: NewPatient): Promise<Patient> {
  const res = await fetch(`${API_URL}/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erreur lors de la création du patient');
  }
  return res.json();
}
