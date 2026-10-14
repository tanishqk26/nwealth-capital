# Nwealth Capital: Phase 1 Development Plan

**Client:** Nwealth Capital (Pune, mutual fund distribution)
**Vendor:** Phaze AI
**Phase 1 duration:** 6-8 weeks of implementation (once access is ready)
**Source:** Proposal dated 02 Oct 2026

---

## 1. Goal

Build a WhatsApp AI agent plus a CAS (Consolidated Account Statement) workflow so Nwealth can engage ~1,000 existing clients and new prospects with less manual work.

Investwell remains the investment backend. We build a companion workspace around it for outreach, documents and sales activity.

**Principle:** Nwealth's team owns client relationships and all final financial communication. The bot never gives personal investment advice and never executes transactions.

---

## 2. Scope

### In scope (Phase 1)

| # | Module | Deliverable |
|---|---|---|
| A | WhatsApp AI chatbot | One Hindi/English bot, up to 30 approved FAQs/docs, enquiry capture, callback requests, CAS link sharing, follow-up task creation, human handoff |
| B | Messaging and reminders | Up to 6 approved outbound templates, SIP reminders, failed-debit alerts (verified feed only), product-launch updates, one branded service-report layout, reply handling, delivery tracking |
| C | CAS workflow | Request, retrieve, process, record. Up to 4 statement layouts. 20-client pilot |
| D | Shared workspace | Leads, conversations, tasks, consent, CAS records, staff roles, export |
| E | Training and handover | Staff training, documentation, account access, data export, handover session |

### Out of scope (Phase 1)

- Voice-note CRM, internal knowledge assistant, market-triggered outreach, annual SIP review (Phase 2)
- AI calling, holdings-based news digest (Phase 3)
- Personal investment recommendations, transaction execution by the bot
- Real-time SIP status from a CAS file (needs a separate failed-debit feed)
- Nationwide cold messaging or calling

---

## 3. Success Criteria (definition of done)

- [ ] Chatbot answers approved questions correctly and hands off uncertain or personalised ones
- [ ] WhatsApp messaging, reminders, follow-up tasks and opt-outs work correctly
- [ ] CAS retrieval and extraction pass agreed sample checks, and mismatches go to a review queue
- [ ] 50-client WhatsApp pilot completed
- [ ] 20-client CAS pilot completed
- [ ] Team trained, with account access, documentation and data export delivered

---

## 4. Suggested Architecture

```
WhatsApp (Cloud API / BSP)
        |  webhook
        v
  Message Gateway  ---->  Conversation Store (DB)
        |
        v
  AI Agent Orchestrator
   |- Intent + language detection (Hindi / English / Hinglish)
   |- RAG over approved FAQs/docs (vector store)
   |- Guardrails (no advice, no transactions, no PAN in chat)
   |- Tools / actions:
   |    create_lead, request_callback, send_cas_link,
   |    create_task, handoff_to_human, record_opt_out
   v
  Workspace (staff UI)  <---->  Investwell (handoff / export)
        ^
        |
  Scheduler / Queue  ---->  Outbound templates, reminders, follow-ups

  CAS Pipeline:
  Secure consent page -> CAS provider request -> Client-authorised Gmail
  -> Attachment fetch -> Local PDF decrypt + parse -> Match + dedupe
  -> Review queue -> Workspace record
```

### Suggested stack (adjust to team preference)

| Layer | Option |
|---|---|
| WhatsApp | WhatsApp Business Cloud API directly, or a BSP |
| Backend | Node.js (TypeScript) or Python (FastAPI) |
| Workflow glue | n8n for schedulers/reminders (optional) |
| Database | PostgreSQL (e.g. Supabase) |
| Vector store | pgvector |
| LLM | One provider with a configurable model, with a hard usage cap |
| Staff workspace | React + Vite |
| Queue/scheduler | BullMQ / pg-boss / n8n cron |
| CAS parsing | pdfplumber / PyMuPDF with per-layout parsers, run locally |
| Hosting | Single VPS or cloud environment with backups (budget: ₹2,000-5,000/mo) |
| Secrets | Env vault, with document passwords encrypted at rest |

