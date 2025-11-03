import { pgTable, text, serial, timestamp, decimal, boolean, varchar, jsonb, index, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for OAuth authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with enhanced security features
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique(),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // For local auth - hashed with bcrypt
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  iban: varchar("iban"), // Per ricevere i pagamenti delle provvigioni
  provider: varchar("provider").default("local"), // OAuth provider or 'local'
  providerId: varchar("provider_id"),
  
  // Email verification
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  
  // Password reset
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  
  // Account security
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email verification and password reset tokens table
export const userTokens = pgTable("user_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  token: varchar("token").notNull().unique(),
  type: text("type", { enum: ["email_verification", "password_reset"] }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_user_tokens_token").on(table.token),
  index("IDX_user_tokens_user_id").on(table.userId),
]);

export const billSubmissions = pgTable("bill_submissions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Tipo di operazione
  operationType: text("operation_type", { enum: ["switch", "voltura"] }).notNull(),
  
  // Dati intestatario
  holderName: text("holder_name").notNull(),
  holderFiscalCode: text("holder_fiscal_code").notNull(),
  holderEmail: text("holder_email").notNull(),
  holderPhone: text("holder_phone").notNull(),
  
  // Documenti
  lastBillFile: text("last_bill_file").notNull(),
  holderDocuments: text("holder_documents").array(),
  
  // Consensi e responsabilità
  privacyAccepted: boolean("privacy_accepted").default(false).notNull(),
  responsibilityAccepted: boolean("responsibility_accepted").default(false).notNull(),
  holderConsent: boolean("holder_consent").default(false).notNull(),
  
  // Stato pratica
  status: text("status", { enum: ["in_valutazione", "approvata", "respinta"] }).default("in_valutazione").notNull(),
  
  // Commissioni (in centesimi)
  lightEarnings: decimal("light_earnings", { precision: 10, scale: 2 }).default("30.00"),
  gasEarnings: decimal("gas_earnings", { precision: 10, scale: 2 }).default("30.00"),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("60.00"),
  earningsAvailableAt: timestamp("earnings_available_at"),
  earningsWithdrawn: boolean("earnings_withdrawn").default(false),
  
  // Metadati
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  switchCompletedAt: timestamp("switch_completed_at"),
});

export const solarSubmissions = pgTable("solar_submissions", {
  id: serial("id").primaryKey(),
  reporterName: text("reporter_name").notNull(),
  contactName: text("contact_name").notNull(),
  city: text("city").notNull(),
  houseType: text("house_type").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  submissionDate: timestamp("submission_date").defaultNow(),
  status: text("status", { enum: ["pending", "contacted", "completed", "rejected"] }).default("pending"),
  userId: varchar("user_id").references(() => users.id),
});

export const ecoBoxSubmissions = pgTable("eco_box_submissions", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  vatNumber: text("vat_number").notNull(),
  sector: text("sector").notNull(),
  city: text("city").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  estimatedPower: text("estimated_power"),
  notes: text("notes"),
  submissionDate: timestamp("submission_date").defaultNow(),
  status: text("status", { enum: ["pending", "contacted", "completed", "rejected"] }).default("pending"),
  userId: varchar("user_id").references(() => users.id),
});

export const lineaSubmissions = pgTable("linea_submissions", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  employeeCount: text("employee_count").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  voipService: boolean("voip_service").default(false),
  fiberService: boolean("fiber_service").default(false),
  simService: boolean("sim_service").default(false),
  analysisService: boolean("analysis_service").default(false),
  specificNeeds: text("specific_needs"),
  submissionDate: timestamp("submission_date").defaultNow(),
  status: text("status", { enum: ["pending", "contacted", "completed", "rejected"] }).default("pending"),
  userId: varchar("user_id").references(() => users.id),
});

// Crediti utente per sistema di pagamento ibrido
export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Crediti totali disponibili
  availableCredits: decimal("available_credits", { precision: 10, scale: 2 }).default("0.00"),
  
  // Crediti già richiesti/pagati
  withdrawnCredits: decimal("withdrawn_credits", { precision: 10, scale: 2 }).default("0.00"),
  
  // Stato del credito per gestione Edenred
  rewardStatus: text("reward_status", { enum: ["in_attesa", "buono_inviato", "accreditato"] }).default("in_attesa"),
  
  // Data ultimo premio inviato
  lastRewardDate: timestamp("last_reward_date"),
  
  // Note amministrative (es. "Buono Edenred inviato il 20/10/2025")
  adminNotes: text("admin_notes"),
  
  // Metadati
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Richieste di pagamento
export const paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Tipo di pagamento
  paymentType: text("payment_type", { enum: ["bank_transfer", "digital_voucher"] }).notNull(),
  
  // Importo richiesto
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  
  // Dati per bonifico
  iban: varchar("iban"),
  beneficiaryName: text("beneficiary_name"),
  
  // Tipo di buono digitale
  voucherType: text("voucher_type", { enum: ["amazon", "carrefour", "decathlon", "zalando", "phone_credit", "other"] }),
  voucherDetails: text("voucher_details"), // Email per invio buono
  
  // Documenti caricati (per bonifici)
  identityDocument: text("identity_document"),
  fiscalCodeDocument: text("fiscal_code_document"),
  occasionalWorkForm: text("occasional_work_form"),
  
  // Stato richiesta
  status: text("status", { enum: ["pending", "approved", "processing", "completed", "rejected"] }).default("pending"),
  
  // Note amministrative
  adminNotes: text("admin_notes"),
  
  // Metadati
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Storico pagamenti effettuati
export const paymentHistory = pgTable("payment_history", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  paymentRequestId: serial("payment_request_id").references(() => paymentRequests.id),
  
  // Dettagli pagamento
  paymentType: text("payment_type", { enum: ["bank_transfer", "digital_voucher"] }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  netAmount: decimal("net_amount", { precision: 10, scale: 2 }), // Dopo ritenuta 20%
  taxWithheld: decimal("tax_withheld", { precision: 10, scale: 2 }), // Ritenuta d'acconto
  
  // Dati per CU annuale
  fiscalYear: varchar("fiscal_year", { length: 4 }).notNull(),
  
  // Riferimenti esterni
  bankTransferReference: text("bank_transfer_reference"),
  voucherCode: text("voucher_code"),
  
  // Metadati
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  provider: true,
  providerId: true,
});

