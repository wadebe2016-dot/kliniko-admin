# Ajoute le bloc Paie a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_paie.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getBulletinsPaie")) {
  Write-Host "DEJA   le bloc paie existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Paie : bulletins, versements, parametres CNPS / IRPP
// ----------------------------------------------------------------------------

export type ParametresPaie = {
  tauxCnpsSalarial: number;
  plafondCnps: number;
  abattementFraisPct: number;
  cacPct: number;
};

export type TrancheIrpp = {
  borneMin: number;
  borneMax: number | null;
  taux: number;
};

export type BulletinPaie = {
  id: string;
  personnelId: string;
  mois: number;
  annee: number;
  salaireBase: number;
  totalPrimes: number;
  primesDetail: string | null;
  brut: number;
  cnps: number;
  irpp: number;
  cac: number;
  autresRetenues: number;
  net: number;
  statutVersement: 'paye' | 'en_attente';
  dateVersement: string | null;
  modeVersement: string | null;
  genereLe: string;
  personnel: {
    nom: string;
    prenom: string | null;
    fonction: string | null;
    matricule: string | null;
  };
};

export async function getParametresPaie(): Promise<{
  parametres: ParametresPaie;
  tranches: TrancheIrpp[];
}> {
  const res = await appelApi('/paie/parametres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des paramètres');
  return res.json();
}

export async function majParametresPaie(data: ParametresPaie): Promise<void> {
  const res = await appelApi('/paie/parametres', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement des paramètres");
}

export async function majTranchesIrpp(tranches: TrancheIrpp[]): Promise<void> {
  const res = await appelApi('/paie/tranches', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tranches }),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du barème");
}

export async function getBulletinsPaie(
  mois: number,
  annee: number,
): Promise<BulletinPaie[]> {
  const res = await appelApi(`/paie/bulletins?mois=${mois}&annee=${annee}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des bulletins');
  return res.json();
}

export async function genererBulletin(data: {
  personnelId: string;
  mois: number;
  annee: number;
  primes?: { libelle: string; montant: number }[];
}): Promise<void> {
  const res = await appelApi('/paie/bulletins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la génération du bulletin');
}

export async function genererBulletinsTous(
  mois: number,
  annee: number,
): Promise<{ generes: number; ignores: number; total: number }> {
  const res = await appelApi('/paie/bulletins/tous', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mois, annee }),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la génération');
  return res.json();
}

export async function supprimerBulletin(id: string): Promise<void> {
  const res = await appelApi(`/paie/bulletins/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression du bulletin');
}

export async function versementBulletin(
  id: string,
  data: {
    statut: 'paye' | 'en_attente';
    dateVersement?: string;
    modeVersement?: 'virement' | 'momo' | 'especes';
  },
): Promise<void> {
  const res = await appelApi(
    `/paie/bulletins/${encodeURIComponent(id)}/versement`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du versement");
}

export async function versementLotPaie(data: {
  mois: number;
  annee: number;
  dateVersement?: string;
  modeVersement?: 'virement' | 'momo' | 'especes';
}): Promise<{ nbPayes: number }> {
  const res = await appelApi('/paie/versements/lot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du versement en lot');
  return res.json();
}

export async function simulerPaie(data: {
  salaireBase: number;
  totalPrimes?: number;
}): Promise<{
  brut: number;
  cnps: number;
  irpp: number;
  cac: number;
  baseImposable: number;
  net: number;
}> {
  const res = await appelApi('/paie/simuler', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la simulation');
  return res.json();
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc paie ajoute"
Write-Host ("Controle : getBulletinsPaie = " + ([regex]::Matches($s, "export async function getBulletinsPaie")).Count + " (attendu 1)")
