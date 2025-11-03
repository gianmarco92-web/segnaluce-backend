import nodemailer from 'nodemailer';

// Gmail configuration with provided credentials
const EMAIL_CONFIG = {
  user: 'segnaluce.pratiche@gmail.com',
  pass: 'kmtg ljbr nzmk lugb', // App password for wwe.segnaluce.it
  from: 'SegnaLuce <segnaluce.pratiche@gmail.com>'
};

// Initialize Gmail SMTP transporter
const gmailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_CONFIG.user,
    pass: EMAIL_CONFIG.pass
  }
});

console.log('📧 Gmail SMTP initialized with segnaluce.pratiche@gmail.com');

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    content: string; // base64 encoded file content
    filename: string;
    type: string;
  }>;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // Convert attachments to nodemailer format
    const attachments = params.attachments?.map(att => ({
      filename: att.filename,
      content: att.content,
      encoding: 'base64' as const,
      contentType: att.type
    })) || [];

    const mailOptions = {
      from: EMAIL_CONFIG.from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: attachments
    };

    const result = await gmailTransporter.sendMail(mailOptions);
    console.log(`📧 Email sent successfully to ${params.to} via Gmail`);
    return true;
  } catch (error) {
    console.error('📧 Gmail email error:', error);
    return false;
  }
}

