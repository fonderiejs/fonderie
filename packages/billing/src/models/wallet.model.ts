import type { IStoreAdapter } from '@fonderie/store';

import type { IWalletBalance } from '../types';
import {
	creditWallet,
	debitWallet,
	ensurePeriodicGrant,
	findLedgerAmountByKey,
	findPurchaseByProviderTxId,
	getWalletBalance,
	getWalletLedger,
	reverseWallet,
	sumReversedCreditsByProviderTxId,
} from '../services/wallet';
import type {
	IGrantResult,
	IWalletLedgerPage,
	IWalletMutationResult,
	IWalletPurchaseRow,
	IWalletReversalResult,
} from '../services/wallet';

export class WalletModel {
	constructor(private readonly store: IStoreAdapter) {}

	credit(opts: Parameters<typeof creditWallet>[0]): Promise<IWalletMutationResult> {
		return creditWallet(opts, this.store);
	}

	debit(opts: Parameters<typeof debitWallet>[0]): Promise<IWalletMutationResult> {
		return debitWallet(opts, this.store);
	}

	// Refund/chargeback clawback — floor-free reversal (may go negative).
	reverse(opts: Parameters<typeof reverseWallet>[0]): Promise<IWalletReversalResult> {
		return reverseWallet(opts, this.store);
	}

	findPurchase(providerTxId: string): Promise<IWalletPurchaseRow | null> {
		return findPurchaseByProviderTxId(providerTxId, this.store);
	}

	reversedCredits(providerTxId: string): Promise<bigint> {
		return sumReversedCreditsByProviderTxId(providerTxId, this.store);
	}

	ledgerAmountByKey(idempotencyKey: string): Promise<bigint | null> {
		return findLedgerAmountByKey(idempotencyKey, this.store);
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
