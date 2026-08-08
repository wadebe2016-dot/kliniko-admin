# Ajoute modifierChambre / supprimerChambre a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_chambres.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("modifierChambre")) {
  Write-Host "DEJA   modifierChambre existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     fonctions ajoutees"
Write-Host ("Controle : modifierChambre = " + ([regex]::Matches($s, "modifierChambre")).Count + " occurrence (attendu 1)")
