import bcrypt from 'bcryptjs';
import session from 'express-session';
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { sendWelcomeEmail, sendPasswordResetEmail as sendPasswordResetEmailFromEmailService, sendEmail } from "./email";
import { z } from 'zod';
import { 
  loginSchema, 
  registerSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  verifyEmailSchema 
} from '@shared/schema';
import crypto from 'crypto';

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
const TOKEN_EXPIRY_HOURS = 24;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}



export async function setupSecureAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Clean expired tokens periodically
  setInterval(async () => {
    try {
      await storage.deleteExpiredTokens();
    } catch (error) {
      console.error("Error cleaning expired tokens:", error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Register endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if username exists
      const existingUsername = await storage.getUserByUsername(userData.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username già in uso" });
      }

      // Check if email exists
      const existingEmail = await storage.getUserByEmail(userData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email già registrata" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);

      // Generate email verification token
      const emailToken = generateSecureToken();
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + TOKEN_EXPIRY_HOURS);

      // Create user (verified by default for demo purposes)
      const newUser = await storage.createUser({
        id: `user_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        emailVerified: true, // Auto-verify for demo to save emails
        provider: "local",
        isActive: true,
      });

      // Send welcome email automatically
      try {
        const { sendWelcomeEmail } = await import('./email');
        await sendWelcomeEmail(userData.email, userData.firstName || userData.lastName || userData.username);
        console.log(`📧 Welcome email sent to new registered user: ${userData.email}`);
      } catch (emailError) {
        console.error('📧 Failed to send welcome email:', emailError);
        // Don't fail registration if email fails
      }

      // Set session immediately (auto-login after registration)
      (req.session as any).user = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        emailVerified: newUser.emailVerified
      };

      // Send welcome email (non consuma crediti Brevo)
      try {
        await sendWelcomeEmail(userData.email, userData.firstName);
        console.log(`✅ Welcome email sent to ${userData.email}`);
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError);
        // Non bloccare la registrazione se l'email fallisce
      }

      res.json({ 
        message: "Registrazione completata con successo! Controlla la tua email di benvenuto.",
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          emailVerified: newUser.emailVerified
        }
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Email verification endpoint
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { token } = verifyEmailSchema.parse(req.body);
      
      const tokenRecord = await storage.getUserToken(token, "email_verification");
      if (!tokenRecord) {
        return res.status(400).json({ message: "Token non valido o scaduto" });
      }

      // Update user as verified
      await storage.updateUser(tokenRecord.userId, { 
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null 
      });

      // Delete used token
      await storage.deleteUserToken(token);

      res.json({ message: "Email verificata con successo! Ora puoi accedere." });
    } catch (error) {
      console.error("Email verification error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Login endpoint with security features
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Credenziali non valide" });
      }

      // Check if account is locked
      if (user.lockedUntil && new Date() < user.lockedUntil) {
        const remainingTime = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
        return res.status(423).json({ 
          message: `Account bloccato. Riprova tra ${remainingTime} minuti.` 
        });
      }

      // Email verification check disabled for demo
      // In production, uncomment this check:
      // if (!user.emailVerified) {
      //   return res.status(403).json({ 
      //     message: "Email non verificata. Controlla la tua casella di posta." 
      //   });
      // }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ message: "Account disattivato" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        // Increment failed attempts
        await storage.incrementFailedLogins(user.id);
        
        // Lock account if too many failed attempts
        if ((user.failedLoginAttempts || 0) >= MAX_LOGIN_ATTEMPTS - 1) {
          const lockUntil = new Date(Date.now() + LOCKOUT_TIME);
          await storage.lockUser(user.id, lockUntil);
          return res.status(423).json({ 
            message: "Troppi tentativi falliti. Account bloccato per 15 minuti." 
          });
        }

        return res.status(401).json({ message: "Credenziali non valide" });
      }

      // Successful login - reset failed attempts and update last login
      await storage.resetFailedLogins(user.id);
      await storage.updateLastLogin(user.id);

      // Check if this is first login (send dashboard welcome)
      const isFirstLogin = !user.lastLoginAt;

      // Set session
      (req.session as any).user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified
      };

      // First login completed successfully
      if (isFirstLogin) {
        console.log(`🎉 First login completed for user: ${user.email}`);
      }

      res.json({ 
        message: "Login effettuato con successo",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Forgot password endpoint
  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal if email exists - security best practice
        return res.json({ 
          message: "Se l'email esiste, riceverai le istruzioni per il reset." 
        });
      }

      // Generate password reset token
      const resetToken = generateSecureToken();
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + TOKEN_EXPIRY_HOURS);

      // Save reset token
      await storage.createUserToken({
        userId: user.id,
        token: resetToken,
        type: "password_reset",
        expiresAt: tokenExpiry,
      });

      // Send reset email using Gmail SMTP (same as welcome emails)
      try {
        await sendPasswordResetEmailFromEmailService(email, resetToken, user.firstName || "Utente");
        console.log(`✅ Password reset email sent to ${email} via Gmail SMTP`);
      } catch (emailError) {
        console.error("❌ Error sending password reset email:", emailError);
        // Don't fail the request even if email fails
      }

      res.json({ 
        message: "Se l'email esiste, riceverai le istruzioni per il reset." 
      });
    } catch (error) {
      console.error("Forgot password error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Reset password endpoint
  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      
      const tokenRecord = await storage.getUserToken(token, "password_reset");
      if (!tokenRecord) {
        return res.status(400).json({ message: "Token non valido o scaduto" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Update user password and reset failed attempts
      await storage.updateUser(tokenRecord.userId, { 
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null
      });
      
      await storage.resetFailedLogins(tokenRecord.userId);

      // Delete used token
      await storage.deleteUserToken(token);

      res.json({ message: "Password aggiornata con successo!" });
    } catch (error) {
      console.error("Reset password error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      res.status(500).json({ message: "Errore interno del server" });
    }
  });

  // Manual email verification trigger (for production use)
  app.post('/api/auth/request-verification', isAuthenticated, async (req: any, res) => {
    try {
      const user = (req.session as any).user;
      const fullUser = await storage.getUser(user.id);
      
      if (!fullUser) {
        return res.status(404).json({ message: "Utente non trovato" });
      }

      if (fullUser.emailVerified) {
        return res.status(400).json({ message: "Email già verificata" });
      }

      // Generate new verification token
      const emailToken = generateSecureToken();
      const tokenExpiry = new Date();
      tokenExpiry.setHours(tokenExpiry.getHours() + TOKEN_EXPIRY_HOURS);

      // Save verification token
      await storage.createUserToken({
        userId: fullUser.id,
        token: emailToken,
        type: "email_verification",
        expiresAt: tokenExpiry,
      });

      // Send verification email using the email service
      await sendEmail({
        to: fullUser.email!,
        subject: 'SegnaLuce - Conferma la tua registrazione',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">SegnaLuce</h1>
            </div>
            
            <div style="padding: 30px; background: #f8fafc;">
              <h2 style="color: #1e293b;">Ciao ${fullUser.firstName || "Utente"}!</h2>
              
              <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                Benvenuto in SegnaLuce! Per completare la registrazione e iniziare a guadagnare 
                con le tue segnalazioni energetiche, conferma il tuo indirizzo email.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://segnaluce.netlify.app'}/verify-email?token=${emailToken}" 
                   style="background: #f97316; color: white; padding: 15px 30px; 
                          text-decoration: none; border-radius: 8px; font-weight: bold; 
                          display: inline-block;">
                  Conferma Email
                </a>
              </div>
              
              <p style="color: #64748b; font-size: 14px;">
                Questo link scadrà tra 24 ore per motivi di sicurezza.
              </p>
              
              <p style="color: #64748b; font-size: 12px; text-align: center;">
                Ricorda: con SegnaLuce puoi guadagnare fino a €60 per ogni bolletta segnalata!
              </p>
            </div>
          </div>
        `
      });

      res.json({ 
        message: "Email di verifica inviata! Controlla la tua casella di posta." 
      });
    } catch (error) {
      console.error("Request verification error:", error);
      res.status(500).json({ message: "Errore nell'invio dell'email di verifica" });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Errore durante il logout" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logout effettuato con successo" });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session && (req.session as any).user) {
    return next();
  }
  res.status(401).json({ message: "Non autenticato" });
};

export const requireEmailVerified: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: "Non autenticato" });
  }
  if (!user.emailVerified) {
    return res.status(403).json({ 
      message: "Email non verificata. Controlla la tua casella di posta." 
    });
  }
  next();
};