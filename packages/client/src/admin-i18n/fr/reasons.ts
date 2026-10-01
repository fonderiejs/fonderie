import type en from '../en/reasons';

const reasons: typeof en = {
	admin: {
		CHECK_TIMED_OUT: 'Délai dépassé après {ms} ms.',
		CHECK_THREW: 'La vérification a planté : {detail}',
		CHECK_FAILED: 'La vérification a échoué sans en donner la raison.',
		MIGRATIONS_PENDING: '{module} : {count} migration(s) non appliquée(s) — {files}',
		OPERATOR_KEY_INVALID:
			'operatorKey doit comporter 64 caractères hexadécimaux (openssl rand -hex 32).',
	},
	auth: {
		JWT_SECRET_TOO_SHORT: 'jwtSecret doit comporter au moins {min} caractères (il en a {got}).',
		JWT_SECRET_PLACEHOLDER: 'jwtSecret ressemble à une valeur d’exemple ou de développement.',
		JWT_PREVIOUS_SECRET_WEAK: 'jwtPreviousSecrets[{index}] est trop court ou ressemble à une valeur d’exemple — il vérifie encore des jetons.',
		INSECURE_COOKIES:
			'secureCookies est désactivé — les cookies de connexion peuvent circuler en HTTP non chiffré en production.',
		GOOGLE_INCOMPLETE:
			'La connexion Google est configurée, mais l’ID client, le secret client ou l’URI de redirection manque.',
		GOOGLE_SECRET_PLACEHOLDER:
			'Le secret client Google ressemble à une valeur d’exemple ou de développement.',
		APPLE_INCOMPLETE:
			'Se connecter avec Apple est configuré, mais l’ID client, l’ID d’équipe, l’ID de clé, la clé privée ou l’URI de redirection manque.',
		APPLE_KEY_NOT_PEM:
			'La clé privée Apple n’est pas une clé PEM .p8 (attendu : -----BEGIN PRIVATE KEY-----).',
		APPLE_NATIVE_IDS_INVALID:
			'Les ID clients natifs Apple doivent être des identifiants de bundle exacts — une entrée vide ou générique accepterait des jetons émis pour d’autres applications.',
		MFA_KEY_MISSING:
			'La double authentification est active sans mfaSecretKey — les secrets d’authentificateur sont stockés en clair. Définissez une clé de 32 octets (openssl rand -hex 32).',
		MFA_KEY_INVALID:
			'mfaSecretKey doit comporter 64 caractères hexadécimaux (openssl rand -hex 32).',
	},
	billing: {
		PRICE_CHECK_FAILED: 'La vérification des prix n’a pas pu s’exécuter : {detail}',
		PRICE_NOT_FOUND: '{ref} : le prix {price} n’existe pas chez le prestataire de paiement.',
		PRICE_INACTIVE: '{ref} : le prix {price} est inactif chez le prestataire de paiement.',
		PRICE_MISMATCH:
			'{ref} : le catalogue indique {declared}, le prestataire facture {actual}. Les achats par carte enregistrée et la recharge automatique utilisent le catalogue ; le paiement hébergé utilise le prestataire.',
		WEBHOOK_CHECK_FAILED: 'La vérification des webhooks n’a pas pu s’exécuter : {detail}',
		WEBHOOK_NOT_REGISTERED:
			'{url} n’est pas enregistré — aucun des événements traités ici n’arrivera jamais.',
		WEBHOOK_DISABLED: '{url} est désactivé chez le prestataire — il n’envoie rien.',
		WEBHOOK_EVENTS_MISSING:
			'{url} n’est pas abonné à {events} — ces traitements ne pourront jamais s’exécuter.',
		WEBHOOK_API_VERSION:
			'{url} envoie ses données en version {endpointVersion} ; cette application lit la version {clientVersion}. Les factures sont lues de façon tolérante, donc rien n’est perdu, mais l’écart doit être résorbé : recréez l’endpoint en {clientVersion} (nouveau secret de signature).',
		DRIFT_CHECK_FAILED: 'La vérification des abonnements n’a pas pu s’exécuter : {detail}',
		SUBSCRIPTION_MISSING_AT_PROVIDER:
			'{subscriber} ({subscription}) : noté {status} ici, mais le prestataire n’a aucun abonnement de ce nom — {impact}.',
		SUBSCRIPTION_FIELDS_DIFFER:
			'{subscriber} ({subscription}) : {fields} diffèrent — ici {ours}, chez le prestataire {theirs} — {impact}.',
		DRIFT_TRUNCATED: 'Seule une partie des abonnements a été comparée : {note}',
		NOTIFICATIONS_UNWIRED:
			'Les paiements sont actifs, mais les clients ne peuvent pas être prévenus — passez un bus d’événements et resolveRecipient à BillingModule pour envoyer reçus, remboursements et avis d’échec de paiement.',
		AUTO_RECHARGE_UNSUPPORTED:
			'La formule {plan} active la recharge automatique, mais le prestataire {provider} ne peut pas débiter une carte enregistrée — elle n’aura jamais lieu.',
		AUTO_RECHARGE_UNKNOWN_PACK:
			'La formule {plan} recharge avec le pack de crédits {pack}, qui n’existe pas — ajoutez-le au catalogue.',
		ALLOWANCE_WITHOUT_WALLET:
			'La formule {plan} accorde un solde, mais le portefeuille est désactivé — ce solde n’a aucun effet.',
		NEGATIVE_ROLLOVER_CAP:
			'La formule {plan} a un plafond de report négatif ({cap}) — utilisez 0 ou plus, none ou full.',
		WEBHOOK_SECRET_MISSING:
			'Le secret du webhook d’abonnement n’est pas défini — les appels de Stripe à /billing/webhook échouent et les renouvellements et résiliations ne sont jamais appliqués.',
		WALLET_WEBHOOK_SECRET_MISSING:
			'Le secret du webhook du portefeuille n’est pas défini — les appels de Stripe à /billing/webhook/payment échouent et les achats de packs de crédits ne sont jamais crédités.',
		PROVIDER_CANNOT_BE_ASKED:
			'Le prestataire de paiement ne peut pas répondre à cette vérification.',
		PUBLIC_URL_NOT_SET:
			'L’URL publique de l’API n’est pas définie : les endpoints de webhook ne peuvent pas être vérifiés.',
	},
	config: {
		NO_SECRET_ENCRYPTOR:
			'Aucune clé de chiffrement des secrets — la page des secrets refuse toute requête plutôt que de stocker en clair. Définissez CONFIG_SECRET_KEY.',
	},
	core: {
		ADMIN_TOKEN_TOO_SHORT:
			'Le jeton d’administration doit comporter au moins {min} caractères (il en a {got}).',
		ADMIN_TOKEN_PLACEHOLDER:
			'Le jeton d’administration ressemble à une valeur d’exemple ou de développement.',
	},
	courier: {
		CHANNEL_WITHOUT_PROVIDER:
			'{count} type(s) de message sont envoyés par {channel}, mais aucun fournisseur {channel} n’est configuré — ils sont perdus sans avertissement : {types}.',
		TEMPLATES_UNROUTED:
			'{count} type(s) de message ont un modèle mais aucun canal : ils ne sont jamais envoyés : {types}.',
		SENDER_DNS_CHECK_FAILED: 'La vérification DNS de l’expéditeur n’a pas pu s’exécuter : {detail}',
		SPF_MULTIPLE:
			'{count} enregistrements SPF sur {domain} — les destinataires considèrent alors qu’il n’y a aucun SPF.',
		DMARC_MISSING:
			'Aucun enregistrement DMARC pour {domain} — les destinataires jugent vos e-mails selon leurs propres règles.',
		DMARC_MONITORING_ONLY:
			'Le DMARC de {domain} est en simple observation (p=none) : les e-mails usurpés sont quand même livrés. Passez à quarantine ou reject quand les rapports sont propres.',
		DKIM_KEY_MISSING:
			'Aucune clé DKIM sur {host} — les e-mails signés avec le sélecteur {selector} ne peuvent pas être vérifiés.',
		SPF_ABSENT_DKIM_ALIGNS:
			'Aucun enregistrement SPF sur {domain}, ce qui est normal quand votre fournisseur gère l’adresse de retour ; DMARC passe grâce au DKIM.',
		SPF_AND_DKIM_MISSING:
			'Aucun enregistrement SPF sur {domain} et aucune clé DKIM — DMARC ne peut pas passer : vos e-mails ne sont pas authentifiés.',
		SPF_ABSENT_DKIM_UNKNOWN:
			'Aucun enregistrement SPF sur {domain}. C’est normal si votre fournisseur gère l’adresse de retour et publie le DKIM — indiquez les sélecteurs DKIM pour le confirmer.',
	},
	events: {
		NO_INTEGRITY_KEY:
			'Aucune clé d’intégrité — le journal des événements n’est pas protégé contre la falsification.',
		WEAK_INTEGRITY_KEY:
			'La clé d’intégrité est trop courte ou ressemble à une valeur d’exemple — les signatures des événements pourraient être falsifiées. Générez-en une avec openssl rand -hex 32.',
		TRANSPORT_NOT_STARTED: 'Le transport des événements n’a pas encore démarré.',
		EVENT_TAMPERED: 'L’événement {event} ne correspond plus à sa signature — il a été modifié.',
		EVENTS_UNSIGNED: '{count} événement(s) antérieurs à la signature ne peuvent pas être vérifiés.',
		EVENT_DEAD: '{type} ({consumer}) a échoué à chaque tentative et ne sera jamais livré : {error}',
		BACKLOG_STALE: '{consumer} : {waiting} en attente, le plus ancien depuis {minutes} min.',
	},
	values: {
		impact: {
			UNDER_GRANTING: 'le client n’a pas accès à ce qu’il a payé',
			OVER_GRANTING: 'l’accès est accordé sans paiement',
			METADATA: 'détails seulement, sans effet sur l’accès',
		},
	},
};
export default reasons;
