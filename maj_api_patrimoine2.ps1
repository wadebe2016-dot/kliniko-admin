# Remplace le bloc Patrimoine de src\api.ts (kliniko-admin) par la version
# Edufo : actifs enrichis, interventions, contrats. Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\maj_api_patrimoine2.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getContrats")) {
  Write-Host "DEJA   le bloc patrimoine Edufo existe - rien a faire."
  exit 0
}

# Bornes de l'ancien bloc : du commentaire de titre a la fin de changerEtatActif
$deb = $s.IndexOf("// Patrimoine : les actifs de la clinique et leur journal")
if ($deb -lt 0) { Write-Host "ECHEC  debut du bloc patrimoine introuvable"; exit 1 }
$marqueFin = 'await echecOrdonnance(res, "Erreur lors du changement d''état");'
$fin = $s.IndexOf($marqueFin, $deb)
if ($fin -lt 0) { Write-Host "ECHEC  fin du bloc patrimoine introuvable"; exit 1 }
$finAcc = $s.IndexOf("}", $fin + $marqueFin.Length)
if ($finAcc -lt 0) { Write-Host "ECHEC  accolade de fin introuvable"; exit 1 }
$finAcc = $finAcc + 1

$bloc = @'
// Patrimoine : actifs, interventions de maintenance et contrats
// ----------------------------------------------------------------------------

export type EtatActif = 'bon' | 'moyen' | 'en_reparation' | 'hors_service' | 'cede';

export type Actif = {
  id: string;
  code: string | null;
  designation: string;
  categorie: string | null;
  localisation: string | null;
  dateAcquisition: string | null;
  valeurAcquisition: number | null;
  dureeAmortAnnees: number | null;
  valeurResiduelle: number | null;
  etat: string;
  fournisseur: string | null;
  affecteA: string | null;
  affecte: { nom: string; prenom: string | null } | null;
  notes: string | null;
  actif: boolean;
  interventionsOuvertes: number;
  createdAt: string;
};

export type InterventionActif = {
  id: string;
  type: string;
  description: string;
  cout: number;
  statut: string;
  dateIntervention: string;
  createdAt: string;
};

export type ActifDetail = Actif & { interventions: InterventionActif[] };

export type Contrat = {
  id: string;
  type: string;
  objet: string;
  cocontractant: string | null;
  personnelId: string | null;
  personnel: { nom: string; prenom: string | null } | null;
  reference: string | null;
  dateDebut: string | null;
  dateFin: string | null;
  montant: number;
  resilie: boolean;
  note: string | null;
  statutTemporel: string;
  joursRestants: number | null;
};

export async function getActifs(
  categorie?: string,
  etat?: string,
): Promise<Actif[]> {
  const params = new URLSearchParams();
  if (categorie) params.set('categorie', categorie);
  if (etat) params.set('etat', etat);
  const q = params.toString();
  const res = await appelApi(`/patrimoine/actifs${q ? `?${q}` : ''}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement du patrimoine');
  return res.json();
}

export async function getActifDetail(id: string): Promise<ActifDetail> {
  const res = await appelApi(`/patrimoine/actifs/${encodeURIComponent(id)}`);
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du chargement de l'actif");
  return res.json();
}

export async function creerActif(data: {
  designation: string;
  categorie?: string;
  localisation?: string;
  etat?: string;
  dateAcquisition?: string;
  valeurAcquisition?: number;
  dureeAmortAnnees?: number;
  fournisseur?: string;
  affecteA?: string;
  notes?: string;
}): Promise<void> {
  const res = await appelApi('/patrimoine/actifs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la création de l'actif");
}

export async function modifierActif(
  actifId: string,
  data: {
    designation?: string;
    categorie?: string;
    localisation?: string;
    etat?: string;
    dateAcquisition?: string;
    valeurAcquisition?: number;
    dureeAmortAnnees?: number;
    fournisseur?: string;
    affecteA?: string;
    notes?: string;
    actif?: boolean;
  },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la modification de l'actif");
}

export async function supprimerActif(actifId: string): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la suppression de l'actif");
}

export async function creerIntervention(
  actifId: string,
  data: { type?: string; description: string; cout?: number; date?: string },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/actifs/${encodeURIComponent(actifId)}/interventions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la création de l'intervention");
}

export async function majIntervention(
  interventionId: string,
  data: { statut?: string; cout?: number; description?: string },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/interventions/${encodeURIComponent(interventionId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de la mise à jour de l'intervention");
}

export async function getContrats(type?: string): Promise<Contrat[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : '';
  const res = await appelApi(`/patrimoine/contrats${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des contrats');
  return res.json();
}

export async function creerContrat(data: {
  type?: string;
  objet: string;
  cocontractant?: string;
  personnelId?: string;
  dateDebut?: string;
  dateFin?: string;
  montant?: number;
  note?: string;
}): Promise<void> {
  const res = await appelApi('/patrimoine/contrats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création du contrat');
}

export async function modifierContrat(
  contratId: string,
  data: {
    type?: string;
    objet?: string;
    cocontractant?: string;
    personnelId?: string;
    dateDebut?: string;
    dateFin?: string;
    montant?: number;
    note?: string;
    resilie?: boolean;
  },
): Promise<void> {
  const res = await appelApi(
    `/patrimoine/contrats/${encodeURIComponent(contratId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la modification du contrat');
}

export async function supprimerContrat(contratId: string): Promise<void> {
  const res = await appelApi(
    `/patrimoine/contrats/${encodeURIComponent(contratId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression du contrat');
}
'@

$s = $s.Substring(0, $deb) + $bloc + $s.Substring($finAcc)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc patrimoine remplace"
Write-Host ("Controle : getContrats = " + ([regex]::Matches($s, "export async function getContrats")).Count + " (attendu 1)")
Write-Host ("Controle : changerEtatActif = " + ([regex]::Matches($s, "changerEtatActif")).Count + " (attendu 0)")
Write-Host ("Controle : getActifs = " + ([regex]::Matches($s, "export async function getActifs")).Count + " (attendu 1)")
