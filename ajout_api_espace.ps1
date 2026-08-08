# Ajoute le bloc Mon espace a src\api.ts (kliniko-admin). Idempotent.
#   powershell -ExecutionPolicy Bypass -File .\ajout_api_espace.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\api.ts"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  api.ts introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("getMonApercu")) {
  Write-Host "DEJA   le bloc espace existe - rien a faire."
  exit 0
}

$bloc = @'

// ----------------------------------------------------------------------------
// Mon espace : les donnees de l'utilisateur connecte uniquement
// ----------------------------------------------------------------------------

export type MonApercu = {
  lie: boolean;
  personnel?: {
    nom: string;
    prenom: string | null;
    fonction: string | null;
    service: string | null;
    matricule: string | null;
    dateEmbauche: string | null;
    typeContrat: string | null;
  };
  conges?: {
    annee: number;
    acquis: number;
    pris: number;
    restant: number;
    enAttente: number;
  };
  bulletins?: {
    nb: number;
    dernier: { mois: number; annee: number; statutVersement: string } | null;
  };
};

export type MesConges = {
  solde: { annee: number; acquis: number; pris: number; restant: number };
  demandes: DemandeConge[];
};

export async function getMonApercu(): Promise<MonApercu> {
  const res = await appelApi('/moi/apercu');
  if (!res.ok) await echecOrdonnance(res, "Erreur lors du chargement de l'espace");
  return res.json();
}

export async function getMesConges(): Promise<MesConges> {
  const res = await appelApi('/moi/conges');
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement de vos congés');
  return res.json();
}

export async function creerMaDemandeConge(data: {
  type?: string;
  dateDebut: string;
  dateFin: string;
  motif?: string;
}): Promise<void> {
  const res = await appelApi('/moi/conges', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) await echecOrdonnance(res, "Erreur lors de l'envoi de la demande");
}

export async function getMesBulletins(annee?: number): Promise<BulletinPaie[]> {
  const q = annee ? `?annee=${annee}` : '';
  const res = await appelApi(`/moi/bulletins${q}`);
  if (!res.ok) await echecOrdonnance(res, 'Erreur lors du chargement de vos bulletins');
  return res.json();
}
'@

$s = $s.TrimEnd() + "`r`n" + $bloc + "`r`n"
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     bloc espace ajoute"
Write-Host ("Controle : getMonApercu = " + ([regex]::Matches($s, "export async function getMonApercu")).Count + " (attendu 1)")
