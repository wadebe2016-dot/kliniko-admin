import { useState } from 'react';
import { changerMonMotDePasse, getUtilisateur } from './api';

type Props = {
  onSessionExpiree: () => void;
};

function MonCompte({ onSessionExpiree }: Props) {
  const moi = getUtilisateur();

  const [ancien, setAncien] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setSucces(false);

    if (nouveau !== confirmation) {
      setErreur('Le nouveau mot de passe et sa confirmation different');
      return;
    }
    if (nouveau.length < 8) {
      setErreur('Le nouveau mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setEnCours(true);
    try {
      await changerMonMotDePasse(ancien, nouveau);
      setAncien('');
      setNouveau('');
      setConfirmation('');
      setSucces(true);
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('reconnecter')) {
        onSessionExpiree();
      } else {
        setErreur(message);
      }
    } finally {
      setEnCours(false);
    }
  }

  return (
    <>
      <section className="card form-card">
        <h2>Changer mon mot de passe</h2>
        <form onSubmit={handleSubmit} className="form">
          <div className="field">
            <label>Mot de passe actuel</label>
            <input
              type="password"
              value={ancien}
              onChange={(e) => setAncien(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
            />
          </div>
          {erreur && <p className="error">{erreur}</p>}
          {succes && (
            <p className="muted">
              Mot de passe modifié. Il sera demandé à la prochaine connexion.
            </p>
          )}
          <button type="submit" disabled={enCours} className="btn-primary">
            {enCours ? 'Enregistrement…' : 'Changer mon mot de passe'}
          </button>
        </form>
      </section>

      <section className="card list-card">
        <div className="list-header">
          <h2>Mon compte</h2>
        </div>
        <p>
          <strong>Nom :</strong> {moi?.prenom ?? ''} {moi?.nom ?? ''}
        </p>
        <p>
          <strong>Email :</strong> {moi?.email ?? '—'}
        </p>
        <p>
          <strong>Rôles :</strong> {moi?.roles.join(', ') || '—'}
        </p>
        <p className="muted">
          Un mot de passe solide comporte au moins huit caractères, mêlant
          lettres, chiffres et symboles.
        </p>
      </section>
    </>
  );
}

export default MonCompte;
