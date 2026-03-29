import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, PLATFORM_STATS_DOC_ID } from "../../../shared/src/constants.js";

export const usersCollection = (db: Firestore) => db.collection(COLLECTIONS.users);
export const tasksCollection = (db: Firestore) => db.collection(COLLECTIONS.tasks);
export const taskCompletionsCollection = (db: Firestore) => db.collection(COLLECTIONS.taskCompletions);
export const referralsCollection = (db: Firestore) => db.collection(COLLECTIONS.referrals);
export const withdrawalsCollection = (db: Firestore) => db.collection(COLLECTIONS.withdrawals);
export const walletTransactionsCollection = (db: Firestore) => db.collection(COLLECTIONS.walletTransactions);
export const platformStatsRef = (db: Firestore) => db.collection(COLLECTIONS.stats).doc(PLATFORM_STATS_DOC_ID);

export const userRef = (db: Firestore, userId: string) => usersCollection(db).doc(userId);
export const taskRef = (db: Firestore, taskId: string) => tasksCollection(db).doc(taskId);
export const taskCompletionRef = (db: Firestore, completionId: string) => taskCompletionsCollection(db).doc(completionId);
export const referralRef = (db: Firestore, referralId: string) => referralsCollection(db).doc(referralId);
export const withdrawalRef = (db: Firestore, withdrawalId: string) => withdrawalsCollection(db).doc(withdrawalId);
export const walletTransactionRef = (db: Firestore, transactionId: string) => walletTransactionsCollection(db).doc(transactionId);
