import type en from './en';

const workspaces: typeof en = {
	roles: {
		ADMIN: 'Administrateur',
		GUEST: 'Invité',
	},
	invitationStatus: {
		PENDING: 'En attente',
		ACCEPTED: 'Acceptée',
		REJECTED: 'Refusée',
		CANCELLED: 'Annulée',
	},
	members: {
		title: 'Membres de l’équipe',
		loading: 'Chargement de l’équipe…',
		invite: 'Inviter',
		remove: 'Retirer',
		a11y: {
			invite: 'Inviter des membres',
			remove: 'Retirer {member} de l’espace de travail',
		},
	},
	invite: {
		title: 'Inviter des membres',
		email: 'Adresse courriel',
		submit: 'Envoyer l’invitation',
		submitShort: 'Envoyer',
		submitting: 'Envoi…',
		pending: 'Invitations en attente',
		loading: 'Chargement…',
		cancel: 'Annuler',
		backToTeam: 'Retour à l’équipe',
		a11y: {
			email: 'Champ du courriel',
			emailHint: 'Saisissez l’adresse courriel de la personne à inviter',
			submit: 'Bouton Envoyer l’invitation',
			cancel: 'Annuler l’invitation de {email}',
		},
	},
	accept: {
		title: 'Invitation à un espace de travail',
		body: 'Vous avez été invité à vous joindre à un espace de travail. Acceptez l’invitation pour en devenir membre.',
		submit: 'Accepter l’invitation',
		submitting: 'Acceptation…',
		notNow: 'Pas maintenant',
		acceptedTitle: 'Invitation acceptée',
		acceptedBody: 'Vous vous êtes joint à l’espace de travail.',
		a11y: {
			submit: 'Bouton Accepter l’invitation',
		},
	},
};

export default workspaces;
