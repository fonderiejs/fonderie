/** A stored asset's metadata row (bytes live behind the storage provider). */
export interface IMediaAsset {
	id: string;
	ownerType: string; // 'user' | 'workspace' | 'customer' | ...
	ownerId: string;
	purpose: string; // 'avatar' | 'logo' | ...
	contentType: string;
	byteSize: number;
	storageRef: string; // opaque provider handle
	createdBy: string | null;
	createdAt: Date;
}

/** What an upload records. `ownerId` defaults to the caller when omitted. */
export interface ICreateAssetInput {
	ownerType: string;
	ownerId: string;
	purpose: string;
	contentType: string;
	byteSize: number;
	storageRef: string;
	createdBy: string | null;
}
