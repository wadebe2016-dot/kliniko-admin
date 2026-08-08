# Ajoute le bloc Patrimoine a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_patrimoine.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getActifs")) {
  Write-Host "DEJA   le bloc patrimoine existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc patrimoine ajoute"
Write-Host ("Controle : getActifs = " + ([regex]::Matches($s, "export async function getActifs")).Count + " (attendu 1)")
