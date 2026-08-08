# Ajoute le bloc Conges a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_conges.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getDemandesConges")) {
  Write-Host "DEJA   le bloc conges existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Conges : demandes, validation et soldes annuels
// ----------------------------------------------------------------------------

export type DemandeConge = {
  id: string;
  personnelId: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  nbJoursOuvrables: number;
  motif: string | null;
  statut: 'en_attente' | 'approuve' | 'refuse';
  commentaireValidation: string | null;
  valideLe: string | null;
  createdAt: string;
  personnel: {
    nom: string;
    prenom: string | null;
    fonction: string | null;
    matricule: string | null;
  };
};

export type SoldesConges = {
  annee: number;
  joursAcquisAnnuel: number;
  soldes: {
    personnelId: string;
    nom: string;
    prenom: string | null;
    fonction: string | null;
    matricule: string | null;
    acquis: number;
    pris: number;
    restant: number;
  }[];
};

export async function getDemandesConges(
  statut?: string,
): Promise<DemandeConge[]> {
  const q = statut ? `?statut=${encodeURIComponent(statut)}` : '';
  const res = await appelApi(`/conges${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des demandes');
  return res.json();
}

export async function getSoldesConges(annee?: number): Promise<SoldesConges> {
  const q = annee ? `?annee=${annee}` : '';
  const res = await appelApi(`/conges/soldes${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des soldes');
  return res.json();
}

export async function getParametresConges(): Promise<{
  joursAcquisAnnuel: number;
}> {
  const res = await appelApi('/conges/parametres');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement des paramètres');
  return res.json();
}

export async function majParametresConges(data: {
  joursAcquisAnnuel: number;
}): Promise<void> {
  const res = await appelApi('/conges/parametres', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'enregistrement du paramètre");
}

export async function creerDemandeConge(data: {
  personnelId: string;
  type?: string;
  dateDebut: string;
  dateFin: string;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/conges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la création de la demande');
}

export async function statuerDemandeConge(
  id: string,
  data: { statut: 'approuve' | 'refuse'; commentaire?: string },
): Promise<void> {
  const res = await appelApi(`/conges/${encodeURIComponent(id)}/statut`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la décision');
}

export async function supprimerDemandeConge(id: string): Promise<void> {
  const res = await appelApi(`/conges/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors de la suppression de la demande');
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc conges ajoute"
Write-Host ("Controle : getDemandesConges = " + ([regex]::Matches($s, "export async function getDemandesConges")).Count + " (attendu 1)")
