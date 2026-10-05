import type { AuthClient, IStepUpProof, StepUpMethod } from '@fonderie/client';
import { FonderieApiError } from '@fonderie/client';
import { useFonderieSubClient } from '@fonderie/vue';
import type { Ref } from 'vue';
import { ref } from 'vue';

export interface IUseStepUpReturn {
	/** How this account can prove it's them (strongest first); load it when asking. */
	methods: Ref<StepUpMethod[]>;
	loadMethods: () => Promise<StepUpMethod[]>;
	/** Send a code to the account's email or phone (accounts without a password). */
	requestCode: (channel: 'email' | 'sms') => Promise<void>;
	/** Prove it — then retry the move that answered STEP_UP_REQUIRED (isStepUpRequired). */
	confirm: (proof: IStepUpProof) => Promise<void>;
	isLoading: Ref<boolean>;
	error: Ref<FonderieApiError | null>;
}

// Step-up (docs/INSIDER-THREAT-DESIGN.md, Phase 4): see @fonderie/react-auth useStepUp.
export function useStepUp(client?: AuthClient): IUseStepUpReturn {
	const auth = useFonderieSubClient(client, (c) => c.auth, 'useStepUp');
	const methods = ref<StepUpMethod[]>([]);
	const isLoading = ref(false);
	const error = ref<FonderieApiError | null>(null);

	async function run<T>(fn: () => Promise<T>): Promise<T> {
		isLoading.value = true;
		error.value = null;
		try {
			return await fn();
		} catch (err) {
			const apiError = err instanceof FonderieApiError ? err : new FonderieApiError('unknown', String(err), 0);
			error.value = apiError;
			throw apiError;
		} finally {
			isLoading.value = false;
		}
	}

	return {
		methods,
		loadMethods: () =>
			run(async () => {
				const m = (await auth.stepUpMethods()).result.methods;
				methods.value = m;
				return m;
			}),
		requestCode: (channel) =>
			run(async () => {
				await auth.requestStepUpCode(channel);
			}),
		confirm: (proof) =>
			run(async () => {
				await auth.stepUp(proof);
			}),
		isLoading,
		error,
	};
}
