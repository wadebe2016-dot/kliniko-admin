# Ajoute modifierLignesFacture / annulerFacture a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_edition_factures.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("modifierLignesFacture")) {
  Write-Host "DEJA   modifierLignesFacture existe - rien a faire."
  exit 0
}

$bloc = @'

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
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     fonctions ajoutees"
Write-Host ("Controle : modifierLignesFacture = " + ([regex]::Matches($s, "export async function modifierLignesFacture")).Count + " (attendu 1)")
