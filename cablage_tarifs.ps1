# Cablage de l'ecran Tarifs dans App.tsx (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\cablage_tarifs.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\App.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  App.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

$nl = "`n"
if ($s.Contains("`r`n")) { $nl = "`r`n" }

if ($s.Contains("'tarifs'")) {
  Write-Host "DEJA   'tarifs' est deja present - rien a faire."
  exit 0
}

$rapport = @()

# --- 1. Type Vue ---
$ancre = "  | 'factures'"
if (($s.Split([string[]]@($ancre), 'None').Count - 1) -eq 1) {
  $s = $s.Replace($ancre, $ancre + $nl + "  | 'tarifs'")
  $rapport += "OK     type Vue"
} else {
  $rapport += "ECHEC  type Vue (ancre non unique ou absente)"
}

# --- 2. TITRES ---
$ancre = "  factures: 'Facturation et caisse',"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "  tarifs: 'Tarifs et mercuriale',")
  $rapport += "OK     TITRES"
} else {
  $rapport += "ECHEC  TITRES (ancre absente)"
}

# --- 3. GROUPES : Finances, sous la Facturation ---
$ancre = "entrees: [{ vue: 'factures', libelle: 'Facturation', perm: 'facture.lire' }],"
if ($s.Contains($ancre)) {
  $bloc = "entrees: [" + $nl +
          "      { vue: 'factures', libelle: 'Facturation', perm: 'facture.lire' }," + $nl +
          "      { vue: 'tarifs', libelle: 'Tarifs', perm: 'tarif.lire' }," + $nl +
          "    ],"
  $s = $s.Replace($ancre, $bloc)
  $rapport += "OK     GROUPES"
} else {
  $rapport += "ECHEC  GROUPES (ancre absente)"
}

# --- 4. Import ---
$ancre = "import Consommables from './Consommables';"
if ($s.Contains($ancre)) {
  $s = $s.Replace($ancre, $ancre + $nl + "import Tarifs from './Tarifs';")
  $rapport += "OK     import"
} else {
  $rapport += "ECHEC  import (ancre absente)"
}

# --- 5. Routage ---
$ancre = "          ) : vue === 'consultations' ? ("
if ($s.Contains($ancre)) {
  $bloc = "          ) : vue === 'tarifs' ? (" + $nl +
          "            <Tarifs onSessionExpiree={() => setUtilisateur(null)} />" + $nl +
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
Write-Host ("Controle : occurrences de 'tarifs' = " + ($s.Split([string[]]@("'tarifs'"), 'None').Count - 1) + " (attendu 3)")
