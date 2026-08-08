# Ajoute le code QR de verification au gabarit d'impression des ordonnances.
# Prerequis :  npm install qrcode  et  npm install -D @types/qrcode
#   powershell -ExecutionPolicy Bypass -File .\qr_ordonnance.ps1

$chemin = "C:\Users\wadeb\kliniko-admin\src\Ordonnances.tsx"
if (-not (Test-Path $chemin)) { Write-Host "ECHEC  Ordonnances.tsx introuvable"; exit 1 }

$octets = [System.IO.File]::ReadAllBytes($chemin)
$s = [System.Text.Encoding]::UTF8.GetString($octets)

if ($s.Contains("from 'qrcode'")) {
  Write-Host "DEJA   le QR est deja en place - rien a faire."
  exit 0
}

# --- 1. Import de la bibliotheque ---
$ancreImport = "} from './api';"
if (-not $s.Contains($ancreImport)) { Write-Host "ECHEC  ancre import absente"; exit 1 }
$s = $s.Replace($ancreImport, $ancreImport + "`r`nimport QRCode from 'qrcode';")

# --- 2. Remplacement de la fonction d'impression ---
$debut = $s.IndexOf("function imprimer(o: Ordonnance) {")
$ancreFin = "window.setTimeout(() => document.body.removeChild(cadre), 2000);"
$posFin = $s.IndexOf($ancreFin)
if ($debut -lt 0 -or $posFin -lt 0) {
  Write-Host "ECHEC  ancres de la fonction imprimer introuvables"
  exit 1
}
$fin = $s.IndexOf("}", $posFin + $ancreFin.Length) + 1

