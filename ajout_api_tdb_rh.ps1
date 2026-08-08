# Ajoute getTableauRh a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_tdb_rh.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getTableauRh")) {
  Write-Host "DEJA   getTableauRh existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     fonction ajoutee"
Write-Host ("Controle : getTableauRh = " + ([regex]::Matches($s, "export async function getTableauRh")).Count + " (attendu 1)")
