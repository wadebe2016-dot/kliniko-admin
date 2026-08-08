$ErrorActionPreference = "Stop"
$f = "src\Agenda.tsx"
$octets = [System.IO.File]::ReadAllBytes((Resolve-Path $f))
$s = [System.Text.Encoding]::UTF8.GetString($octets)
$lignes = $s -split "`r`n"
if ($lignes.Count -le 1) { $lignes = $s -split "`n" }

$idx = -1
for ($i = 0; $i -lt $lignes.Count; $i++) {
  if ($lignes[$i].Trim() -eq "@'") { $idx = $i }
}

if ($idx -lt 0) {
  Write-Host "Pas de marque trouvee : le fichier n'est pas coupe comme prevu" -ForegroundColor Red
  exit 1
}

$reste = $lignes[($idx + 1)..($lignes.Count - 1)] -join "`r`n"
[System.IO.File]::WriteAllText((Resolve-Path $f), $reste, (New-Object System.Text.UTF8Encoding($false)))

$premiere = ($reste -split "`r`n")[0]
Write-Host "Premiere ligne conservee : $premiere"
$fins = ([regex]::Matches($reste, "export default Agenda")).Count
Write-Host "Occurrences de 'export default Agenda' : $fins (attendu : 1)"