---

## 5. Data Model (core tables)

| Table | Key fields |
|---|---|
| `contacts` | id, phone, name, type (client/prospect), language, source, created_at |
| `consents` | contact_id, channel, type (messaging/CAS), status, timestamp, evidence |
| `opt_outs` | contact_id, timestamp, keyword used |
| `conversations` | id, contact_id, status (bot/handoff/closed), last_message_at, summary |
| `messages` | id, conversation_id, direction, type (free/template), body, wa_message_id, status (sent/delivered/read/failed) |
| `leads` | id, contact_id, intent, amount_range, callback_time, owner_id, status |
| `tasks` | id, lead_id/contact_id, type, due_at, assignee_id, status |
| `templates` | name, language, category, status (draft/submitted/approved), variables |
| `reminder_rules` | type, trigger, template, frequency_cap |
| `kb_documents` / `kb_chunks` | title, source, approved_by, version, embedding |
| `cas_requests` | id, contact_id, provider, status, requested_at, consent_id |
| `cas_documents` | id, request_id, file_ref, statement_date, source (CAMS/KFintech/NSDL/CDSL), parse_status |
| `cas_holdings` | document_id, scheme, folio, units, value |
| `cas_review_queue` | document_id, reason (mismatch/duplicate/unreadable), assignee, status |
| `users` / `roles` | staff accounts, role-based access |
| `audit_log` | actor, action, entity, timestamp |

---

## 6. Module Task Breakdown

### Module A: WhatsApp AI chatbot

**A1. WhatsApp integration**
- [ ] Set up WhatsApp Business account, display name, phone number
- [ ] Webhook for inbound messages and status updates
- [ ] Send text, interactive buttons and list messages
- [ ] Idempotent message handling (dedupe by `wa_message_id`)

**A2. Conversation engine**
- [ ] Language detection (Hindi / English / Hinglish) and matching replies
- [ ] Intent classification: greeting, FAQ, enquiry, callback, CAS help, event info, handoff, transaction request, out-of-scope, STOP/START
- [ ] Context window retention per conversation
- [ ] 24-hour window tracking (free-form only inside the window, templates outside)

**A3. Knowledge base (RAG)**
- [ ] Ingest up to 30 approved FAQs/documents
- [ ] Chunk, embed, store with a version and approver
- [ ] Answer only from retrieved content; below the confidence threshold, hand off
- [ ] Staff-editable knowledge (add, update, disable)

**A4. Guardrails**
- [ ] Block personal fund recommendations and market predictions
- [ ] Block transaction execution (redeem, switch, purchase) and route as a priority handoff
- [ ] Never collect PAN or passwords in chat; send the secure link
- [ ] Standard disclaimers where required
- [ ] Prompt-injection and abuse handling

**A5. Agent actions (tools)**
- [ ] `create_lead`: capture name, intent, amount range, callback time
- [ ] `request_callback`: slot choice (morning/afternoon/evening)
- [ ] `send_cas_link`: generate a tokenised secure link
- [ ] `create_task`: assign to a salesperson
- [ ] `handoff_to_human`: conversation summary and requested action
- [ ] `register_event`: capture name and society, schedule a reminder
- [ ] `record_opt_out` / `record_opt_in`

**A6. Human handoff**
- [ ] Handoff triggers: low confidence, advice request, transaction, complaint, user asks for a human
- [ ] Auto-generated summary for the salesperson
- [ ] Notify staff (WhatsApp/email/dashboard)
- [ ] Bot pauses while a human owns the conversation, with an option to resume
- [ ] Out-of-hours message and next-morning queue

### Module B: Messaging and reminders

**B1. Templates (up to 6)**
- [ ] Draft and submit: SIP reminder, failed-debit alert, product-launch update, service report, event reminder, follow-up nudge
- [ ] Track approval status; handle rejections and edits
- [ ] Variable validation before send

