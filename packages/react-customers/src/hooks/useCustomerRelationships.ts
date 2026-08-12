import type {
	CustomersClient,
	IAddRelationshipInput,
	ICustomerRelationshipDTO,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
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

export function useCustomerRelationships(
	client: CustomersClient,
	customerId: string,
): IUseCustomerRelationshipsReturn {
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
			const { result } = await client.listRelationships(customerId);
			setRelationships(result.relationships);
		} catch (err) {
			const apiError =
				err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
		} finally {
			setIsLoading(false);
		}
	}, [client, customerId]);

	const addRelationship = useCallback(
		async (input: IAddRelationshipInput) => {
			setError(null);
			try {
				const { result } = await client.addRelationship(customerId, input);
				await refresh();
				return result.relationship;
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const setPrimaryRelationship = useCallback(
		async (relatedId: string) => {
			setError(null);
			try {
				await client.setPrimaryRelationship(customerId, relatedId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
	);

	const removeRelationship = useCallback(
		async (relatedId: string) => {
			setError(null);
			try {
				await client.removeRelationship(customerId, relatedId);
				await refresh();
			} catch (err) {
				const apiError =
					err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
				setError(apiError);
				throw apiError;
			}
		},
		[client, customerId, refresh],
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
