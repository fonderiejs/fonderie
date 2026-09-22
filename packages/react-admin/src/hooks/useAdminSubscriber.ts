import type {
	BillingAdminClient,
	IAdminGrantInput,
	IAdminSubscriptionDTO,
	IAdminWalletDTO,
	IWalletTransactionDTO,
	SubscriberType,
} from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useCallback, useEffect, useState } from 'react';

const toError = (err: unknown) =>
	err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
const notFound = (err: unknown) => err instanceof FonderieApiError && err.status === 404;

export interface IUseAdminSubscriberReturn {
	subscription: IAdminSubscriptionDTO | null;
	// null until loaded; wallet reads are absent when billing has no wallet config (404).
	wallet: IAdminWalletDTO | null;
	ledger: IWalletTransactionDTO[];
	hasMoreLedger: boolean;
	isLoading: boolean;
	error: FonderieApiError | null;
	refresh: () => Promise<void>;
	loadMoreLedger: () => Promise<void>;
	grant: (input: Omit<IAdminGrantInput, 'subscriberType' | 'subscriberId'>) => Promise<void>;
}

// What is this subscriber on, and what does their wallet hold.
export function useAdminSubscriber(
	client: BillingAdminClient,
	subscriber: { type: SubscriberType; id: string } | null,
	options: { currency?: string; limit?: number } = {},
): IUseAdminSubscriberReturn {
	const [subscription, setSubscription] = useState<IAdminSubscriptionDTO | null>(null);
	const [wallet, setWallet] = useState<IAdminWalletDTO | null>(null);
	const [ledger, setLedger] = useState<IWalletTransactionDTO[]>([]);
	const [next, setNext] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);
	const type = subscriber?.type;
	const id = subscriber?.id;
	const { currency, limit } = options;

	const refresh = useCallback(async () => {
		if (!type || !id) {
			setSubscription(null);
			setWallet(null);
			setLedger([]);
			setNext(null);
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			const [sub, wal, led] = await Promise.all([
				client.subscription(type, id).then(
					(r) => r.result,
					(e) => (notFound(e) ? null : Promise.reject(e)),
				),
				client.wallet(type, id, currency).then(
					(r) => r.result,
					(e) => (notFound(e) ? null : Promise.reject(e)),
				),
				client
					.walletLedger(type, id, {
						...(currency ? { currency } : {}),
						...(limit ? { limit } : {}),
					})
					.then(
						(r) => r.result,
						(e) => (notFound(e) ? null : Promise.reject(e)),
					),
			]);
			setSubscription(sub);
			setWallet(wal);
			setLedger(led?.entries ?? []);
			setNext(led?.nextCursor ?? null);
		} catch (err) {
			setError(toError(err));
		} finally {
			setIsLoading(false);
		}
	}, [client, type, id, currency, limit]);

	const loadMoreLedger = useCallback(async () => {
		if (!type || !id || !next) return;
		try {
			const { result } = await client.walletLedger(type, id, {
				...(currency ? { currency } : {}),
				...(limit ? { limit } : {}),
				cursor: next,
			});
			setLedger((prev) => [...prev, ...result.entries]);
			setNext(result.nextCursor);
		} catch (err) {
			setError(toError(err));
		}
	}, [client, type, id, currency, limit, next]);

	const grant = useCallback(
		async (input: Omit<IAdminGrantInput, 'subscriberType' | 'subscriberId'>) => {
			if (!type || !id) return;
			setError(null);
			try {
				await client.grant({ ...input, subscriberType: type, subscriberId: id });
				await refresh();
			} catch (err) {
				const e = toError(err);
				setError(e);
				throw e;
			}
		},
		[client, type, id, refresh],
	);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	return {
		subscription,
		wallet,
		ledger,
		hasMoreLedger: next !== null,
		isLoading,
		error,
		refresh,
		loadMoreLedger,
		grant,
	};
}
