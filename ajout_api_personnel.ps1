# Ajoute le bloc Personnel a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_personnel.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getPersonnel")) {
  Write-Host "DEJA   le bloc personnel existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc personnel ajoute"
Write-Host ("Controle : getPersonnel = " + ([regex]::Matches($s, "export async function getPersonnel")).Count + " (attendu 1)")
