export interface IPermissionsConfig {
	// When true, a permission of action='*' or resource='*' matches anything
	// Default: true
	wildcards?: boolean;

	// Super-admin role name — members with this role bypass all checks
	// Default: 'owner'
	superRole?: string;
}
