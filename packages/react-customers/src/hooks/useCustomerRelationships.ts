import type { IAddRelationshipInput, ICustomerRelationshipDTO } from '@fonderie/client';
import { CustomersClient, FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useEffect, useState } from 'react';

export interface IUseCustomerRelationshipsReturn {
	relationships: ICustomerRelationshipDTO[];
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	addRelationship: (input: IAddRelationshipInput) => Promise<ICustomerRelationshipDTO>;
	setPrimaryRelationship: (relatedId: string) => Promise<void>;
	removeRelationship: (relatedId: string) => Promise<void>;
}

export function useCustomerRelationships(customerId: string): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	client: CustomersClient | undefined,
	customerId: string,
): IUseCustomerRelationshipsReturn;
export function useCustomerRelationships(
	clientOrId: CustomersClient | string | undefined,
	maybeId?: string,
): IUseCustomerRelationshipsReturn {
	const firstIsClient = clientOrId === undefined || clientOrId instanceof CustomersClient;
	const explicit = firstIsClient ? (clientOrId as CustomersClient | undefined) : undefined;
	const customerId = firstIsClient ? (maybeId as string) : clientOrId;
	const customers = useFonderieSubClient(explicit, (c) => c.customers, 'useCustomerRelationships');
	const [relationships, setRelationships] = useState<ICustomerRelationshipDTO[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const refresh = useCallback(async () => {
		if (!customerId) {
			setIsLoading(false);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const { result } = await customers.listRelationships(customerId);
			setRelationships(result.relationships);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [customers, customerId]);

	const addRelationship = useCallback(
		async (input: IAddRelationshipInput) => {
			setError(null);
			try {
				const { result } = await customers.addRelationship(customerId, input);
				await refresh();
				return result.relationship;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const setPrimaryRelationship = useCallback(
		async (relatedId: string) => {
			setError(null);
			try {
				await customers.setPrimaryRelationship(customerId, relatedId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	const removeRelationship = useCallback(
		async (relatedId: string) => {
			setError(null);
			try {
				await customers.removeRelationship(customerId, relatedId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[customers, customerId, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		relationships,
		isLoading,
		error,
		refresh,
		addRelationship,
		setPrimaryRelationship,
		removeRelationship,
	};
}
