// Import necessary modules and libraries
import { $query, $update, Record, StableBTreeMap, Vec, match, Result, nat64, ic, Opt } from 'azle';
import { v4 as uuidv4 } from 'uuid';

// Enum representing possible status values for an Ad
enum AdStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
    BOUGHT = 'BOUGHT',
}

// Record type representing an Ad
type Ad = Record<{
    id: string;
    owner: string;
    itemType: string;
    itemDescription: string;
    bids: Vec<Bid>;
    status: string;
    createdAt: nat64;
    updatedAt: Opt<nat64>;
}>;

// Record type representing a Bid
type Bid = Record<{
    bidder: string;
    amount: number;
}>;

// Record type representing the payload for creating an Ad
type CreateAdPayload = Record<{
    itemType: string;
    itemDescription: string;
}>;

// Record type representing the payload for updating an Ad
type UpdateAdPayload = Record<{
    itemType: string;
    itemDescription: string;
    status: string;
}>;

// Initialize storage for Ads using a StableBTreeMap
const adStorage = new StableBTreeMap<string, Ad>(0, 44, 1024);

$update;
// Function to create a new Ad
export function createAd(payload: CreateAdPayload): Result<Ad, string> {
    try {
        // Validate payload
        if (!payload.itemType || !payload.itemDescription) {
            throw new Error('Invalid payload for creating ad');
        }

        // Create a new Ad
        const ad: Ad = {
            id: uuidv4(),
            owner: uuidv4(),
            bids: [],
            status: AdStatus.OPEN,
            createdAt: ic.time(),
            updatedAt: Opt.None,
            itemType: payload.itemType,
            itemDescription: payload.itemDescription,
        };

        // Insert the new Ad into the storage
        adStorage.insert(ad.id, ad);
        return Result.Ok(ad);
    } catch (error: any) {
        return Result.Err(error.message || 'Failed to create ad');
    }
}

$update;
// Function to update an existing Ad
export function updateAd(id: string, owner: string, payload: UpdateAdPayload): Result<Ad, string> {
    try {
        // Validate parameters
        if (!id || !owner) {
            throw new Error('Invalid parameters for updating ad');
        }

        // Validate payload
        if (!payload.itemType || !payload.itemDescription) {
            throw new Error('Invalid payload for updating ad');
        }

        // Validate payload
        if (payload.status && !(payload.status in AdStatus)) {
            throw new Error(`Invalid status! Allowed statuses are ${Object.values(AdStatus).join(', ')}`);
        }

        // Use match to handle the case where the Ad is found or not found
        return match(adStorage.get(id), {
            Some: (ad) => {
                // Check if the caller is the owner of the Ad
                if (ad.owner !== owner) return Result.Err<Ad, string>('Only the owner can edit the ad!');

                // Update Ad properties individually
                const updatedAd: Ad = {
                    ...ad,
                    itemType: payload.itemType || ad.itemType,
                    itemDescription: payload.itemDescription || ad.itemDescription,
                    status: payload.status || ad.status,
                    updatedAt: Opt.Some(ic.time()),
                };

                // Insert the updated Ad into the storage
                adStorage.insert(ad.id, updatedAd);
                return Result.Ok<Ad, string>(updatedAd);
            },
            None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found`),
        });
    } catch (error: any) {
        return Result.Err(error.message || 'Failed to update ad');
    }
}

$update;
// Function to delete an existing Ad
export function deleteAd(id: string, owner: string): Result<Ad, string> {
    try {
        // Validate parameters
        if (!id || !owner) {
            throw new Error('Invalid parameters for deleting ad');
        }

        // Use match to handle the case where the Ad is found or not found
        return match(adStorage.get(id), {
            Some: (ad) => {
                // Check if the caller is the owner of the Ad
                if (ad.owner !== owner) return Result.Err<Ad, string>('Only the owner can delete the ad!');

                // Remove the Ad from the storage
                adStorage.remove(id);
                return Result.Ok<Ad, string>(ad);
            },
            None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found`),
        });
    } catch (error: any) {
        return Result.Err<Ad, string>(error.message || 'Failed to delete ad');
    }
}

$update;
// Function to place a bid on an existing Ad
export function bidOnAd(id: string, bidder: string, amount: number): Result<Ad, string> {
    try {
        // Validate parameters
        if (!id || !bidder || isNaN(amount)) {
            throw new Error('Invalid parameters for bidding on ad');
        }

        // Use match to handle the case where the Ad is found or not found
        return match(adStorage.get(id), {
            Some: (ad) => {
                // Check if the Ad is still open for bidding
                if (ad.status !== AdStatus.OPEN) return Result.Err<Ad, string>('Ad is no longer open');
                
                // Check if the bidder is the owner of the Ad
                if (ad.owner === bidder) return Result.Err<Ad, string>("You can't bid on your own ad!");
                
                // Check if the bidder has already placed a bid on this Ad
                if (ad.bids.find((bid) => bid.bidder === bidder))
                    return Result.Err<Ad, string>(`${bidder} has already bid on this ad!`);

                // Bid on the Ad
                ad.bids.push({
                    bidder,
                    amount,
                });

                // Insert the updated Ad into the storage
                adStorage.insert(ad.id, ad);
                return Result.Ok<Ad, string>(ad);
            },
            None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found`),
        });
    } catch (error: any) {
        return Result.Err(error.message || 'Failed to bid on ad');
    }
}

$query;
// Function to retrieve all Ads
export function getAllAds(): Result<Vec<Ad>, string> {
    try {
        // Return the list of all Ads in the storage
        return Result.Ok(adStorage.values());
    } catch (error: any) {
        return Result.Err(error.message || 'Failed to retrieve ads');
    }
}

$query;
// Function to retrieve an Ad by its ID
export function getAdByID(id: string): Result<Ad, string> {
    try {
        // Use match to handle the case where the Ad is found or not found
        return match(adStorage.get(id), {
            Some: (ad) => Result.Ok<Ad, string>(ad),
            None: () => Result.Err<Ad, string>(`Ad with id of ${id} has not been found!`),
        });
    } catch (error: any) {
        return Result.Err<Ad, string>(error.message || `Failed to retrieve ad with id ${id}`);
    }
}

$query;
// Function to retrieve Ads by owner
export function getAdsByOwner(owner: string): Result<Vec<Ad>, string> {
    try {
        // Filter Ads based on the owner and return the result
        const ads = adStorage.values().filter((ad) => ad.owner === owner);
        return ads.length > 0 ? Result.Ok(ads) : Result.Err(`No ads found for ${owner}`);
    } catch (error: any) {
        return Result.Err(error.message || `Failed to retrieve ads for owner ${owner}`);
    }
}

// A workaround to make uuid package work with Azle
globalThis.crypto = {
    // @ts-ignore
    getRandomValues: () => {
        let array = new Uint8Array(32);

        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }

        return array;
    },
};
