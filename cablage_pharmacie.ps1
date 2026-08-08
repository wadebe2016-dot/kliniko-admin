# Cablage du module Pharmacie dans App.tsx (kliniko-admin)
# A executer depuis C:\Users\wadeb\kliniko-admin
# Usage :  powershell -ExecutionPolicy Bypass -File .\cablage_pharmacie.ps1

$chemin = "src\App.tsx"
if (-not (Test-Path $chemin)) {
  Write-Host "ECHEC  $chemin introuvable - etes-vous bien dans kliniko-admin ?"
  exit 1
}

# Lecture en UTF-8 sans BOM (ne pas passer par Get-Content -Raw)
$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

# Fin de ligne du fichier (CRLF ou LF)
$nl = "`n"
if ($s.Contains("`r`n")) { $nl = "`r`n" }

$rapport = @()

if ($s.Contains("'pharmacie'")) {
  Write-Host "DEJA   'pharmacie' est deja present dans App.tsx - rien a faire."
  exit 0
}

# --- 1. Type Vue : ajouter 'pharmacie' ---
$ancre = "  | 'disponibilites'"
if (($s.Split([string[]]@($ancre), 'None').Count - 1) -eq 1) {
  $s = $s.Replace($ancre, "  | 'pharmacie'" + $nl + $ancre)
  $rapport += "OK     type Vue"
} else {
  $rapport += "ECHEC  type Vue (ancre non unique ou absente)"
}

# --- 2. TITRES : ajouter le titre de la vue ---
$ancre = "  factures: 'Facturation et caisse',"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "  pharmacie: 'Pharmacie et stock',")
  $rapport += "OK     TITRES"
} else {
  $rapport += "ECHEC  TITRES (ancre absente)"
}

# --- 3. GROUPES : groupe Ressources entre Finances et Organisation ---
$ancre = "    libelle: 'Organisation',"
if ($s.Contains($ancre)) {
  $bloc = "    libelle: 'Ressources'," + $nl +
          "    entrees: [{ vue: 'pharmacie', libelle: 'Pharmacie', perm: 'pharmacie.lire' }]," + $nl +
          "  }," + $nl +
          "  {" + $nl +
          $ancre
  $s = $s.Replace($ancre, $bloc)
  $rapport += "OK     GROUPES (Ressources)"
} else {
  $rapport += "ECHEC  GROUPES (ancre absente)"
}

# --- 4. Import du composant ---
$ancre = "import TableauDeBord from './TableauDeBord';"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "import Pharmacie from './Pharmacie';")
  $rapport += "OK     import"
} else {
  $rapport += "ECHEC  import (ancre absente)"
}

# --- 5. Routage : branche pharmacie avant consultations ---
$ancre = "          ) : vue === 'consultations' ? ("
if ($s.Contains($ancre)) {
  $bloc = "          ) : vue === 'pharmacie' ? (" + $nl +
          "            <Pharmacie onSessionExpiree={() => setUtilisateur(null)} />" + $nl +
          $ancre
  $s = $s.Replace($ancre, $bloc)
  $rapport += "OK     routage"
} else {
  $rapport += "ECHEC  routage (ancre absente)"
}

# Ecriture uniquement si tout est OK
$echecs = @($rapport | Where-Object { $_ -like "ECHEC*" })
if ($echecs.Count -gt 0) {
  Write-Host "Aucune modification ecrite (au moins une ancre a echoue) :"
  $rapport | ForEach-Object { Write-Host $_ }
  exit 1
}

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $chemin), $s, $enc)

$rapport | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host ("Controle : occurrences de 'pharmacie' = " + ($s.Split([string[]]@("'pharmacie"), 'None').Count - 1) + " (attendu 4)")