export type UpsertUser = typeof users.$inferInsert;

export const insertBillSubmissionSchema = createInsertSchema(billSubmissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  switchCompletedAt: true,
  earningsAvailableAt: true,
  status: true,
  lightEarnings: true,
  gasEarnings: true,
  totalEarnings: true,
  earningsWithdrawn: true,
  userId: true,
}).extend({
  holderDocuments: z.array(z.string()).optional(),
});

export const insertSolarSubmissionSchema = createInsertSchema(solarSubmissions).omit({
  id: true,
  submissionDate: true,
  status: true,
  userId: true,
});

export const insertEcoBoxSubmissionSchema = createInsertSchema(ecoBoxSubmissions).omit({
  id: true,
  submissionDate: true,
  status: true,
  userId: true,
});

export const insertLineaSubmissionSchema = createInsertSchema(lineaSubmissions).omit({
  id: true,
  submissionDate: true,
  status: true,
  userId: true,
});

// Authentication schemas
export const loginSchema = z.object({
  username: z.string().min(1, "Username richiesto"),
  password: z.string().min(1, "Password richiesta"),
});

export const registerSchema = z.object({
  username: z.string().min(3, "Username deve essere almeno 3 caratteri"),
  email: z.string().email("Email non valida"),
  password: z.string().min(6, "Password deve essere almeno 6 caratteri"),
  firstName: z.string().min(1, "Nome richiesto"),
  lastName: z.string().min(1, "Cognome richiesto"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email non valida"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token richiesto"),
  password: z.string().min(6, "Password deve essere almeno 6 caratteri"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token richiesto"),
});

// Schemi per sistema di pagamento
export const insertPaymentRequestSchema = createInsertSchema(paymentRequests).omit({
  id: true,
  userId: true,
  status: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
  processedAt: true,
});

export const updatePaymentRequestSchema = z.object({
  id: z.number(),
  status: z.enum(["pending", "approved", "processing", "completed", "rejected"]),
  adminNotes: z.string().optional(),
});

export const bankTransferRequestSchema = z.object({
  amount: z.number().min(200, "Importo minimo per bonifico: €200"),
  iban: z.string().min(15, "IBAN non valido").max(34, "IBAN non valido"),
  beneficiaryName: z.string().min(1, "Nome beneficiario richiesto"),
  identityDocument: z.string().min(1, "Documento identità richiesto"),
  fiscalCodeDocument: z.string().min(1, "Codice fiscale richiesto"),
  occasionalWorkForm: z.string().min(1, "Modulo prestazione occasionale richiesto"),
});

export const voucherRequestSchema = z.object({
  amount: z.number().min(60, "Importo minimo per buono: €60"),
  voucherType: z.enum(["amazon", "carrefour", "decathlon", "zalando", "phone_credit", "other"]),
  voucherDetails: z.string().email("Email non valida").min(1, "Email richiesta per invio buono"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserToken = typeof userTokens.$inferSelect;
export type InsertUserToken = typeof userTokens.$inferInsert;
export type BillSubmission = typeof billSubmissions.$inferSelect;
export type InsertBillSubmission = z.infer<typeof insertBillSubmissionSchema>;
export type SolarSubmission = typeof solarSubmissions.$inferSelect;
export type InsertSolarSubmission = z.infer<typeof insertSolarSubmissionSchema>;
export type EcoBoxSubmission = typeof ecoBoxSubmissions.$inferSelect;
export type InsertEcoBoxSubmission = z.infer<typeof insertEcoBoxSubmissionSchema>;
export type LineaSubmission = typeof lineaSubmissions.$inferSelect;
export type InsertLineaSubmission = z.infer<typeof insertLineaSubmissionSchema>;

// Tipi per sistema di pagamento
export type UserCredits = typeof userCredits.$inferSelect;
export type InsertUserCredits = typeof userCredits.$inferInsert;
export type PaymentRequest = typeof paymentRequests.$inferSelect;
export type InsertPaymentRequest = z.infer<typeof insertPaymentRequestSchema>;
export type UpdatePaymentRequest = z.infer<typeof updatePaymentRequestSchema>;
export type BankTransferRequest = z.infer<typeof bankTransferRequestSchema>;
export type VoucherRequest = z.infer<typeof voucherRequestSchema>;
export type PaymentHistory = typeof paymentHistory.$inferSelect;
export type InsertPaymentHistory = typeof paymentHistory.$inferInsert;
