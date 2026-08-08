# Complement api.ts (kliniko-admin) : note/actif sur les articles,
# modification et suppression d'article. Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\maj_api_stocks2.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("modifierConsommable")) {
  Write-Host "DEJA   la mise a jour articles existe - rien a faire."
  exit 0
}

# 1. note + actif dans le type ArticleConsommable — borne au bloc du type
#    (peremptionProche existe aussi dans le bloc Pharmacie).
$deb = $s.IndexOf("export type ArticleConsommable = {")
if ($deb -lt 0) { Write-Host "ECHEC  type ArticleConsommable introuvable"; exit 1 }
$fin = $s.IndexOf("};", $deb)
if ($fin -lt 0) { Write-Host "ECHEC  fin du type ArticleConsommable introuvable"; exit 1 }
$bloc = $s.Substring($deb, $fin - $deb)

$ancre = '  peremptionProche: string | null;'
$n = ([regex]::Matches($bloc, [regex]::Escape($ancre))).Count
if ($n -ne 1) { Write-Host "ECHEC  ancre trouvee $n fois dans le bloc (attendu 1)"; exit 1 }
$bloc = $bloc.Replace($ancre, "  note: string | null;`r`n  actif: boolean;`r`n" + $ancre)
$s = $s.Substring(0, $deb) + $bloc + $s.Substring($fin)

# 2. note? dans creerConsommable
$reC = [regex]'(?s)(export async function creerConsommable\(data: \{.*?)(\}\): Promise<void>)'
if (-not $reC.IsMatch($s)) { Write-Host "ECHEC  creerConsommable introuvable"; exit 1 }
$s = $reC.Replace($s, ('$1' + "  note?: string;`r`n" + '$2'), 1)

# 3. Modification et suppression d'article
$bloc2 = @'

export async function modifierConsommable(
  id: string,
  data: {
    designation?: string;
    unite?: string;
    seuilAlerte?: number;
    note?: string;
    actif?: boolean;
  },
): Promise<void> {
  const res = await appelApi(`/consommables/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la modification de l'article");
}

export async function supprimerConsommable(id: string): Promise<void> {
  const res = await appelApi(`/consommables/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la suppression de l'article");
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc2 + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     api articles mise a jour"
Write-Host ("Controle : modifierConsommable = " + ([regex]::Matches($s, "export async function modifierConsommable")).Count + " (attendu 1)")
Write-Host ("Controle : supprimerConsommable = " + ([regex]::Matches($s, "export async function supprimerConsommable")).Count + " (attendu 1)")
