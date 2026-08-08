# Met a jour le bloc Consommables de src\api.ts (kliniko-admin) :
# date des mouvements + suppression d'un mouvement. Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\maj_api_stocks.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("supprimerMouvementConsommable")) {
  Write-Host "DEJA   la mise a jour stocks existe - rien a faire."
  exit 0
}

# 1. dateMouvement dans le type MouvementConsommable
$ancre = '  consommable: { designation: string; unite: string | null };'
$n = ([regex]::Matches($s, [regex]::Escape($ancre))).Count
if ($n -ne 1) { Write-Host "ECHEC  ancre type MouvementConsommable trouvee $n fois (attendu 1)"; exit 1 }
$s = $s.Replace($ancre, "  dateMouvement: string;`r`n" + $ancre)

# 2. date? dans les parametres d'entreeConsommable et sortieConsommable
$reE = [regex]'(?s)(export async function entreeConsommable\(data: \{.*?)(\}\): Promise<void>)'
if (-not $reE.IsMatch($s)) { Write-Host "ECHEC  entreeConsommable introuvable"; exit 1 }
$s = $reE.Replace($s, ('$1' + "  date?: string;`r`n" + '$2'), 1)

$reS = [regex]'(?s)(export async function sortieConsommable\(data: \{.*?)(\}\): Promise<void>)'
if (-not $reS.IsMatch($s)) { Write-Host "ECHEC  sortieConsommable introuvable"; exit 1 }
$s = $reS.Replace($s, ('$1' + "  date?: string;`r`n" + '$2'), 1)

# 3. Suppression d'un mouvement
$bloc = @'

export async function supprimerMouvementConsommable(id: string): Promise<void> {
  const res = await appelApi(
    `/consommables/mouvements/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression du mouvement');
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     api stocks mise a jour"
Write-Host ("Controle : supprimerMouvementConsommable = " + ([regex]::Matches($s, "supprimerMouvementConsommable")).Count + " (attendu >= 1)")
Write-Host ("Controle : date?: string = " + ([regex]::Matches($s, [regex]::Escape("date?: string;"))).Count)
