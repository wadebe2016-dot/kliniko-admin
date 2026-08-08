# Cablage de l'ecran Patrimoine dans App.tsx (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\cablage_patrimoine.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

$nl = "`n"
if ($s.Contains("`r`n")) { $nl = "`r`n" }

if ($s.Contains("'patrimoine'")) {
  Write-Host "DEJA   'patrimoine' est deja present - rien a faire."
  exit 0
}

$rapport = @()

# --- 1. Type Vue ---
$ancre = "  | 'consommables'"
if (($s.Split([string[]]@($ancre), 'None').Count - 1) -eq 1) {
  $s = $s.Replace($ancre, $ancre + $nl + "  | 'patrimoine'")
  $rapport += "OK     type Vue"
} else {
  $rapport += "ECHEC  type Vue (ancre non unique ou absente)"
}

# --- 2. TITRES ---
$ancre = "  consommables: 'Consommables',"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "  patrimoine: 'Patrimoine et actifs',")
  $rapport += "OK     TITRES"
} else {
  $rapport += "ECHEC  TITRES (ancre absente)"
}

# --- 3. GROUPES : Ressources, apres Consommables ---
$ancre = "      { vue: 'consommables', libelle: 'Consommables', perm: 'consommable.lire' },"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "      { vue: 'patrimoine', libelle: 'Patrimoine', perm: 'patrimoine.lire' },")
  $rapport += "OK     GROUPES"
} else {
  $rapport += "ECHEC  GROUPES (ancre absente)"
}

# --- 4. Import ---
$ancre = "import Consommables from './Consommables';"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "import Patrimoine from './Patrimoine';")
  $rapport += "OK     import"
} else {
  $rapport += "ECHEC  import (ancre absente)"
}

# --- 5. Routage ---
$ancre = "          ) : vue === 'consultations' ? ("
if ($s.Contains($ancre)) {
  $bloc = "          ) : vue === 'patrimoine' ? (" + $nl +
          "            <Patrimoine onSessionExpiree={() => setUtilisateur(null)} />" + $nl +
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
Write-Host ("Controle : occurrences de 'patrimoine' = " + ($s.Split([string[]]@("'patrimoine"), 'None').Count - 1) + " (attendu 4)")
