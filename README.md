# SegnaLuce - Backend

Backend del progetto SegnaLuce costruito con Node.js, Express e PostgreSQL.

## 🚀 Deploy su Render

### Setup Rapido

1. **Crea un nuovo Web Service su Render**
   - Vai su [render.com](https://render.com)
   - Crea un nuovo "Web Service"
   - Connetti il tuo repository GitHub

2. **Configurazione del servizio**
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment**: Node

3. **Configura le variabili d'ambiente**
   Aggiungi queste variabili nelle impostazioni di Render:
   
   ```
   DATABASE_URL=postgresql://...
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-app-password
   SESSION_SECRET=your-secret-key
   NODE_ENV=production
   PORT=5000
   ```

4. **Database**
   - Crea un PostgreSQL database su Render
   - Copia il DATABASE_URL nelle variabili d'ambiente
   - Esegui `npm run db:push` per applicare lo schema

### Comandi Locali

```bash
# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev

# Build per produzione
npm run build

# Avvia in produzione
npm start

# Push schema database
npm run db:push
```

## 📧 Configurazione Gmail SMTP

1. Vai su [myaccount.google.com](https://myaccount.google.com)
2. Security → 2-Step Verification (attivala se non è attiva)
3. Security → App passwords
4. Genera una password per "Mail" → "Other"
5. Usa questa password come `GMAIL_APP_PASSWORD`

## 📁 Struttura

```
server/
├── index.ts       # Entry point
├── routes.ts      # API routes
├── auth.ts        # Sistema di autenticazione
├── email.ts       # Servizio email (Gmail SMTP)
├── db.ts          # Configurazione database
└── storage.ts     # Data access layer

shared/
└── schema.ts      # Schema database Drizzle ORM
```

## 🔧 Tecnologie

- **Node.js** - Runtime
- **Express** - Web framework
- **PostgreSQL** - Database
- **Drizzle ORM** - Database ORM
- **Passport.js** - Autenticazione
- **Nodemailer** - Invio email (Gmail SMTP)
