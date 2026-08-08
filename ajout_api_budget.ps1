# Ajoute le bloc Budget (CDG) a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_budget.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getBudget")) {
  Write-Host "DEJA   le bloc budget existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Controle de gestion : budget annuel par categorie
// ----------------------------------------------------------------------------

export type LigneBudgetResume = {
  id: string | null;
  categorie: { id: string; nom: string; sens: 'recette' | 'depense' };
  prevu: number;
  realise: number;
  ecart: number;
  consomme: number;
};

export type BudgetResume = {
  annee: number;
  lignes: LigneBudgetResume[];
  totaux: {
    recettesPrevu: number;
    recettesRealise: number;
    depensesPrevu: number;
    depensesRealise: number;
    execution: number;
    realisation: number;
    marge: number;
    depassements: number;
  };
};

export async function getBudget(annee: number): Promise<BudgetResume> {
  const res = await appelApi(`/tresorerie/budget?annee=${annee}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du budget');
  return res.json();
}

export async function definirLigneBudget(data: {
  annee: number;
  categorieId: string;
  montantPrevu: number;
}): Promise<void> {
  const res = await appelApi('/tresorerie/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du budget");
}

export async function supprimerLigneBudget(ligneId: string): Promise<void> {
  const res = await appelApi(
    `/tresorerie/budget/${encodeURIComponent(ligneId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression de la ligne');
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc budget ajoute"
Write-Host ("Controle : getBudget = " + ([regex]::Matches($s, "export async function getBudget")).Count + " (attendu 1)")
