# api.ts (kliniko-admin) : NIU + situation matrimoniale sur la fiche RH,
# et infos employe enrichies sur les bulletins de paie. Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\maj_api_rh_bulletin.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("situationFamille")) {
  Write-Host "DEJA   la mise a jour existe - rien a faire."
  exit 0
}

# 1. Type FicheRh : niu + situationFamille (indentation 2 espaces)
$a1 = "  numeroCnps: string | null;"
$n1 = ([regex]::Matches($s, [regex]::Escape($a1))).Count
if ($n1 -ne 1) { Write-Host "ECHEC  ancre FicheRh trouvee $n1 fois (attendu 1)"; exit 1 }
$s = $s.Replace($a1, $a1 + "`r`n  niu: string | null;`r`n  situationFamille: string | null;")

# 2. Parametres de modifierFicheRh (indentation 4 espaces)
$a2 = "    numeroCnps?: string;"
$n2 = ([regex]::Matches($s, [regex]::Escape($a2))).Count
if ($n2 -ne 1) { Write-Host "ECHEC  ancre modifierFicheRh trouvee $n2 fois (attendu 1)"; exit 1 }
$s = $s.Replace($a2, $a2 + "`r`n    niu?: string;`r`n    situationFamille?: string;")

# 3. Type BulletinPaie : enrichir personnel (borne au bloc du type)
$deb = $s.IndexOf("export type BulletinPaie = {")
if ($deb -lt 0) { Write-Host "ECHEC  type BulletinPaie introuvable"; exit 1 }
$fin = $s.IndexOf("export async function getParametresPaie", $deb)
if ($fin -lt 0) { Write-Host "ECHEC  borne de fin introuvable"; exit 1 }
$bloc = $s.Substring($deb, $fin - $deb)

$a3 = "    matricule: string | null;"
$n3 = ([regex]::Matches($bloc, [regex]::Escape($a3))).Count
if ($n3 -ne 1) { Write-Host "ECHEC  ancre personnel du bulletin trouvee $n3 fois (attendu 1)"; exit 1 }
$ajout = "`r`n    service: string | null;" +
         "`r`n    typeContrat: string | null;" +
         "`r`n    dateEmbauche: string | null;" +
         "`r`n    numeroCnps: string | null;" +
         "`r`n    niu: string | null;" +
         "`r`n    situationFamille: string | null;"
$bloc = $bloc.Replace($a3, $a3 + $ajout)
$s = $s.Substring(0, $deb) + $bloc + $s.Substring($fin)

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     api RH + bulletin mise a jour"
Write-Host ("Controle : situationFamille = " + ([regex]::Matches($s, "situationFamille")).Count + " occurrences (attendu 4)")
