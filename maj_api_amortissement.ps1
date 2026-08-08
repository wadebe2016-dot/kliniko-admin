# Met a jour le bloc Patrimoine de src\api.ts : duree d'amortissement et
# valeur residuelle. Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\maj_api_amortissement.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("dureeAmortAnnees")) {
  Write-Host "DEJA   dureeAmortAnnees existe - rien a faire."
  exit 0
}

$rapport = @()

# --- 1. Type Actif : deux champs apres valeurAcquisition ---
$re = [regex]"(?m)^(  valeurAcquisition: number \| null;)$"
if ($re.IsMatch($s)) {
  $remplacement = '$1' + "`n" + '  dureeAmortAnnees: number | null;' + "`n" + '  valeurResiduelle: number | null;'
  $s = $re.Replace($s, $remplacement, 1)
  $rapport += "OK     type Actif"
} else {
  $rapport += "ECHEC  type Actif (ligne valeurAcquisition absente)"
}

# --- 2. Parametres de creerActif et modifierActif ---
$re2 = [regex]"(?m)^(    valeurAcquisition\?: number;)$"
$nb = $re2.Matches($s).Count
if ($nb -ge 1) {
  $s = $re2.Replace($s, ('$1' + "`n" + '    dureeAmortAnnees?: number;'))
  $rapport += "OK     parametres ($nb emplacements)"
} else {
  $rapport += "ECHEC  parametres (aucune ligne valeurAcquisition?)"
}

$echecs = @($rapport | Where-Object { $_ -like "ECHEC*" })
if ($echecs.Count -gt 0) {
  Write-Host "Aucune modification ecrite :"
  $rapport | ForEach-Object { Write-Host $_ }
  exit 1
}

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

$rapport | ForEach-Object { Write-Host $_ }
Write-Host ""
Write-Host ("Controle : dureeAmortAnnees = " + ([regex]::Matches($s, "dureeAmortAnnees")).Count + " occurrences (attendu 3)")
