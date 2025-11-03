import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupSecureAuth, isAuthenticated, requireEmailVerified } from "./auth-secure";
import { sendEmail, sendNewSubmissionEmail } from "./email";
import express from "express";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {

  // Setup authentication
  await setupSecureAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const user = (req.session as any).user;
      if (!user) {
        return res.status(401).json({ message: "Non autenticato" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Errore nel recupero utente" });
    }
  });



  // Submissions routes
  app.get('/api/submissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const userSubmissions = await storage.getUserSubmissions(userId);
      res.json(userSubmissions);
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ message: "Errore nel recupero pratiche" });
    }
  });

  app.post('/api/submissions', requireEmailVerified, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const { files, ...submissionData } = req.body;
      
      // Primary goal: Send email with documents immediately
      let emailSent = false;
      if (files && Object.keys(files).length > 0) {
        try {
          const { sendNewSubmissionEmail } = await import('./email');
          emailSent = await sendNewSubmissionEmail(submissionData, files);
          console.log("✅ Email sent to segnaluce.pratiche@gmail.com");
        } catch (emailError) {
          console.error("❌ Failed to send email:", emailError);
        }
      }
      
      // Secondary: Save to database for dashboard (but don't fail if this fails)
      let submission = null;
      try {
        submission = await storage.createSubmission({ ...submissionData, userId });
      } catch (dbError) {
        console.error("Database save failed (non-critical):", dbError);
      }
      
      // Return success if email was sent
      if (emailSent) {
        res.json({ 
          success: true, 
          message: "Pratica inviata con successo",
          submission: submission || { id: Date.now() }
        });
      } else {
        res.status(500).json({ message: "Errore nell'invio della pratica" });
      }
    } catch (error) {
      console.error("Error processing submission:", error);
      res.status(500).json({ message: "Errore nella creazione pratica" });
    }
  });

  // Admin routes (for now, all authenticated users can access)
  app.get('/api/admin/submissions', isAuthenticated, async (req: any, res) => {
    try {
      // For now, return all submissions. In production, add role-based access control
      const allSubmissions = await storage.getAllSubmissions();
      res.json(allSubmissions);
    } catch (error) {
      console.error("Error fetching admin submissions:", error);
      res.status(500).json({ message: "Errore nel recupero pratiche" });
    }
  });

  // Admin route to get all user credits
  app.get('/api/admin/credits', isAuthenticated, async (req: any, res) => {
    try {
      const allCredits = await storage.getAllUserCredits();
      res.json(allCredits);
    } catch (error) {
      console.error("Error fetching all credits:", error);
      res.status(500).json({ message: "Errore nel recupero crediti" });
    }
  });

  // Admin route to update user reward status
  app.put('/api/admin/users/:userId/credits', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { rewardStatus, adminNotes } = req.body;
      
      if (!rewardStatus || !["in_attesa", "buono_inviato", "accreditato"].includes(rewardStatus)) {
        return res.status(400).json({ message: "Stato non valido" });
      }
      
      const updatedCredits = await storage.updateUserRewardStatus(userId, rewardStatus, adminNotes);
      res.json(updatedCredits);
    } catch (error) {
      console.error("Error updating reward status:", error);
      res.status(500).json({ message: "Errore nell'aggiornamento stato" });
    }
  });

  // Contact form endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;
      
      const success = await sendEmail({
        to: "info@segnaluce.it",
        subject: `Nuovo messaggio da ${name}: ${subject}`,
        html: `
          <h3>Nuovo messaggio di contatto</h3>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Telefono:</strong> ${phone || 'Non fornito'}</p>
          <p><strong>Oggetto:</strong> ${subject}</p>
          <p><strong>Messaggio:</strong></p>
          <p>${message}</p>
        `,
      });

      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Errore nell'invio del messaggio" });
      }
    } catch (error) {
      console.error("Error sending contact message:", error);
      res.status(500).json({ error: "Errore interno del server" });
    }
  });

  // Job application endpoint
  app.post("/api/job-application", async (req, res) => {
    try {
      const { name, email, phone, position, experience, motivation, cv } = req.body;
      
      const attachments = [];
      if (cv) {
        // Extract base64 content and file info
        const base64Match = cv.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          attachments.push({
            content: base64Match[2],
            filename: `CV_${name.replace(/\s+/g, '_')}.pdf`,
            type: base64Match[1],
          });
        }
      }

      const success = await sendEmail({
        to: "hr@segnaluce.it",
        subject: `Nuova candidatura: ${name} - ${position}`,
        html: `
          <h3>Nuova candidatura ricevuta</h3>
          <p><strong>Nome:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Telefono:</strong> ${phone}</p>
          <p><strong>Posizione:</strong> ${position}</p>
          <p><strong>Esperienza:</strong></p>
          <p>${experience}</p>
          <p><strong>Motivazione:</strong></p>
          <p>${motivation}</p>
          ${cv ? '<p>CV allegato alla email.</p>' : '<p>Nessun CV allegato.</p>'}
        `,
        attachments,
      });

      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ error: "Errore nell'invio della candidatura" });
      }
    } catch (error) {
      console.error("Error sending job application:", error);
      res.status(500).json({ error: "Errore interno del server" });
    }
  });

  // Payment system routes
  app.get('/api/payments/credits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const credits = await storage.getUserCredits(userId);
      res.json(credits);
    } catch (error) {
      console.error("Error fetching user credits:", error);
      res.status(500).json({ message: "Errore nel recupero crediti" });
    }
  });

  app.get('/api/payments/requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const requests = await storage.getPaymentRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching payment requests:", error);
      res.status(500).json({ message: "Errore nel recupero richieste pagamento" });
    }
  });

  app.get('/api/payments/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const history = await storage.getPaymentHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ message: "Errore nel recupero storico pagamenti" });
    }
  });

  app.post('/api/payments/request-bank-transfer', requireEmailVerified, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const { bankTransferRequestSchema } = await import('@shared/schema');
      
      const validatedData = bankTransferRequestSchema.parse(req.body);
      
      // Check if user has enough credits
      const credits = await storage.getUserCredits(userId);
      if (parseFloat(credits.availableCredits) < validatedData.amount) {
        return res.status(400).json({ message: "Crediti insufficienti" });
      }
      
      // Create bank transfer request
      const request = await storage.createBankTransferRequest(userId, validatedData);
      
      // Send notification email to admin
      try {
        await sendEmail({
          to: 'segnaluce.pratiche@gmail.com',
          subject: 'Nuova Richiesta Bonifico - SegnaLuce',
          html: `
            <h2>Nuova Richiesta di Bonifico</h2>
            <p><strong>Utente:</strong> ${userId}</p>
            <p><strong>Importo:</strong> €${validatedData.amount}</p>
            <p><strong>IBAN:</strong> ${validatedData.iban}</p>
            <p><strong>Beneficiario:</strong> ${validatedData.beneficiaryName}</p>
            <p><strong>Importo netto (dopo ritenuta 20%):</strong> €${(validatedData.amount * 0.8).toFixed(2)}</p>
            <p><strong>Ritenuta d'acconto:</strong> €${(validatedData.amount * 0.2).toFixed(2)}</p>
            <p>Documenti allegati: identità, codice fiscale, modulo prestazione occasionale</p>
            <p>Elabora la richiesta nella dashboard amministrativa.</p>
          `
        });
      } catch (emailError) {
        console.error("Failed to send admin notification:", emailError);
      }
      
      res.json({ message: "Richiesta di bonifico inviata con successo", request });
    } catch (error) {
      console.error("Error creating bank transfer request:", error);
      res.status(500).json({ message: "Errore nella creazione richiesta bonifico" });
    }
  });

  app.post('/api/payments/request-voucher', requireEmailVerified, async (req: any, res) => {
    try {
      const userId = (req.session as any).user.id;
      const { voucherRequestSchema } = await import('@shared/schema');
      
      const validatedData = voucherRequestSchema.parse(req.body);
      
      // Check if user has enough credits
      const credits = await storage.getUserCredits(userId);
      if (parseFloat(credits.availableCredits) < validatedData.amount) {
        return res.status(400).json({ message: "Crediti insufficienti" });
      }
      
      // Create voucher request
      const request = await storage.createVoucherRequest(userId, validatedData);
      
      // Send notification email to admin
      try {
        await sendEmail({
          to: 'segnaluce.pratiche@gmail.com',
          subject: 'Nuova Richiesta Buono Digitale - SegnaLuce',
          html: `
            <h2>Nuova Richiesta Buono Digitale</h2>
            <p><strong>Utente:</strong> ${userId}</p>
            <p><strong>Importo:</strong> €${validatedData.amount}</p>
            <p><strong>Tipo buono:</strong> ${validatedData.voucherType}</p>
            <p><strong>Email destinatario:</strong> ${validatedData.voucherDetails}</p>
            <p>Genera il buono tramite TidyReward e invia via email entro 24 ore.</p>
          `
        });
      } catch (emailError) {
        console.error("Failed to send admin notification:", emailError);
      }
      
      res.json({ message: "Richiesta buono digitale inviata con successo", request });
    } catch (error) {
      console.error("Error creating voucher request:", error);
      res.status(500).json({ message: "Errore nella creazione richiesta buono" });
    }
  });

  // Consultation request endpoint
  app.post('/api/consultation-request', async (req, res) => {
    try {
      const { firstName, lastName, email, phone, condominiumsCount } = req.body;
      
      // Validate input
      if (!firstName || !lastName || !email || !phone || !condominiumsCount) {
        return res.status(400).json({ message: "Tutti i campi sono obbligatori" });
      }
      
      // Send email
      const { sendConsultationRequestEmail } = await import('./email');
      const emailSent = await sendConsultationRequestEmail({
        firstName,
        lastName,
        email,
        phone,
        condominiumsCount
      });
      
      if (emailSent) {
        console.log(`✅ Consultation request sent for ${firstName} ${lastName} (${email})`);
        res.json({ 
          success: true, 
          message: "Richiesta di consulenza inviata con successo" 
        });
      } else {
        res.status(500).json({ message: "Errore nell'invio della richiesta" });
      }
    } catch (error) {
      console.error("Error processing consultation request:", error);
      res.status(500).json({ message: "Errore nell'elaborazione della richiesta" });
    }
  });

  // Check auth status
  app.get('/api/auth/status', (req, res) => {
    res.json({ 
      authenticated: req.isAuthenticated(),
      user: req.user || null 
    });
  });

  // Test email endpoint
  app.post("/api/test-welcome-email", async (req, res) => {
    try {
      const { email, name } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email è richiesta" });
      }

      console.log(`🧪 Testing welcome email for: ${email}`);
      
      const { sendWelcomeEmail } = await import("./email");
      const success = await sendWelcomeEmail(email, name || "Test User");
      
      if (success) {
        res.json({ 
          success: true, 
          message: `Email di benvenuto inviata con successo a ${email}`,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: "Errore nell'invio dell'email di benvenuto" 
        });
      }
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Errore interno del server",
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
