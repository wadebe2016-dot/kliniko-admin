# Renomme le titre de page : "Patrimoine de l'etablissement". Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\renommage_patrimoine.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("Patrimoine de l")) {
  Write-Host "DEJA   le renommage est fait - rien a faire."
  exit 0
}

$ancre = "patrimoine: 'Patrimoine et actifs'"
$n = ([regex]::Matches($s, [regex]::Escape($ancre))).Count
if ($n -ne 1) { Write-Host "ECHEC  ancre titre trouvee $n fois (attendu 1)"; exit 1 }
$s = $s.Replace($ancre, 'patrimoine: "Patrimoine de l''établissement"')

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     titre = Patrimoine de l'etablissement"
Select-String -Path $chemin -Pattern "Patrimoine de l"