$nouveau = @'
async function imprimer(o: Ordonnance) {
  const patient = `${o.patient.nom} ${o.patient.prenom ?? ''}`.trim();
  const age = o.patient.dateNaissance
    ? Math.floor(
        (Date.now() - new Date(o.patient.dateNaissance).getTime()) / 31557600000,
      )
    : null;
  const praticien = o.praticien
    ? `${o.praticien.prenom ?? ''} ${o.praticien.nom}`.trim()
    : '';

  // Code QR vers la page publique de verification
  let qr = '';
  try {
    qr = await QRCode.toDataURL(
      `${window.location.origin}/api/public/ordonnances/${o.id}`,
      { margin: 0, width: 240 },
    );
  } catch {
    // sans QR : l'impression reste possible
  }

  const bandeau =
    o.statut === 'brouillon'
      ? '<div class="bandeau">BROUILLON — NON SIGNÉE</div>'
      : o.statut === 'annulee'
        ? '<div class="bandeau">ORDONNANCE ANNULÉE</div>'
        : '';

  const sousPatient = [
    `Dossier ${echapper(o.patient.numeroDossier)}`,
    age !== null ? `${age} ans` : '',
    o.patient.sexe ? (o.patient.sexe === 'M' ? 'Masculin' : 'Féminin') : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const lignes = o.lignes
    .map(
      (l, n) => `
      <div class="ligne">
        <div class="num">${n + 1}</div>
        <div class="corps">
          <div class="med">${echapper(l.libelle)}</div>
          <div class="pos">${echapper(l.posologie)}</div>
          <div class="det">${[
            l.duree ? `Durée : ${echapper(l.duree)}` : '',
            l.quantite ? `Quantité : ${echapper(l.quantite)}` : '',
            l.voie ? `Voie : ${echapper(l.voie)}` : '',
          ]
            .filter(Boolean)
            .join('&ensp;·&ensp;')}</div>
          ${l.instructions ? `<div class="det">${echapper(l.instructions)}</div>` : ''}
        </div>
      </div>`,
    )
    .join('');

  const lieuDate = o.hopital.ville
    ? `Fait à ${echapper(o.hopital.ville)}, le ${jour(o.dateOrdonnance)}`
    : `Le ${jour(o.dateOrdonnance)}`;

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${echapper(o.numero)}</title>
<style>
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #1c2430; font-size: 10.5pt; }
  .entete { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid #0f766e; padding-bottom: 12px; }
  .clinique h1 { font-size: 19pt; color: #0f766e; letter-spacing: 0.5px; }
  .clinique p { color: #5b6572; font-size: 9.5pt; margin-top: 4px; }
  .cartouche { border: 1.5px solid #0f766e; border-radius: 8px; padding: 8px 14px;
               text-align: right; flex: none; }
  .cartouche .no { font-weight: 700; color: #0f766e; font-size: 11pt; white-space: nowrap; }
  .cartouche .dt { color: #5b6572; font-size: 9.5pt; margin-top: 2px; }
  .bandeau { text-align: center; color: #b91c1c; border: 2px dashed #b91c1c; border-radius: 6px;
             padding: 6px; letter-spacing: 2px; font-weight: 700; margin-top: 14px; }
  .titre { display: flex; align-items: center; gap: 14px; margin: 20px 0 16px;
           font-size: 12.5pt; letter-spacing: 4px; font-weight: 600; }
  .titre::before, .titre::after { content: ''; flex: 1; border-top: 1px solid #cbd5e1; }
  .identites { display: flex; gap: 12px; margin-bottom: 18px; }
  .boite { flex: 1; background: #f4f7f6; border: 1px solid #e2e8f0; border-radius: 8px;
           padding: 10px 14px; }
  .boite .lab { font-size: 8pt; letter-spacing: 2px; color: #0f766e; font-weight: 700;
                margin-bottom: 4px; }
  .boite .nom { font-weight: 700; font-size: 11.5pt; }
  .boite .sub { color: #5b6572; font-size: 9.5pt; margin-top: 2px; }
  .ligne { display: flex; gap: 12px; padding: 10px 2px; border-bottom: 1px dashed #d7dee6; }
  .lignes .ligne:last-child { border-bottom: none; }
  .num { width: 22px; height: 22px; border-radius: 50%; background: #0f766e; color: #fff;
         font-size: 10pt; font-weight: 700; display: flex; align-items: center;
         justify-content: center; flex: none; margin-top: 2px; }
  .med { font-weight: 700; font-size: 11.5pt; }
  .pos { font-size: 10.5pt; margin-top: 2px; }
  .det { font-size: 9.5pt; color: #5b6572; margin-top: 2px; }
  .notes { margin-top: 14px; font-style: italic; color: #374151; border-left: 3px solid #0f766e;
           background: #f8fafc; padding: 7px 12px; font-size: 10pt; border-radius: 0 6px 6px 0; }
  .final { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; }
  .lieu { font-size: 10pt; color: #374151; }
  .verif { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .verif img { width: 22mm; height: 22mm; }
  .verif .note { font-size: 8pt; color: #8a94a1; line-height: 1.5; }
  .signature { text-align: center; font-size: 10pt; }
  .cadre-sign { border: 1px solid #cbd5e1; border-radius: 8px; width: 68mm; height: 30mm;
                margin-top: 6px; position: relative; }
  .cadre-sign span { position: absolute; bottom: 4px; left: 0; right: 0; font-size: 8pt;
                     color: #94a3b8; }
  .pied { border-top: 1px solid #e2e8f0; margin-top: 22px; padding-top: 6px;
          font-size: 8.5pt; color: #8a94a1; text-align: center; }
</style></head><body>
<header class="entete">
  <div class="clinique">
    <h1>${echapper(o.hopital.nom)}</h1>
    <p>${[echapper(o.hopital.ville), echapper(o.hopital.telephone)].filter(Boolean).join(' — ')}</p>
  </div>
  <div class="cartouche">
    <div class="no">N° ${echapper(o.numero)}</div>
    <div class="dt">${jour(o.dateOrdonnance)}</div>
  </div>
</header>
${bandeau}
<div class="titre">ORDONNANCE MÉDICALE</div>
<div class="identites">
  <div class="boite">
    <div class="lab">PATIENT</div>
    <div class="nom">${echapper(patient)}</div>
    <div class="sub">${sousPatient}</div>
  </div>
  <div class="boite">
    <div class="lab">PRESCRIPTEUR</div>
    <div class="nom">${praticien ? echapper(praticien) : '—'}</div>
    ${o.praticien?.specialite ? `<div class="sub">${echapper(o.praticien.specialite)}</div>` : ''}
  </div>
</div>
<div class="lignes">${lignes}</div>
${o.notes ? `<div class="notes">${echapper(o.notes)}</div>` : ''}
<div class="final">
  <div>
    <div class="lieu">${lieuDate}</div>
    ${qr ? `<div class="verif"><img src="${qr}" alt="Code QR de vérification"><div class="note">Scannez pour vérifier<br>l'authenticité de<br>cette ordonnance</div></div>` : ''}
  </div>
  <div class="signature">
    <b>${praticien ? echapper(praticien) : ''}</b>
    <div class="cadre-sign"><span>Signature et cachet</span></div>
  </div>
</div>
<div class="pied">Ordonnance ${echapper(o.numero)} — ${echapper(o.hopital.nom)}</div>
</body></html>`;

  const cadre = document.createElement('iframe');
  cadre.style.position = 'fixed';
  cadre.style.right = '0';
  cadre.style.bottom = '0';
  cadre.style.width = '0';
  cadre.style.height = '0';
  cadre.style.border = '0';
  document.body.appendChild(cadre);
  const doc = cadre.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();
  cadre.contentWindow?.focus();
  cadre.contentWindow?.print();
  window.setTimeout(() => document.body.removeChild(cadre), 2000);
}
'@

$s = $s.Substring(0, $debut) + $nouveau + $s.Substring($fin)
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($chemin, $s, $enc)

Write-Host "OK     import qrcode + gabarit avec QR"
Write-Host ("Controle : verif = " + ([regex]::Matches($s, "class=`"verif`"")).Count + " occurrence (attendu 1)")
