# Ajoute le bloc Consommables a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_consommables.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getStockConsommables")) {
  Write-Host "DEJA   le bloc consommables existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Consommables : stock non medical par mouvements
// ----------------------------------------------------------------------------

export type ArticleConsommable = {
  id: string;
  code: string | null;
  designation: string;
  unite: string | null;
  seuilAlerte: number;
  prixUnitaire: number | null;
  stock: number;
  sousSeuil: boolean;
  peremptionProche: string | null;
};

export type MouvementConsommable = {
  id: string;
  type: 'entree' | 'sortie' | 'ajustement';
  quantite: number;
  datePeremption: string | null;
  motif: string | null;
  createdAt: string;
  consommable: { designation: string; unite: string | null };
};

export async function getStockConsommables(): Promise<ArticleConsommable[]> {
  const res = await appelApi('/consommables/stock');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du stock');
  return res.json();
}

export async function getMouvementsConsommables(): Promise<MouvementConsommable[]> {
  const res = await appelApi('/consommables/mouvements');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des mouvements');
  return res.json();
}

export async function creerConsommable(data: {
  designation: string;
  code?: string;
  unite?: string;
  seuilAlerte?: number;
  prixUnitaire?: number;
}): Promise<void> {
  const res = await appelApi('/consommables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du consommable');
}

export async function entreeConsommable(data: {
  consommableId: string;
  quantite: number;
  datePeremption?: string;
  prixAchat?: number;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/consommables/entrees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'entrée de stock");
}

export async function sortieConsommable(data: {
  consommableId: string;
  quantite: number;
  motif: string;
}): Promise<void> {
  const res = await appelApi('/consommables/sorties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la sortie');
}

export async function ajustementConsommable(data: {
  consommableId: string;
  quantite: number;
  motif: string;
}): Promise<void> {
  const res = await appelApi('/consommables/ajustements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'ajustement");
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc consommables ajoute"
Write-Host ("Controle : getStockConsommables = " + ([regex]::Matches($s, "export async function getStockConsommables")).Count + " (attendu 1)")