export async function sendWelcomeEmail(userEmail: string, userName?: string): Promise<boolean> {
  const displayName = userName || userEmail.split('@')[0];
  
  try {
    // Use Gmail SMTP with improved deliverability settings
    const result = await gmailTransporter.sendMail({
      from: EMAIL_CONFIG.from,
      to: userEmail,
      subject: 'Benvenuto in SegnaLuce - Registrazione completata',
      replyTo: 'info@segnaluce.it',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1f4788; font-size: 28px; margin: 0;">🔸 SegnaLuce</h1>
              <p style="color: #666; font-size: 16px; margin: 5px 0 0 0;">La tua nuova fonte di guadagno</p>
            </div>
            
            <h2 style="color: #1f4788; margin-bottom: 20px;">Ciao ${displayName}! 👋</h2>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              <strong>Benvenuto in SegnaLuce!</strong> La tua registrazione è stata completata con successo.
            </p>
            
            <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1f4788;">
              <h3 style="color: #1f4788; margin: 0 0 10px 0;">🎯 Cosa puoi fare ora:</h3>
              <ul style="color: #333; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;"><strong>Accedi alla dashboard</strong> e completa il tuo profilo</li>
                <li style="margin-bottom: 8px;"><strong>Inizia a caricare bollette</strong> di amici e parenti</li>
                <li style="margin-bottom: 8px;"><strong>Guadagna €30 per contratto luce + €30 per contratto gas</strong></li>
                <li style="margin-bottom: 8px;"><strong>Ricevi pagamenti</strong> tramite bonifico (≥€200) o buoni digitali (≥€60)</li>
              </ul>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h4 style="color: #856404; margin: 0 0 10px 0;">💡 Suggerimento:</h4>
              <p style="color: #856404; margin: 0; font-size: 14px;">
                Inizia con le bollette di casa tua o dei tuoi familiari. È il modo più semplice per testare il sistema e ottenere i primi guadagni!
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.segnaluce.it/login" 
                 style="background-color: #1f4788; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Accedi alla Dashboard
              </a>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
              <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
                Hai domande? Contattaci su <a href="mailto:info@segnaluce.it" style="color: #1f4788;">info@segnaluce.it</a>
              </p>
              <p style="color: #999; font-size: 12px; text-align: center; margin: 10px 0 0 0;">
                Horizon Società Cooperativa a R.L. - Via Po 24, 87086 Rende (CS) - P.IVA 03980600781
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Benvenuto in SegnaLuce!

Ciao ${displayName},

La tua registrazione è stata completata con successo.

Cosa puoi fare ora:
- Accedi alla dashboard e completa il tuo profilo
- Inizia a caricare bollette di amici e parenti
- Guadagna €30 per contratto luce + €30 per contratto gas
- Ricevi pagamenti tramite bonifico (≥€200) o buoni digitali (≥€60)

Accedi ora: https://www.segnaluce.it/login

Hai domande? Contattaci su info@segnaluce.it

Horizon Società Cooperativa a R.L. - Via Po 24, 87086 Rende (CS) - P.IVA 03980600781
      `
    });

    console.log(`✅ Welcome email sent successfully to ${userEmail} via Gmail SMTP`);
    console.log(`📩 Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Gmail SMTP welcome email error:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(userEmail: string, resetToken: string, userName?: string): Promise<boolean> {
  const displayName = userName || userEmail.split('@')[0];
  const resetUrl = `https://www.segnaluce.it/reset-password?token=${resetToken}`;
  
  try {
    // Use Gmail SMTP for password reset emails
    const result = await gmailTransporter.sendMail({
      from: EMAIL_CONFIG.from,
      to: userEmail,
      subject: 'Recupero Password - SegnaLuce',
      replyTo: 'info@segnaluce.it',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1f4788; font-size: 28px; margin: 0;">🔸 SegnaLuce</h1>
              <p style="color: #666; font-size: 16px; margin: 5px 0 0 0;">Recupero Password</p>
            </div>
            
            <h2 style="color: #1f4788; margin-bottom: 20px;">Ciao ${displayName}! 🔑</h2>
            
            <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
              Hai richiesto il recupero della password per il tuo account SegnaLuce.
            </p>
            
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin: 0 0 10px 0;">⚠️ Importante:</h3>
              <ul style="color: #856404; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 8px;">Questo link è valido per <strong>24 ore</strong></li>
                <li style="margin-bottom: 8px;">Se non hai richiesto il recupero, ignora questa email</li>
                <li style="margin-bottom: 8px;">La tua password attuale rimane valida fino al reset</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #1f4788; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Reimposta Password
              </a>
            </div>
            
            <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1f4788;">
              <h4 style="color: #1f4788; margin: 0 0 10px 0;">🔒 Sicurezza:</h4>
              <p style="color: #333; margin: 0; font-size: 14px;">
                Se il link non funziona, copia e incolla questo URL nel browser:<br>
                <code style="background-color: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 12px; word-break: break-all;">
                  ${resetUrl}
                </code>
              </p>
            </div>
            
            <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
              <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
                Hai domande? Contattaci su <a href="mailto:info@segnaluce.it" style="color: #1f4788;">info@segnaluce.it</a>
              </p>
              <p style="color: #999; font-size: 12px; text-align: center; margin: 10px 0 0 0;">
                Horizon Società Cooperativa a R.L. - Via Po 24, 87086 Rende (CS) - P.IVA 03980600781
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Recupero Password - SegnaLuce

Ciao ${displayName},

Hai richiesto il recupero della password per il tuo account SegnaLuce.

Clicca sul link per reimpostare la password:
${resetUrl}

IMPORTANTE:
- Questo link è valido per 24 ore
- Se non hai richiesto il recupero, ignora questa email
- La tua password attuale rimane valida fino al reset

Hai domande? Contattaci su info@segnaluce.it

Horizon Società Cooperativa a R.L. - Via Po 24, 87086 Rende (CS) - P.IVA 03980600781
      `
    });

    console.log(`✅ Password reset email sent successfully to ${userEmail} via Gmail SMTP`);
    console.log(`📩 Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Gmail SMTP password reset email error:', error);
    return false;
  }
}


export async function sendNewSubmissionEmail(
  submissionData: any,
  files: { [key: string]: { name: string; content: string; type: string } }
): Promise<boolean> {
  const attachments = Object.values(files).map(file => ({
    content: file.content,
    filename: file.name,
    type: file.type,
  }));

  const html = `
    <h2>Nuova Pratica SegnaLuce</h2>
    <h3>Dati Intestatario:</h3>
    <ul>
      <li><strong>Nome:</strong> ${submissionData.holderName}</li>
      <li><strong>Codice Fiscale:</strong> ${submissionData.holderFiscalCode}</li>
      <li><strong>Email:</strong> ${submissionData.holderEmail}</li>
      <li><strong>Telefono:</strong> ${submissionData.holderPhone}</li>
      <li><strong>Tipo Operazione:</strong> ${submissionData.operationType}</li>
    </ul>
    
    <h3>Documenti Allegati:</h3>
    <ul>
      ${Object.keys(files).map(key => `<li>${files[key].name}</li>`).join('')}
    </ul>
    
    <p>Pratica inviata automaticamente dal sito SegnaLuce.</p>
  `;

  return await sendEmail({
    to: 'segnaluce.pratiche@gmail.com',
    subject: `Nuova Pratica SegnaLuce - ${submissionData.holderName}`,
    html,
    attachments
  });
}

export async function sendConsultationRequestEmail(
  consultationData: { firstName: string; lastName: string; email: string; phone: string; condominiumsCount: string }
): Promise<boolean> {
  const fullName = `${consultationData.firstName} ${consultationData.lastName}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #ea580c; font-size: 28px; margin: 0;">🏢 Nuova Richiesta Consulenza Amministratore</h1>
          <p style="color: #666; font-size: 16px; margin: 5px 0 0 0;">SegnaLuce - Amministratori Condominio</p>
        </div>
        
        <div style="background-color: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ea580c;">
          <h3 style="color: #ea580c; margin: 0 0 15px 0;">📋 Dati Amministratore:</h3>
          <ul style="color: #333; margin: 0; padding-left: 20px; list-style: none;">
            <li style="margin-bottom: 10px;"><strong>👤 Nome:</strong> ${fullName}</li>
            <li style="margin-bottom: 10px;"><strong>📧 Email:</strong> ${consultationData.email}</li>
            <li style="margin-bottom: 10px;"><strong>📱 Telefono:</strong> ${consultationData.phone}</li>
            <li style="margin-bottom: 10px;"><strong>🏘️ Numero condomini gestiti:</strong> ${consultationData.condominiumsCount}</li>
          </ul>
        </div>
        
        <div style="background-color: #f0f7ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1f4788;">
          <h4 style="color: #1f4788; margin: 0 0 10px 0;">💡 Azione richiesta:</h4>
          <p style="color: #333; margin: 0; font-size: 14px;">
            Contattare l'amministratore al più presto per fornire la consulenza gratuita e 
            presentare le opportunità di risparmio e guadagno per i suoi condomini.
          </p>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px;">
          <p style="color: #666; font-size: 14px; text-align: center; margin: 0;">
            Richiesta inviata automaticamente dal sito SegnaLuce
          </p>
          <p style="color: #999; font-size: 12px; text-align: center; margin: 10px 0 0 0;">
            Horizon Società Cooperativa a R.L. - Via Po 24, 87086 Rende (CS) - P.IVA 03980600781
          </p>
        </div>
      </div>
    </div>
  `;

  const text = `
Nuova Richiesta Consulenza Amministratore - SegnaLuce

DATI AMMINISTRATORE:
- Nome: ${fullName}
- Email: ${consultationData.email}
- Telefono: ${consultationData.phone}
- Numero condomini gestiti: ${consultationData.condominiumsCount}

AZIONE RICHIESTA:
Contattare l'amministratore al più presto per fornire la consulenza gratuita.

---
Richiesta inviata automaticamente dal sito SegnaLuce
Horizon Società Cooperativa a R.L. - Via Po 24, 87086 Rende (CS) - P.IVA 03980600781
  `;

  try {
    const result = await gmailTransporter.sendMail({
      from: EMAIL_CONFIG.from,
      to: 'segnaluce.pratiche@gmail.com',
      subject: `🏢 Nuova Richiesta Consulenza Amministratore - ${fullName}`,
      replyTo: consultationData.email,
      html,
      text
    });

    console.log(`✅ Consultation request email sent successfully via Gmail SMTP`);
    console.log(`📩 Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Gmail SMTP consultation request email error:', error);
    return false;
  }
}