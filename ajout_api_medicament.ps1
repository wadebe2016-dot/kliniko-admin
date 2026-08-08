# Ajoute creerMedicament a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_medicament.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("creerMedicament")) {
  Write-Host "DEJA   creerMedicament existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     fonction ajoutee"
Write-Host ("Controle : creerMedicament = " + ([regex]::Matches($s, "export async function creerMedicament")).Count + " (attendu 1)")
