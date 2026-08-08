# Cablage du module Consommables dans App.tsx (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\cablage_consommables.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

$nl = "`n"
if ($s.Contains("`r`n")) { $nl = "`r`n" }

if ($s.Contains("'consommables'")) {
  Write-Host "DEJA   'consommables' est deja present - rien a faire."
  exit 0
}

$rapport = @()

# --- 1. Type Vue ---
$ancre = "  | 'hospitalisation'"
if (($s.Split([string[]]@($ancre), 'None').Count - 1) -eq 1) {
  $s = $s.Replace($ancre, $ancre + $nl + "  | 'consommables'")
  $rapport += "OK     type Vue"
} else {
  $rapport += "ECHEC  type Vue (ancre non unique ou absente)"
}

# --- 2. TITRES ---
$ancre = "  hospitalisation: 'Chambres et hospitalisation',"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "  consommables: 'Consommables',")
  $rapport += "OK     TITRES"
} else {
  $rapport += "ECHEC  TITRES (ancre absente)"
}

# --- 3. GROUPES : sous Ressources, apres Hospitalisation ---
$ancre = "{ vue: 'hospitalisation', libelle: 'Hospitalisation', perm: 'hospitalisation.lire' },"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "      { vue: 'consommables', libelle: 'Consommables', perm: 'consommable.lire' },")
  $rapport += "OK     GROUPES"
} else {
  $rapport += "ECHEC  GROUPES (ancre absente)"
}

# --- 4. Import ---
$ancre = "import Hospitalisation from './Hospitalisation';"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "import Consommables from './Consommables';")
  $rapport += "OK     import"
} else {
  $rapport += "ECHEC  import (ancre absente)"
}

# --- 5. Routage ---
$ancre = "          ) : vue === 'consultations' ? ("
if ($s.Contains($ancre)) {
  $bloc = "          ) : vue === 'consommables' ? (" + $nl +
          "            <Consommables onSessionExpiree={() => setUtilisateur(null)} />" + $nl +
          $ancre
  $s = $s.Replace($ancre, $bloc)
  $rapport += "OK     routage"
} else {
  $rapport += "ECHEC  routage (ancre absente)"
}

$echecs = @($rapport | Where-Object { $_ -like "ECHEC*" })
if ($echecs.Count -gt 0) {
  Write-Host "Aucune modification ecrite (au moins une ancre a echoue) :"
  $rapport | ForEach-Object { Write-Host $_ }
  exit 1
}

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

$rapport | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host ("Controle : occurrences de 'consommables' = " + ($s.Split([string[]]@("'consommables'"), 'None').Count - 1) + " (attendu 3)")
