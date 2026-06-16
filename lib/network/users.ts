import { ObjectId } from 'mongodb';
import type { KingStarsPortalUser } from './portalSession';
import { getNetworkDb } from './mongodb';

const USERS_COLLECTION_NAME = 'network_users';
const IDENTITIES_COLLECTION_NAME = 'network_user_identities';
const KINGSTARS_PRODUCT_ID = process.env.NETWORK_PRODUCT_ID ?? 'kingstars';

let indexesAreReady = false;

export type NetworkIdentityType =
  | 'email'
  | 'wallet'
  | 'telegram'
  | 'phone'
  | 'clerk_user_id'
  | 'portal_user_id';

export type NetworkIdentityProvider =
  | 'clerk'
  | 'metamask'
  | 'portal_clerk'
  | 'portal_telegram'
  | 'telegram';

export interface NetworkIdentityInput {
  type: NetworkIdentityType;
  value: string | null | undefined;
  provider: NetworkIdentityProvider;
  providerUserId?: string | null;
  verified?: boolean;
}

export interface NetworkUserProfileInput {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string | null;
  provider: NetworkIdentityProvider;
}

export interface NetworkUserSyncInput {
  productId: string;
  identities: NetworkIdentityInput[];
  profile: NetworkUserProfileInput;
  legacyUserIds: string[];
}

export interface NetworkPublicIdentity {
  type: NetworkIdentityType;
  value: string;
  provider: NetworkIdentityProvider;
  verified: boolean;
}

export interface NetworkUserProfile {
  networkUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string | null;
  provider: NetworkIdentityProvider;
  productId: string;
  legacyUserIds: string[];
  identities: NetworkPublicIdentity[];
  createdAt: Date;
  updatedAt: Date;
}

interface NetworkProductState {
  productId: string;
  createdAt: Date;
  lastSeenAt: Date;
  signInCount: number;
}

interface NetworkUserMetrics {
  signInCount: number;
}

