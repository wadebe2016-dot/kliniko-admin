# Ajoute le bloc Tresorerie a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_tresorerie.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getComptesTresorerie")) {
  Write-Host "DEJA   le bloc tresorerie existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Tresorerie : comptes, categories, mouvements
// ----------------------------------------------------------------------------

export type CompteTresorerie = {
  id: string;
  nom: string;
  type: 'caisse' | 'banque' | 'mobile_money';
  solde: number;
};

export type CategorieTresorerie = {
  id: string;
  nom: string;
  sens: 'recette' | 'depense';
};

export type MouvementTresorerie = {
  id: string;
  type: 'recette' | 'depense' | 'transfert';
  libelle: string;
  beneficiaire: string | null;
  montant: number | string;
  dateMouvement: string;
  factureId: string | null;
  compte: { nom: string };
  compteDest: { nom: string } | null;
  categorie: { nom: string } | null;
};

export async function getComptesTresorerie(): Promise<CompteTresorerie[]> {
  const res = await appelApi('/tresorerie/comptes');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des comptes');
  return res.json();
}

export async function getCategoriesTresorerie(): Promise<CategorieTresorerie[]> {
  const res = await appelApi('/tresorerie/categories');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des catégories');
  return res.json();
}

export async function getMouvementsTresorerie(
  du?: string,
  au?: string,
): Promise<MouvementTresorerie[]> {
  const q = new URLSearchParams();
  if (du) q.set('du', du);
  if (au) q.set('au', au);
  const res = await appelApi(`/tresorerie/mouvements?${q.toString()}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des mouvements');
  return res.json();
}

export async function creerCompteTresorerie(data: {
  nom: string;
  type: 'caisse' | 'banque' | 'mobile_money';
}): Promise<void> {
  const res = await appelApi('/tresorerie/comptes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du compte');
}

export async function creerCategorieTresorerie(data: {
  nom: string;
  sens: 'recette' | 'depense';
}): Promise<void> {
  const res = await appelApi('/tresorerie/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création de la catégorie');
}

type DonneesMouvement = {
  compteId: string;
  categorieId?: string;
  libelle: string;
  beneficiaire?: string;
  montant: number;
  date?: string;
};

export async function creerRecette(data: DonneesMouvement): Promise<void> {
  const res = await appelApi('/tresorerie/recettes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement de la recette");
}

export async function creerDepense(data: DonneesMouvement): Promise<void> {
  const res = await appelApi('/tresorerie/depenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement de la dépense");
}

export async function creerTransfert(data: {
  compteId: string;
  compteDestId: string;
  montant: number;
  libelle?: string;
  date?: string;
}): Promise<void> {
  const res = await appelApi('/tresorerie/transferts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du transfert');
}

export async function supprimerMouvement(mouvementId: string): Promise<void> {
  const res = await appelApi(
    `/tresorerie/mouvements/${encodeURIComponent(mouvementId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression');
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc tresorerie ajoute"
Write-Host ("Controle : getComptesTresorerie = " + ([regex]::Matches($s, "export async function getComptesTresorerie")).Count + " (attendu 1)")
