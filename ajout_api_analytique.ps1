# Ajoute le bloc Analytique (centres de cout) a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_analytique.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getCentresCout")) {
  Write-Host "DEJA   le bloc analytique existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Analytique : centres de cout et cout par patient
// ----------------------------------------------------------------------------

export type CentreCout = {
  id: string;
  code: string;
  nom: string;
};

export type LigneAnalytique = {
  id: string | null;
  code: string | null;
  nom: string;
  actif: boolean;
  depenses: number;
  recettes: number;
  marge: number;
  ecritures: number;
  part: number;
  coutParPatient: number;
};

export type AnalytiqueResume = {
  nbPatients: number;
  lignes: LigneAnalytique[];
  nonImpute: LigneAnalytique;
  totaux: {
    depenses: number;
    recettes: number;
    ecritures: number;
    coutParPatient: number;
    coutMedicalParPatient: number;
    coutAdminParPatient: number;
  };
};

export async function getCentresCout(): Promise<CentreCout[]> {
  const res = await appelApi('/tresorerie/centres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des centres');
  return res.json();
}

export async function creerCentreCout(data: {
  code: string;
  nom: string;
}): Promise<CentreCout> {
  const res = await appelApi('/tresorerie/centres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la creation du centre');
  return res.json();
}

export async function getAnalytique(
  du?: string,
  au?: string,
): Promise<AnalytiqueResume> {
  const params = new URLSearchParams();
  if (du) params.set('du', du);
  if (au) params.set('au', au);
  const q = params.toString();
  const res = await appelApi(`/tresorerie/analytique${q ? `?${q}` : ''}`);
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du chargement de l'analytique");
  return res.json();
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc analytique ajoute"
Write-Host ("Controle : getCentresCout = " + ([regex]::Matches($s, "export async function getCentresCout")).Count + " (attendu 1)")
