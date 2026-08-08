# Cablage de l'ecran Personnel dans App.tsx (kliniko-admin) :
# nouveau groupe "Ressources humaines" avant Organisation. Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\cablage_personnel.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

$nl = "`n"
if ($s.Contains("`r`n")) { $nl = "`r`n" }

if ($s.Contains("'personnel'")) {
  Write-Host "DEJA   'personnel' est deja present - rien a faire."
  exit 0
}

$rapport = @()

# --- 1. Type Vue ---
$ancre = "  | 'patrimoine'"
if (($s.Split([string[]]@($ancre), 'None').Count - 1) -eq 1) {
  $s = $s.Replace($ancre, $ancre + $nl + "  | 'personnel'")
  $rapport += "OK     type Vue"
} else {
  $rapport += "ECHEC  type Vue (ancre non unique ou absente)"
}

# --- 2. TITRES ---
$ancre = "  patrimoine: 'Patrimoine et actifs',"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "  personnel: 'Personnel',")
  $rapport += "OK     TITRES"
} else {
  $rapport += "ECHEC  TITRES (ancre absente)"
}

# --- 3. GROUPES : nouveau groupe avant Organisation ---
$ancre = "    libelle: 'Organisation',"
if ($s.Contains($ancre)) {
  $bloc = "    libelle: 'Ressources humaines'," + $nl +
          "    entrees: [{ vue: 'personnel', libelle: 'Personnel', perm: 'personnel.lire' }]," + $nl +
          "  }," + $nl +
          "  {" + $nl +
          $ancre
  $s = $s.Replace($ancre, $bloc)
  $rapport += "OK     GROUPES (Ressources humaines)"
} else {
  $rapport += "ECHEC  GROUPES (ancre absente)"
}

# --- 4. Import ---
$ancre = "import Patrimoine from './Patrimoine';"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "import Personnel from './Personnel';")
  $rapport += "OK     import"
} else {
  $rapport += "ECHEC  import (ancre absente)"
}

# --- 5. Routage ---
$ancre = "          ) : vue === 'consultations' ? ("
if ($s.Contains($ancre)) {
  $bloc = "          ) : vue === 'personnel' ? (" + $nl +
          "            <Personnel onSessionExpiree={() => setUtilisateur(null)} />" + $nl +
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
Write-Host ("Controle : occurrences de 'personnel = " + ($s.Split([string[]]@("'personnel"), 'None').Count - 1) + " (attendu 4)")
