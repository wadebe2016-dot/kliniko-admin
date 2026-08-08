# Renomme le module dans App.tsx : menu "Stocks", titre "Gestion des stocks".
# Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\renommage_stocks.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("Gestion des stocks")) {
  Write-Host "DEJA   le renommage est fait - rien a faire."
  exit 0
}

# 1. Entree de menu : Consommables -> Stocks
$ancre1 = "libelle: 'Consommables'"
$n1 = ([regex]::Matches($s, [regex]::Escape($ancre1))).Count
if ($n1 -ne 1) { Write-Host "ECHEC  ancre menu trouvee $n1 fois (attendu 1)"; exit 1 }
$s = $s.Replace($ancre1, "libelle: 'Stocks'")

# 2. Titre de page : Consommables -> Gestion des stocks
$ancre2 = "consommables: 'Consommables'"
$n2 = ([regex]::Matches($s, [regex]::Escape($ancre2))).Count
if ($n2 -ne 1) { Write-Host "ECHEC  ancre titre trouvee $n2 fois (attendu 1)"; exit 1 }
$s = $s.Replace($ancre2, "consommables: 'Gestion des stocks'")

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     menu = Stocks, titre = Gestion des stocks"
Select-String -Path $chemin -Pattern "Stocks"
