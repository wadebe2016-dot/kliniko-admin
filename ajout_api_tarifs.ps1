# Ajoute le bloc Tarifs a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_tarifs.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getTarifsActes")) {
  Write-Host "DEJA   le bloc tarifs existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Tarifs : la mercuriale des prix (actes dates, prix des medicaments)
// ----------------------------------------------------------------------------

export type ActeTarif = {
  id: string;
  code: string;
  libelle: string;
  tarif: number | null;
  devise: string;
  depuis: string | null;
};

export type MedicamentPrix = {
  id: string;
  code: string | null;
  denomination: string;
  dosage: string | null;
  forme: string | null;
  prixVente: number | null;
};

export async function getTarifsActes(): Promise<ActeTarif[]> {
  const res = await appelApi('/tarifs/actes');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des actes');
  return res.json();
}

export async function creerActe(data: {
  code: string;
  libelle: string;
  montant?: number;
}): Promise<void> {
  const res = await appelApi('/tarifs/actes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la création de l'acte");
}

export async function modifierActe(
  acteId: string,
  data: { libelle: string },
): Promise<void> {
  const res = await appelApi(`/tarifs/actes/${encodeURIComponent(acteId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la modification de l'acte");
}

export async function nouveauTarifActe(
  acteId: string,
  data: { montant: number },
): Promise<void> {
  const res = await appelApi(
    `/tarifs/actes/${encodeURIComponent(acteId)}/tarif`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du changement de tarif');
}

export async function getTarifsMedicaments(): Promise<MedicamentPrix[]> {
  const res = await appelApi('/tarifs/medicaments');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des médicaments');
  return res.json();
}

export async function modifierPrixMedicament(
  medicamentId: string,
  data: { prixVente: number },
): Promise<void> {
  const res = await appelApi(
    `/tarifs/medicaments/${encodeURIComponent(medicamentId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du changement de prix');
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc tarifs ajoute"
Write-Host ("Controle : getTarifsActes = " + ([regex]::Matches($s, "export async function getTarifsActes")).Count + " (attendu 1)")
