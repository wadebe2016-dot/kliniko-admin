# Ajoute le bloc Hospitalisation a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_hospitalisation.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getChambres")) {
  Write-Host "DEJA   le bloc hospitalisation existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc hospitalisation ajoute"
Write-Host ("Controle : getChambres = " + ([regex]::Matches($s, "getChambres")).Count + " occurrence (attendu 1)")
