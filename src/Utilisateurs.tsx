import { useEffect, useState } from 'react';
import {
  createUtilisateur,
  getRoles,
  getUtilisateur,
  getUtilisateurs,
  reinitialiserMotDePasse,
  updateUtilisateur,
  type Role,
  type UtilisateurGere,
} from './api';

type Props = {
  onSessionExpiree: () => void;
};

function Utilisateurs({ onSessionExpiree }: Props) {
  const moi = getUtilisateur();

  const [utilisateurs, setUtilisateurs] = useState<UtilisateurGere[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de creation
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reinitialisation de mot de passe
  const [resetPour, setResetPour] = useState<string | null>(null);
  const [nouveauMdp, setNouveauMdp] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  function gererErreur(e: Error, poserErreur: (m: string) => void) {
    if (e.message.includes('reconnecter')) {
      onSessionExpiree();
    } else {
      poserErreur(e.message);
    }
  }

  async function charger() {
    try {
      setLoading(true);
      const [liste, listeRoles] = await Promise.all([
        getUtilisateurs(),
        getRoles(),
      ]);
      setUtilisateurs(liste);
      setRoles(listeRoles);
      setError(null);
    } catch (e) {
      gererErreur(e as Error, setError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function basculerRole(id: string) {
    setRoleIds((actuels) =>
      actuels.includes(id) ? actuels.filter((r) => r !== id) : [...actuels, id],
    );
  }

  async function handleCreer(e: React.FormEvent) {
    e.preventDefault();
    if (roleIds.length === 0) {
      setFormError('Choisis au moins un rôle');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createUtilisateur({
        email,
        motDePasse,
        nom,
        prenom: prenom || undefined,
        telephone: telephone || undefined,
        roleIds,
      });
      setEmail('');
      setNom('');
      setPrenom('');
      setTelephone('');
      setMotDePasse('');
      setRoleIds([]);
      await charger();
    } catch (err) {
      gererErreur(err as Error, setFormError);
    } finally {
      setSubmitting(false);
    }
  }

  async function basculerActif(u: UtilisateurGere) {
    try {
      await updateUtilisateur(u.id, { actif: !u.actif });
      await charger();
    } catch (e) {
      gererErreur(e as Error, setError);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetPour) return;
    setResetMessage(null);
    try {
      await reinitialiserMotDePasse(resetPour, nouveauMdp);
      setResetMessage('Mot de passe réinitialisé');
      setNouveauMdp('');
      setResetPour(null);
    } catch (err) {
      gererErreur(err as Error, setError);
    }
  }

  const boutonStyle: React.CSSProperties = {
    padding: '2px 8px',
    marginRight: 4,
    cursor: 'pointer',
    fontSize: '0.8em',
  };

  return (
    <>
      <section className="card form-card">
        <h2>Nouvel utilisateur</h2>
        <form onSubmit={handleCreer} className="form">
          <div className="field">
            <label>Email (identifiant de connexion)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="accueil@kliniko.cm"
              required
            />
          </div>
          <div className="row">
            <div className="field">
              <label>Prénom</label>
              <input
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Nom</label>
              <input
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="field">
            <label>Téléphone</label>
            <input
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+237 6 00 00 00 00"
            />
          </div>
          <div className="field">
            <label>Mot de passe initial (8 caractères minimum)</label>
            <input
              type="text"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Rôles</label>
            {roles.map((r) => (
              <label
                key={r.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontWeight: 400,
                  color: 'inherit',
                  fontSize: '0.95rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={roleIds.includes(r.id)}
                  onChange={() => basculerRole(r.id)}
                />
                {r.libelle}
              </label>
            ))}
          </div>
          {formError && <p className="error">{formError}</p>}
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
      </section>

      <section className="card list-card">
        <div className="list-header">
          <h2>Utilisateurs</h2>
          <span className="count">{utilisateurs.length}</span>
        </div>
        {loading && <p className="muted">Chargement…</p>}
        {error && <p className="error">{error}</p>}
        {resetMessage && <p className="muted">{resetMessage}</p>}
        {!loading && !error && utilisateurs.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôles</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.prenom ?? ""} {u.nom}
                  </td>
                  <td className="mono">{u.email}</td>
                  <td>{u.roles.map((r) => r.libelle).join(", ") || "—"}</td>
                  <td>
                    <span
                      style={{
                        background: u.actif ? '#d9f2e5' : '#f8d9dc',
                        borderRadius: 10,
                        padding: '2px 10px',
                        fontSize: '0.85em',
                      }}
                    >
                      {u.actif ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td>
                    {u.id !== moi?.id && (
                      <button
                        type="button"
                        style={boutonStyle}
                        onClick={() => basculerActif(u)}
                      >
                        {u.actif ? 'Désactiver' : 'Réactiver'}
                      </button>
                    )}
                    <button
                      type="button"
                      style={boutonStyle}
                      onClick={() => {
                        setResetPour(resetPour === u.id ? null : u.id);
                        setNouveauMdp('');
                        setResetMessage(null);
                      }}
                    >
                      Mot de passe
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {resetPour && (
          <form
            onSubmit={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 12,
            }}
          >
            <span className="muted">Nouveau mot de passe :</span>
            <input
              type="text"
              value={nouveauMdp}
              onChange={(e) => setNouveauMdp(e.target.value)}
              minLength={8}
              required
              style={{
                padding: '0.4rem 0.6rem',
                border: '1px solid #ccc',
                borderRadius: 6,
              }}
            />
            <button
              type="submit"
              className="btn-primary"
              style={{ padding: '6px 16px', margin: 0 }}
            >
              Réinitialiser
            </button>
          </form>
        )}
      </section>
    </>
  );
}

export default Utilisateurs;
