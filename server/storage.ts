import {
  users,
  userTokens,
  billSubmissions,
  userCredits,
  paymentRequests,
  paymentHistory,
  type User,
  type UpsertUser,
  type UserToken,
  type InsertUserToken,
  type BillSubmission,
  type InsertBillSubmission,
  type UserCredits,
  type PaymentRequest,
  type PaymentHistory,
  type BankTransferRequest,
  type VoucherRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, lt, sql } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  validateUserCredentials(email: string, password: string): Promise<User | null>;
  
  // Token operations
  createUserToken(token: InsertUserToken): Promise<UserToken>;
  getUserToken(token: string, type: "email_verification" | "password_reset"): Promise<UserToken | undefined>;
  deleteUserToken(token: string): Promise<void>;
  deleteExpiredTokens(): Promise<void>;
  
  // Security operations
  incrementFailedLogins(userId: string): Promise<void>;
  resetFailedLogins(userId: string): Promise<void>;
  lockUser(userId: string, until: Date): Promise<void>;
  updateLastLogin(userId: string): Promise<void>;
  
  // Submission operations
  getUserSubmissions(userId: string): Promise<BillSubmission[]>;
  getAllSubmissions(): Promise<BillSubmission[]>;
  createSubmission(submission: InsertBillSubmission): Promise<BillSubmission>;
  updateSubmissionStatus(id: number, status: "in_valutazione" | "approvata" | "respinta"): Promise<BillSubmission>;
  
  // Payment system operations
  getUserCredits(userId: string): Promise<UserCredits>;
  createUserCredits(userId: string): Promise<UserCredits>;
  updateUserCredits(userId: string, available: number, withdrawn: number): Promise<UserCredits>;
  updateUserRewardStatus(userId: string, status: "in_attesa" | "buono_inviato" | "accreditato", adminNotes?: string): Promise<UserCredits>;
  getAllUserCredits(): Promise<UserCredits[]>;
  getPaymentRequests(userId: string): Promise<PaymentRequest[]>;
  getPaymentHistory(userId: string): Promise<PaymentHistory[]>;
  createBankTransferRequest(userId: string, data: BankTransferRequest): Promise<PaymentRequest>;
  createVoucherRequest(userId: string, data: VoucherRequest): Promise<PaymentRequest>;
  updatePaymentRequestStatus(id: number, status: string, adminNotes?: string): Promise<PaymentRequest>;
  createPaymentHistory(data: any): Promise<PaymentHistory>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Token operations
  async createUserToken(tokenData: InsertUserToken): Promise<UserToken> {
    const [token] = await db
      .insert(userTokens)
      .values(tokenData)
      .returning();
    return token;
  }

  async getUserToken(token: string, type: "email_verification" | "password_reset"): Promise<UserToken | undefined> {
    const [tokenRecord] = await db
      .select()
      .from(userTokens)
      .where(and(
        eq(userTokens.token, token),
        eq(userTokens.type, type),
        lt(new Date(), userTokens.expiresAt) // Token not expired
      ));
    return tokenRecord;
  }

  async deleteUserToken(token: string): Promise<void> {
    await db.delete(userTokens).where(eq(userTokens.token, token));
  }

  async deleteExpiredTokens(): Promise<void> {
    await db.delete(userTokens).where(lt(userTokens.expiresAt, new Date()));
  }

  // Security operations
  async incrementFailedLogins(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        failedLoginAttempts: sql`${users.failedLoginAttempts} + 1`,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  async lockUser(userId: string, until: Date): Promise<void> {
    await db
      .update(users)
      .set({ 
        lockedUntil: until,
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  async updateLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ 
        lastLoginAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Submission operations
  async getUserSubmissions(userId: string): Promise<BillSubmission[]> {
    const submissions = await db.select()
      .from(billSubmissions)
      .where(eq(billSubmissions.userId, userId))
      .orderBy(desc(billSubmissions.createdAt));
    return submissions;
  }

  async getAllSubmissions(): Promise<BillSubmission[]> {
    return await db.select().from(billSubmissions).orderBy(desc(billSubmissions.createdAt));
  }

  async createSubmission(submissionData: InsertBillSubmission): Promise<BillSubmission> {
    const [submission] = await db
      .insert(billSubmissions)
      .values(submissionData)
      .returning();
    return submission;
  }

  async updateSubmissionStatus(id: number, status: "in_valutazione" | "approvata" | "respinta"): Promise<BillSubmission> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === "approvata") {
      updateData.approvedAt = new Date();
      // Set earnings available date to 30 days from now (simulating switch completion)
      const availableDate = new Date();
      availableDate.setDate(availableDate.getDate() + 30);
      updateData.earningsAvailableAt = availableDate;
    }
    
    const [submission] = await db
      .update(billSubmissions)
      .set(updateData)
      .where(eq(billSubmissions.id, id))
      .returning();
    return submission;
  }

  // Payment system operations
  async getUserCredits(userId: string): Promise<UserCredits> {
    let [credits] = await db.select().from(userCredits).where(eq(userCredits.userId, userId));
    
    if (!credits) {
      credits = await this.createUserCredits(userId);
    }
    
    return credits;
  }

  async createUserCredits(userId: string): Promise<UserCredits> {
    const [credits] = await db
      .insert(userCredits)
      .values({
        userId,
        availableCredits: "0.00",
        withdrawnCredits: "0.00",
      })
      .returning();
    return credits;
  }

  async updateUserCredits(userId: string, available: number, withdrawn: number): Promise<UserCredits> {
    const [credits] = await db
      .update(userCredits)
      .set({
        availableCredits: available.toFixed(2),
        withdrawnCredits: withdrawn.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId))
      .returning();
    return credits;
  }

  async updateUserRewardStatus(userId: string, status: "in_attesa" | "buono_inviato" | "accreditato", adminNotes?: string): Promise<UserCredits> {
    const updateData: any = {
      rewardStatus: status,
      updatedAt: new Date(),
    };
    
    if (status === "buono_inviato" || status === "accreditato") {
      updateData.lastRewardDate = new Date();
      
      if (status === "buono_inviato") {
        updateData.availableCredits = "0.00";
      }
    }
    
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    
    const [credits] = await db
      .update(userCredits)
      .set(updateData)
      .where(eq(userCredits.userId, userId))
      .returning();
    return credits;
  }

  async getAllUserCredits(): Promise<UserCredits[]> {
    return await db.select().from(userCredits).orderBy(desc(userCredits.updatedAt));
  }

  async getPaymentRequests(userId: string): Promise<PaymentRequest[]> {
    return await db.select()
      .from(paymentRequests)
      .where(eq(paymentRequests.userId, userId))
      .orderBy(desc(paymentRequests.createdAt));
  }

  async getPaymentHistory(userId: string): Promise<PaymentHistory[]> {
    return await db.select()
      .from(paymentHistory)
      .where(eq(paymentHistory.userId, userId))
      .orderBy(desc(paymentHistory.createdAt));
  }

  async createBankTransferRequest(userId: string, data: BankTransferRequest): Promise<PaymentRequest> {
    const [request] = await db
      .insert(paymentRequests)
      .values({
        userId,
        paymentType: "bank_transfer",
        amount: data.amount.toFixed(2),
        iban: data.iban,
        beneficiaryName: data.beneficiaryName,
        identityDocument: data.identityDocument,
        fiscalCodeDocument: data.fiscalCodeDocument,
        occasionalWorkForm: data.occasionalWorkForm,
        status: "pending",
      })
      .returning();
    return request;
  }

  async createVoucherRequest(userId: string, data: VoucherRequest): Promise<PaymentRequest> {
    const [request] = await db
      .insert(paymentRequests)
      .values({
        userId,
        paymentType: "digital_voucher",
        amount: data.amount.toFixed(2),
        voucherType: data.voucherType,
        voucherDetails: data.voucherDetails,
        status: "pending",
      })
      .returning();
    return request;
  }

  async updatePaymentRequestStatus(id: number, status: string, adminNotes?: string): Promise<PaymentRequest> {
    const updateData: any = { status, updatedAt: new Date() };
    
    if (status === "completed") {
      updateData.processedAt = new Date();
    }
    
    if (adminNotes) {
      updateData.adminNotes = adminNotes;
    }
    
    const [request] = await db
      .update(paymentRequests)
      .set(updateData)
      .where(eq(paymentRequests.id, id))
      .returning();
    return request;
  }

  async createPaymentHistory(data: any): Promise<PaymentHistory> {
    const [history] = await db
      .insert(paymentHistory)
      .values(data)
      .returning();
    return history;
  }

  // Authentication methods for traditional login/register
  async validateUserCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.getUserByEmail(email);
    if (!user) return null;
    
    // In production, you should hash passwords and compare hashes
    // For now, simple comparison (NOT SECURE)
    if (user.password === password) {
      return user;
    }
    
    return null;
  }
}

export const storage = new DatabaseStorage();