interface NetworkUserDocument {
  _id: ObjectId;
  primaryEmail: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string | null;
  provider: NetworkIdentityProvider;
  products: Record<string, NetworkProductState>;
  metrics: NetworkUserMetrics;
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

interface NetworkIdentityDocument {
  _id: ObjectId;
  userId: ObjectId;
  type: NetworkIdentityType;
  value: string;
  normalizedValue: string;
  provider: NetworkIdentityProvider;
  providerUserId: string | null;
  verified: boolean;
  productIds: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSeenAt: Date;
}

interface ClerkEmailAddressLike {
  emailAddress: string;
}

interface ClerkWeb3WalletLike {
  web3Wallet: string;
}

interface ClerkUserLike {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  imageUrl: string;
  primaryEmailAddress: ClerkEmailAddressLike | null;
  emailAddresses: readonly ClerkEmailAddressLike[];
  primaryWeb3Wallet: ClerkWeb3WalletLike | null;
  web3Wallets: readonly ClerkWeb3WalletLike[];
}

interface NormalizedIdentity {
  type: NetworkIdentityType;
  value: string;
  normalizedValue: string;
  provider: NetworkIdentityProvider;
  providerUserId: string | null;
  verified: boolean;
}

function normalizeIdentityValue(type: NetworkIdentityType, value: string): string {
  const cleanValue = value.trim();

  if (!cleanValue) {
    throw new Error('Network identity value is empty');
  }

  if (type === 'email' || type === 'wallet') {
    return cleanValue.toLowerCase();
  }

  return cleanValue;
}

function normalizeNullableEmail(email: string | null): string | null {
  if (!email) {
    return null;
  }

  return email.trim().toLowerCase() || null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function normalizeIdentities(identities: NetworkIdentityInput[]): NormalizedIdentity[] {
  const normalizedIdentities = new Map<string, NormalizedIdentity>();

  for (const identity of identities) {
    if (!identity.value?.trim()) {
      continue;
    }

    const normalizedValue = normalizeIdentityValue(identity.type, identity.value);
    const identityKey = `${identity.type}:${normalizedValue}`;

    normalizedIdentities.set(identityKey, {
      type: identity.type,
      value: identity.value.trim(),
      normalizedValue,
      provider: identity.provider,
      providerUserId: identity.providerUserId?.trim() || null,
      verified: identity.verified ?? true,
    });
  }

  const result = Array.from(normalizedIdentities.values());

  if (result.length === 0) {
    throw new Error('Network user must have at least one identity');
  }

  return result;
}

async function ensureNetworkUserIndexes(): Promise<void> {
  if (indexesAreReady) {
    return;
  }

  const db = await getNetworkDb();

  await db.collection<NetworkIdentityDocument>(IDENTITIES_COLLECTION_NAME).createIndex(
    {
      type: 1,
      normalizedValue: 1,
    },
    {
      unique: true,
      name: 'unique_network_identity',
    },
  );

  await db.collection<NetworkIdentityDocument>(IDENTITIES_COLLECTION_NAME).createIndex(
    {
      userId: 1,
    },
    {
      name: 'network_identity_user_id',
    },
  );

  indexesAreReady = true;
}

function getDisplayName(profile: NetworkUserProfileInput): string | null {
  return (
    profile.fullName
    || [profile.firstName, profile.lastName].filter(Boolean).join(' ')
    || profile.username
    || null
  );
}

async function createNetworkUser(
  input: NetworkUserSyncInput,
  now: Date,
): Promise<ObjectId> {
  const db = await getNetworkDb();
  const userId = new ObjectId();
  const productState: NetworkProductState = {
    productId: input.productId,
    createdAt: now,
    lastSeenAt: now,
    signInCount: 0,
  };

  const user: NetworkUserDocument = {
    _id: userId,
    primaryEmail: normalizeNullableEmail(input.profile.email),
    displayName: getDisplayName(input.profile),
    firstName: input.profile.firstName,
    lastName: input.profile.lastName,
    username: input.profile.username,
    imageUrl: input.profile.imageUrl,
    provider: input.profile.provider,
    products: {
      [input.productId]: productState,
    },
    metrics: {
      signInCount: 0,
    },
    createdAt: now,
    updatedAt: now,
    lastSeenAt: now,
  };

  await db.collection<NetworkUserDocument>(USERS_COLLECTION_NAME).insertOne(user);

  return userId;
}

async function findExistingNetworkUserId(
  identities: NormalizedIdentity[],
): Promise<ObjectId | null> {
  const db = await getNetworkDb();
  const existingIdentities = await db
    .collection<NetworkIdentityDocument>(IDENTITIES_COLLECTION_NAME)
    .find({
      $or: identities.map((identity) => ({
        type: identity.type,
        normalizedValue: identity.normalizedValue,
      })),
    })
    .toArray();

  const userIds = Array.from(
    new Set(existingIdentities.map((identity) => identity.userId.toString())),
  );

  if (userIds.length > 1) {
    throw new Error('Network identities belong to different users');
  }

  return userIds[0] ? new ObjectId(userIds[0]) : null;
}

async function upsertNetworkIdentities(
  userId: ObjectId,
  productId: string,
  identities: NormalizedIdentity[],
  now: Date,
): Promise<void> {
  const db = await getNetworkDb();
  const collection = db.collection<NetworkIdentityDocument>(IDENTITIES_COLLECTION_NAME);

  await Promise.all(
    identities.map((identity) =>
      collection.updateOne(
        {
          type: identity.type,
          normalizedValue: identity.normalizedValue,
        },
        {
          $set: {
            value: identity.value,
            provider: identity.provider,
            providerUserId: identity.providerUserId,
            verified: identity.verified,
            updatedAt: now,
            lastSeenAt: now,
          },
          $setOnInsert: {
            _id: new ObjectId(),
            userId,
            type: identity.type,
            normalizedValue: identity.normalizedValue,
            productIds: [],
            createdAt: now,
          },
          $addToSet: {
            productIds: productId,
          },
        },
        {
          upsert: true,
        },
      ),
    ),
  );
}

async function touchNetworkUser(
  userId: ObjectId,
  input: NetworkUserSyncInput,
  now: Date,
): Promise<NetworkUserDocument> {
  const db = await getNetworkDb();
  const collection = db.collection<NetworkUserDocument>(USERS_COLLECTION_NAME);
  const existingUser = await collection.findOne({ _id: userId });

  if (!existingUser) {
    throw new Error('Network identity exists without network user');
  }

  const product = existingUser.products[input.productId];
  const setFields: Record<string, string | Date | null> = {
    updatedAt: now,
    lastSeenAt: now,
    provider: input.profile.provider,
    [`products.${input.productId}.productId`]: input.productId,
    [`products.${input.productId}.createdAt`]: product?.createdAt ?? now,
    [`products.${input.productId}.lastSeenAt`]: now,
  };
  const displayName = getDisplayName(input.profile);
  const primaryEmail = normalizeNullableEmail(input.profile.email);

  if (primaryEmail) {
    setFields.primaryEmail = primaryEmail;
  }

  if (displayName) {
    setFields.displayName = displayName;
  }

  if (input.profile.firstName) {
    setFields.firstName = input.profile.firstName;
  }

  if (input.profile.lastName) {
    setFields.lastName = input.profile.lastName;
  }

  if (input.profile.username) {
    setFields.username = input.profile.username;
  }

  if (input.profile.imageUrl) {
    setFields.imageUrl = input.profile.imageUrl;
  }

  await collection.updateOne(
    {
      _id: userId,
    },
    {
      $set: setFields,
      $inc: {
        'metrics.signInCount': 1,
        [`products.${input.productId}.signInCount`]: 1,
      },
    },
  );

  const updatedUser = await collection.findOne({ _id: userId });

  if (!updatedUser) {
    throw new Error('Network user disappeared after update');
  }

  return updatedUser;
}

async function getNetworkUserIdentities(userId: ObjectId): Promise<NetworkPublicIdentity[]> {
  const db = await getNetworkDb();
  const identities = await db
    .collection<NetworkIdentityDocument>(IDENTITIES_COLLECTION_NAME)
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();

  return identities.map((identity) => ({
    type: identity.type,
    value: identity.value,
    provider: identity.provider,
    verified: identity.verified,
  }));
}

function toNetworkUserProfile(
  user: NetworkUserDocument,
  input: NetworkUserSyncInput,
  identities: NetworkPublicIdentity[],
): NetworkUserProfile {
  return {
    networkUserId: user._id.toString(),
    email: user.primaryEmail,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.displayName,
    username: user.username,
    imageUrl: user.imageUrl,
    provider: user.provider,
    productId: input.productId,
    legacyUserIds: input.legacyUserIds,
    identities,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function syncNetworkUser(
  input: NetworkUserSyncInput,
): Promise<NetworkUserProfile> {
  await ensureNetworkUserIndexes();

  const now = new Date();
  const identities = normalizeIdentities(input.identities);
  let userId = await findExistingNetworkUserId(identities);

  if (!userId) {
    userId = await createNetworkUser(input, now);
  }

  await upsertNetworkIdentities(userId, input.productId, identities, now);

  const user = await touchNetworkUser(userId, input, now);
  const userIdentities = await getNetworkUserIdentities(userId);

  return toNetworkUserProfile(user, input, userIdentities);
}

export async function syncClerkNetworkUser(
  user: ClerkUserLike,
): Promise<NetworkUserProfile> {
  const primaryWallet =
    user.primaryWeb3Wallet?.web3Wallet
    ?? user.web3Wallets.find((wallet) => Boolean(wallet.web3Wallet))?.web3Wallet
    ?? null;
  const primaryEmail =
    user.primaryEmailAddress?.emailAddress
    ?? user.emailAddresses[0]?.emailAddress
    ?? null;
  const provider: NetworkIdentityProvider = primaryWallet ? 'metamask' : 'clerk';

  return syncNetworkUser({
    productId: KINGSTARS_PRODUCT_ID,
    identities: [
      {
        type: 'wallet',
        value: primaryWallet,
        provider: 'metamask',
        providerUserId: user.id,
      },
      {
        type: 'email',
        value: primaryEmail,
        provider: 'clerk',
        providerUserId: user.id,
      },
      {
        type: 'clerk_user_id',
        value: user.id,
        provider: 'clerk',
        providerUserId: user.id,
      },
    ],
    profile: {
      email: primaryEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      username: user.username,
      imageUrl: user.imageUrl,
      provider,
    },
    legacyUserIds: uniqueStrings([user.id]),
  });
}

export async function syncPortalNetworkUser(
  user: KingStarsPortalUser,
): Promise<NetworkUserProfile> {
  const provider: NetworkIdentityProvider =
    user.authProvider === 'telegram' ? 'portal_telegram' : 'portal_clerk';
  const [firstName, ...lastNameParts] = user.name.split(' ');
  const telegramIdentity = user.authProvider === 'telegram' ? user.userId : null;

  return syncNetworkUser({
    productId: KINGSTARS_PRODUCT_ID,
    identities: [
      {
        type: 'email',
        value: user.emailAddress,
        provider,
        providerUserId: user.userId,
      },
      {
        type: 'telegram',
        value: telegramIdentity,
        provider: 'telegram',
        providerUserId: user.userId,
      },
      {
        type: 'portal_user_id',
        value: user.userId,
        provider,
        providerUserId: user.userId,
      },
    ],
    profile: {
      email: user.emailAddress,
      firstName: firstName || user.name,
      lastName: lastNameParts.join(' ') || null,
      fullName: user.name,
      username: user.username,
      imageUrl: user.imageUrl,
      provider,
    },
    legacyUserIds: uniqueStrings([user.userId]),
  });
}

export async function syncTelegramNetworkUser(input: {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  phoneNumber?: string | null;
}): Promise<NetworkUserProfile> {
  const fullName =
    [input.firstName, input.lastName].filter(Boolean).join(' ')
    || input.username
    || `Telegram ${input.id}`;

  return syncNetworkUser({
    productId: KINGSTARS_PRODUCT_ID,
    identities: [
      {
        type: 'telegram',
        value: input.id,
        provider: 'telegram',
        providerUserId: input.id,
      },
      {
        type: 'phone',
        value: input.phoneNumber,
        provider: 'telegram',
        providerUserId: input.id,
      },
    ],
    profile: {
      email: null,
      firstName: input.firstName,
      lastName: input.lastName,
      fullName,
      username: input.username,
      imageUrl: input.photoUrl,
      provider: 'telegram',
    },
    legacyUserIds: uniqueStrings([input.id]),
  });
}

export async function syncKingStarsNetworkUser(input: {
  clerkUser: ClerkUserLike | null;
  portalUser: KingStarsPortalUser | null;
}): Promise<NetworkUserProfile | null> {
  if (input.clerkUser) {
    return syncClerkNetworkUser(input.clerkUser);
  }

  if (input.portalUser) {
    if (input.portalUser.source === 'telegram') {
      return syncTelegramNetworkUser({
        id: input.portalUser.userId,
        username: input.portalUser.username,
        firstName: input.portalUser.name.split(' ')[0] || input.portalUser.name,
        lastName: input.portalUser.name.split(' ').slice(1).join(' ') || null,
        photoUrl: input.portalUser.imageUrl,
        phoneNumber: null,
      });
    }

    return syncPortalNetworkUser(input.portalUser);
  }

  return null;
}