**B2. Outbound engine**
- [ ] Queue with rate limiting and retries
- [ ] Frequency caps per contact (agreed with the client)
- [ ] Block sends to opted-out or no-consent contacts
- [ ] Delivery/read/failed tracking from status webhooks

**B3. Reminders and journeys**
- [ ] SIP reminder from verified source data
- [ ] Failed-debit alert **only** if a reliable feed exists (confirm the source at kickoff)
- [ ] Follow-up journey (e.g. Day 0, Day 2, Day 5), stopping on reply or opt-out
- [ ] Event reminders

**B4. Service report**
- [ ] One branded report layout (logo, ARN, disclosures)
- [ ] Secure link delivery with expiry

**B5. Reply handling**
- [ ] Button replies (e.g. "Request callback") create a lead and task
- [ ] Free-text replies go to the chatbot
- [ ] Pilot with 50 opted-in clients, then expand

### Module C: CAS workflow

**C1. Request and consent**
- [ ] Secure Nwealth-branded page (tokenised link, expiry)
- [ ] Capture PAN and registered email, with consent text and timestamp
- [ ] Encrypt sensitive fields at rest
- [ ] Submit the request through the chosen CAS provider connection
- [ ] Investor completes any provider verification

**C2. Retrieval**
- [ ] Client-authorised Gmail connection (OAuth, minimum scopes)
- [ ] Filter matching CAS emails and fetch attachments
- [ ] **Blocker:** Gmail verification / security assessment must clear before production use
- [ ] Manual upload fallback for exceptions

**C3. Parsing and matching**
- [ ] Per-document password handling (stored encrypted, deleted per retention policy)
- [ ] Local PDF decryption and extraction, with no third-party OCR/LLM sending of raw documents unless disclosed and approved
- [ ] Parsers for up to 4 agreed layouts (validate CAMS, KFintech, NSDL, CDSL coverage at kickoff)
- [ ] Match client, statement date and holdings
- [ ] Duplicate detection; unreadable or mismatched files go to the review queue

**C3b. Review queue**
- [ ] Staff UI to view the original, parsed values and reason, then approve, correct or reject

**C4. Record and handoff**
- [ ] Store the reviewed record and document in the workspace with status and owner
- [ ] Export / authorised handoff to Investwell (confirm the method and access at kickoff)
- [ ] Status messages back to the client on WhatsApp (received, needs help)
- [ ] 20-client pilot

### Module D: Staff workspace

- [ ] Login and roles (admin, sales, viewer)
- [ ] Inbox: conversations with bot/human status and takeover
- [ ] Leads and tasks list with owner, due date and status
- [ ] Contact profile: consent, opt-out, history, CAS records
- [ ] Knowledge base manager
- [ ] Template and reminder rule manager
- [ ] CAS requests and review queue
- [ ] Basic dashboard: leads, handoffs, delivery rate, CAS status
- [ ] Data export (CSV) and audit log

### Module E: Security, compliance, operations

- [ ] Nwealth-owned accounts (WhatsApp, Google, hosting)
- [ ] Encryption in transit and at rest, access control, secrets management
- [ ] Data retention rules (agree with the client); deletion on request
- [ ] Disclose which providers process messages (LLM, WhatsApp, CAS)
- [ ] DPDP Rules 2025 and WhatsApp messaging policy review (not a legal opinion; Nwealth gets independent legal advice)
- [ ] AMFI code of conduct review of client-facing financial messages
- [ ] Monitoring, error alerts, daily backups, LLM cost cap
- [ ] Runbook and documentation

---

## 7. Week-by-Week Plan

