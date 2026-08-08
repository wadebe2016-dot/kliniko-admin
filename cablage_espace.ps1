# Cablage de l'ecran Mon espace dans App.tsx (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\cablage_espace.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

$nl = "`n"
if ($s.Contains("`r`n")) { $nl = "`r`n" }

if ($s.Contains("'espace'")) {
  Write-Host "DEJA   'espace' est deja present - rien a faire."
  exit 0
}

$rapport = @()

# --- 1. Type Vue ---
$ancre = "  | 'tableau'"
if (($s.Split([string[]]@($ancre), 'None').Count - 1) -eq 1) {
  $s = $s.Replace($ancre, $ancre + $nl + "  | 'espace'")
  $rapport += "OK     type Vue"
} else {
  $rapport += "ECHEC  type Vue (ancre non unique ou absente)"
}

# --- 2. TITRES ---
$ancre = "  tableau: 'Tableau de bord',"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "  espace: 'Mon espace',")
  $rapport += "OK     TITRES"
} else {
  $rapport += "ECHEC  TITRES (ancre absente)"
}

# --- 3. GROUPES : nouveau groupe Espace personnel apres Pilotage ---
$ancre = "    entrees: [{ vue: 'tableau', libelle: 'Tableau de bord' }],"
if ($s.Contains($ancre)) {
  $bloc = $ancre + $nl +
          "  }," + $nl +
          "  {" + $nl +
          "    libelle: 'Espace personnel'," + $nl +
          "    entrees: [{ vue: 'espace', libelle: 'Mon espace' }],"
  $s = $s.Replace($ancre, $bloc)
  $rapport += "OK     GROUPES"
} else {
  $rapport += "ECHEC  GROUPES (ancre absente)"
}

# --- 4. Import ---
$ancre = "import TableauDeBord from './TableauDeBord';"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "import Espace from './Espace';")
  $rapport += "OK     import"
} else {
  $rapport += "ECHEC  import (ancre absente)"
}

# --- 5. Routage ---
$ancre = "          ) : vue === 'consultations' ? ("
if ($s.Contains($ancre)) {
  $bloc = "          ) : vue === 'espace' ? (" + $nl +
          "            <Espace" + $nl +
          "              onSessionExpiree={() => setUtilisateur(null)}" + $nl +
          "              utilisateur={utilisateur}" + $nl +
          "            />" + $nl +
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
Write-Host ("Controle : occurrences de 'espace' = " + ($s.Split([string[]]@("'espace'"), 'None').Count - 1) + " (attendu 3)")
