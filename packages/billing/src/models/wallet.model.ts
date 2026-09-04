import type { IStoreAdapter } from '@fonderie/store';

import type { IWalletBalance } from '../types';
import {
	creditWallet,
	debitWallet,
	ensurePeriodicGrant,
	getWalletBalance,
	getWalletLedger,
} from '../services/wallet';
import type { IGrantResult, IWalletLedgerPage, IWalletMutationResult } from '../services/wallet';

export class WalletModel {
	constructor(private readonly store: IStoreAdapter) {}

	credit(opts: Parameters<typeof creditWallet>[0]): Promise<IWalletMutationResult> {
		return creditWallet(opts, this.store);
	}

	debit(opts: Parameters<typeof debitWallet>[0]): Promise<IWalletMutationResult> {
		return debitWallet(opts, this.store);
	}

	balance(sub: Parameters<typeof getWalletBalance>[0]): Promise<IWalletBalance> {
		return getWalletBalance(sub, this.store);
	}

	ledger(opts: Parameters<typeof getWalletLedger>[0]): Promise<IWalletLedgerPage> {
		return getWalletLedger(opts, this.store);
	}

	ensureGrant(opts: Parameters<typeof ensurePeriodicGrant>[0]): Promise<IGrantResult> {
		return ensurePeriodicGrant(opts, this.store);
	}
}