| Week | Focus | Tasks |
|---|---|---|
| **W1** | Access, knowledge, setup | Kickoff session; collect inputs (below); start WhatsApp Business verification, Gmail verification and CAS provider onboarding; define journeys and handoff owner; set up repo, hosting, DB and CI; schema v1 |
| **W2** | WhatsApp core | Webhooks, send/receive, conversation store, language detection, intents, handoff skeleton, staff inbox v0 |
| **W3** | AI + knowledge | Ingest FAQs, RAG, guardrails, agent actions (lead, callback, task, event), opt-in/out; submit templates for approval |
| **W2-W5** | CAS (parallel track) | W2: consent page and provider request; W3: Gmail retrieval (sandbox); W4: parsers for the 4 layouts; W5: matching, dedupe, review queue |
| **W4** | Outbound and reminders | Template sender, queue, frequency caps, SIP reminders, failed-debit flow (if the feed is confirmed), follow-up journeys, delivery tracking |
| **W5** | Workspace and handoff polish | Service-report layout, tasks/leads UI, knowledge manager, staff notifications, Investwell export/handoff |
| **W6** | Pilots and corrections | 50-client WhatsApp pilot; 20-client CAS pilot; fix wrong answers, mismatches and edge cases with the team |
| **W7** | Hardening and training | Load/error testing, security review, staff training, documentation |
| **W8** | Controlled launch and handover | Phased rollout under agreed limits, monitoring, handover session, record export |

> External approvals can extend the calendar. Start WhatsApp, Gmail and CAS provider processes in **Week 1**.

---

## 8. Inputs Needed from Nwealth (kickoff checklist)

- [ ] Logo, business display name, brand colours
- [ ] ARN number and disclosures
- [ ] Approved FAQs and reference documents (up to 30)
- [ ] Approved message templates and tone of voice
- [ ] Messaging permissions / opt-in evidence for the pilot contacts (50)
- [ ] Redacted CAS samples (all 4 layouts)
- [ ] Investwell access and the handoff method
- [ ] Source for SIP reminders and failed-debit data
- [ ] Named business owner and handoff recipient(s)
- [ ] Working hours and callback slot rules
- [ ] Frequency limits and retention requirements
- [ ] WhatsApp Business number (not tied to a personal WhatsApp account)
- [ ] Nwealth-owned Google Workspace and hosting accounts

---

## 9. Risks and Dependencies

| Risk / dependency | Impact | Mitigation |
|---|---|---|
| Gmail verification / security assessment | Blocks production CAS retrieval | Start in W1; manual upload fallback |
| CAS provider access and terms | Blocks the request flow | Confirm provider at kickoff; investor completes verification |
| WhatsApp template approval delays | Delays outbound | Submit by W3; keep copy simple |
| No reliable failed-debit feed | No live bounce alerts | Confirm the source at kickoff; otherwise descope the alert |
| Varying CAS layouts | Parsing errors | Limit to 4 agreed layouts; review queue |
| LLM hallucination in finance | Wrong advice | RAG-only answers, guardrails, handoff on low confidence |
| Opt-in evidence missing | Compliance issue | Pilot only with opted-in contacts |
| Cost overrun on AI/WhatsApp usage | Budget | Hard usage cap with alerts |
| Scope creep | Delay | Document scope exceptions before work proceeds |

---

## 10. Testing Plan

| Area | What to test |
|---|---|
| Chatbot | Each flow: greeting, FAQ (Hindi/English/Hinglish), enquiry, callback, event, CAS help, handoff, advice/transaction refusal, out-of-scope, out-of-hours |
| Guardrails | Adversarial prompts, prompt injection, "which fund should I buy", PAN pasted into chat |
| Messaging | Template rendering, 24-hour window, frequency caps, STOP/START, delivery status updates |
| CAS | Each layout, wrong password, duplicate file, unreadable PDF, wrong client match, Gmail failure |
| Security | Access roles, token expiry, encryption, secrets not in logs |
| UAT | Nwealth team runs scripted scenarios, log of corrections |
| Pilots | 50 WhatsApp contacts, 20 CAS clients, with metrics (handoff rate, answer accuracy, CAS success rate) |

---

## 11. Open Questions for Kickoff

1. Which CAS provider connection, and does it cover CAMS, KFintech, NSDL and CDSL?
2. Source and format of SIP and failed-debit data
3. Investwell: what level of access (read, export, write)?
4. Frequency caps (messages per client per week)
