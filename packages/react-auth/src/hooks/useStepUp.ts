import type { AuthClient, IStepUpProof, StepUpMethod } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/react';
import { useCallback, useState } from 'react';

export interface IUseStepUpReturn {
	/** How this account can prove it's them (strongest first); load it when asking. */
	methods: StepUpMethod[];
	loadMethods: () => Promise<StepUpMethod[]>;
	/** Send a code to the account's email or phone (accounts without a password). */
	requestCode: (channel: 'email' | 'sms') => Promise<void>;
	/** Prove it — then retry the move that answered STEP_UP_REQUIRED (isStepUpRequired). */
	confirm: (proof: IStepUpProof) => Promise<void>;
	isLoading: boolean;
	error: FonderieApiError | null;
}

// Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): a big move — handing a team
// over, ending a plan at once, adding a webhook — answers 403 STEP_UP_REQUIRED
// until the person proves it's still them. On success the client holds the
// proof for five minutes and sends it with every request.
export function useStepUp(client?: AuthClient): IUseStepUpReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useStepUp');
	const [methods, setMethods] = useState<StepUpMethod[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<FonderieApiError | null>(null);

	const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
		setIsLoading(true);
		setError(null);
		try {
			return await fn();
		} catch (err) {
			const apiError = err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			setError(apiError);
			throw apiError;
		} finally {
			setIsLoading(false);
		}
	}, []);

	const loadMethods = useCallback(
		() =>
			run(async () => {
				const m = (await auth.stepUpMethods()).result.methods;
				setMethods(m);
				return m;
			}),
		[auth, run],
	);
	const requestCode = useCallback(
		(channel: 'email' | 'sms') =>
			run(async () => {
				await auth.requestStepUpCode(channel);
			}),
		[auth, run],
	);
	const confirm = useCallback(
		(proof: IStepUpProof) =>
			run(async () => {
				await auth.stepUp(proof);
			}),
		[auth, run],
	);

	return { methods, loadMethods, requestCode, confirm, isLoading, error };
}
