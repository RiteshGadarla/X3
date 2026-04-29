Master Blueprint & Architecture: AI-Infused SDLC Customer Support Agent (CSAgent)

1. Executive Summary & Project Intent

Project Code: AG-CSAT-0426-021
Objective: To replace reactive, manual customer support operations with a fully autonomous, 17-agent AI pipeline. This system acts as the "Customer-Facing Brain" of the company. It receives tickets, categorizes them, enforces Service Level Agreements (SLAs), drafts resolutions, and directly coordinates with backend engineering bots (DevOps, QA, SRE, BA, PM) to deploy fixes—all while keeping the human in control of sensitive decisions.

Key Strategic Mandates:

Web-First Intake (Phases 1-3): To ensure a controlled environment, all initial rollouts will accept inputs only through a secure web portal. Omnichannel (Email/Slack/Teams) is strictly deferred to Phase 4.

Strict Project Isolation: The system is designed to handle multiple projects/workspaces. The databases (Qdrant, Redis, SQL) enforce absolute, project-specific data isolation. One project's KB or vector data will never interact with or leak into another project's context.

Backend Engine: LangGraph (stateful agent orchestration), Redis (high-performance state/SQL caching), and Qdrant (semantic vector operations).

Delayed Avatar Rollout: The interactive 3D WebGL Voice Avatar will be introduced in Phase 4 alongside Omnichannel features, ensuring the core ticket routing logic is perfected first.

Target Operational Metrics ("Arjuna" KPIs)

SLAs: P1 (15 mins), P2 (1 hour), P3 (4 hours), P4 (1 business day).

CSAT: Target $\ge 4.2/5.0$ average rating.

First Contact Resolution (FCR): Target $\ge 35\%$ by month 6; $\ge 45\%$ by month 12.

Triage & Deduplication Accuracy: Target $\ge 85\%$ for triage, and $\ge 90\%$ for duplicate detection.

Recurring Issues: Escalate automatically if the same issue happens 3 times in 30 days.

2. User Roles & System Access (BRD 4.4)

A foundational requirement is strict Role-Based Access Control (RBAC). The system must support the following roles and their explicit permissions:

1. System Admin / Support Operations

Powers: Initializes the overarching project workspace. Creates and provisions credentials for all users in the system. Manages integrations (ITSM/CRM).

Knowledge & Rules Setup: Uploads official SLA reference documents (PDFs, TXT files) which the AI will ingest into Qdrant. Directly views and manages the core Knowledge Base (KB) seed docs.

HIL-1 Approvals: Approves system-level AI configuration changes (routing trees, SLA thresholds) before they go live.

2. Support Agent / Support Lead

Powers (Standard Access): View assigned ticket queues (UI-01), access individual ticket details, view SLA compliance dashboards (UI-02), and monitor HIL escalation statuses. Can submit KB article drafts.

Restrictions: Cannot modify SLA configurations, agent configs, or communication templates.

3. Support Manager / CSM

Powers (Elevated Access): Has all Support Agent permissions. Manages agent configuration settings. Approves HIL-3/4 critical escalation actions (Angry customers, VIPs). Manages and officially publishes KB articles (HIL-5).

Restrictions: Cannot modify system-level agent logic or financial/legal response templates.

4. VP Customer Success

Powers (Executive + Override): Views executive dashboards (UI-11). Confirms or overrides escalation recommendations. Manages VIP customer handling and approves SLA exceptions.

Restrictions: Cannot access system-level agent configurations or channel API integration settings.

5. Legal / Compliance Team

Powers (Read + Legal Override): Isolated view of legal/compliance flagged tickets. Takes ownership of legal correspondence and records outcomes in the ITSM. Approves/blocks customer communications on legal matters.

3. Strict Business Rules & Guardrails

The system is highly autonomous, but it is physically blocked from certain actions.

Master Ticket & Deduplication Rules (BRD Specific):

Consolidation: The system must identify duplicates with $\ge 90\%$ accuracy. Duplicate tickets are suppressed from creating new workflows and must be linked to a single Master Ticket.

SRE Incident Linkage: If symptoms match an active production outage, the ticket must be linked to the SRE Agent's incident record, and the customer must be automatically informed of the known incident status.

Anti-Merge Guardrail: Conflicting customer reports on the same issue must be flagged for human (HIL) resolution without auto-merging tickets from different customers.

Notification: When tickets are consolidated, all related customers attached to the Master Ticket must receive synchronized status updates.

The Human-In-The-Loop (HIL) Checkpoints:

HIL-1 (Config): Admins must approve all SLA rules before the AI uses them.

HIL-3/4 (Critical Escalation): The AI cannot handle Billing disputes, Legal issues, VIP customers, or Angry customers. The graph execution pauses and escalates to a human manager. It also cannot close a P1/P2 ticket without human override.

HIL-5 (KB Publication): The AI drafts KB articles, but a human must click "Publish".

Dual-Confirmation Gate: The AI cannot tell a customer "the fix is deployed" until it receives async webhook confirmation from both the DevOps Agent and the QA/SRE Agent.

7-Year Data Retention: Support records for enterprise customers are retained for exactly 7 years. No customer data is used for LLM training without explicit consent.

4. Technical Architecture Stack

Project-Specific Data Isolation (Zero-Bleed Architecture)

To ensure one project's KB, SLA rules, or ticket histories never interact with another, the database layer enforces strict multi-tenancy:

Qdrant (Semantic Vector DB): Utilizes separate Collections (e.g., project_alpha_kb, project_beta_kb) or strictly enforced Payload filtering by project_id. Semantic search is rigidly bounded to the requested project.

Redis (High-Performance State/SQL Cache): Uses key prefixes (proj_{id}:state:{ticket_id}) to completely isolate LangGraph state memory, API rate limits, and SQL caching.

Postgres (Relational Data): Enforces Row-Level Security (RLS) tied to the authenticated user's project_id claim in their JWT.

Backend (Python / FastAPI / LangGraph)

LangGraph Orchestration: The 17 agents are nodes in a StateGraph.

Redis: Caches the LangGraph's state at blazing speeds, preventing database bottlenecking during high-volume ticket bursts.

Qdrant: Serves as the AI's "brain" operations. It vectorizes Admin SLA documents, Knowledge Base articles, and executes the semantic similarity searches required for Deduplication (AG-03) and First-Contact Resolution (AG-05).

Native Interrupts: The HIL gates are powered by LangGraph's interrupt_before functionality. The graph freezes, saves to Redis, and waits for a human API call to continue.

5. The 4-Phase Implementation Plan

Phase 1: Foundation, Admin Control & Web-Centric Core

Objective: Establish the LangGraph scaffolding, user role security, Admin workspace, project isolation, and the core web ticket pipeline.

Admin Project Setup & UI:

Workspace Initialization: The Admin creates a designated, isolated Project. They provision credentials for the different users (Agents, Managers, VPs, Legal).

SLA & KB Ingestion (Qdrant): The Admin uploads official SLA reference texts and PDFs into their specific project space. These are chunked and embedded into Qdrant. The config validation agent (AG-16) queries this specific collection to enforce rules.

Customer Portal (UI-09): A secure React form for customers to submit tickets. Includes a mandatory "AI is assisting you" disclosure checkbox.

Support Dashboards (UI-01, UI-06): Live Ticket Queue and the HIL Escalation Review Board.

Graph Nodes Activated:

AG-13 (PII Redaction), AG-01 (Intake & Language), AG-02 (Triage & Classification), AG-16 (Config Validation), AG-06 (SLA Clocks), AG-08 (Escalation Guard).

Phase 2: Agentic SDLC Coordination & Complex Routing

Objective: Implement complex ticket splitting, Qdrant-backed semantic deduplication (Master Tickets), and engineering handshakes.

Advanced Graph Logic Activated:

AG-11 ("Break of Multiple Tickets"): If a user submits a complex web request (e.g., "Server is down and I need a refund"), this node executes a split, spawning two separate child tickets (sub-graphs) to be routed independently.

AG-03 ("Link to Master Ticket"): Queries the project's Qdrant collection to find semantically similar incoming tickets (accuracy $\ge 90\%$). If matched to an active SRE incident or known bug, it links the ticket to the Master Ticket. It explicitly checks for conflicting reports to flag for HIL, preventing erroneous auto-merges.

AG-04 (Routing): Directs bug tickets to SRE/DevOps, and feature requests directly to the BA/PM Agents.

AG-09 (SDLC Gate): The graph pauses here. It waits to receive Webhooks from both the DevOps bot (code deployed) AND the QA bot (tests passed) before allowing resolution.

AG-14 (Loop Detection): Prevents the graph from getting stuck in an infinite routing loop between engineering bots.

Phase 3: Analytics, Self-Healing KB, and Compliance

Objective: Enable autonomous First-Contact Resolution (RAG), automate reporting, and enforce the 7-year data privacy lifecycles.

Reporting UI:

Dashboards for SLA Compliance (UI-02), Customer Sentiment (UI-03), Voice of Customer heatmaps (UI-08), and the VP Executive summary (UI-11).

Graph Nodes Activated:

AG-15 (Cold-Start) & AG-05 (KB Resolution): Powers the Qdrant RAG pipeline to answer user questions automatically based on Admin-uploaded docs.

AG-10 (KB Generation): Auto-drafts new help articles for HIL-5 approval.

AG-07 (Communication): Generates jargon-free portal replies.

AG-12 (Analytics): Runs scheduled background workers to generate required reports (R-01 through R-05).

AG-17 (Data Consent): Sweeps the database to execute the mandatory 7-year data archival/deletion policies.

Phase 4: Omnichannel Integration & Interactive Avatar

Objective: Break out of the web-only boundary and introduce the interactive, voice-controlled 3D Avatar for internal users.

Voice-Controlled Interactive Avatar UI:

Frontend: A 3D .glb Avatar is rendered in the top-right sidebar of the internal Support UI using Three.js, featuring idle animations and audio-synced visemes (lip-sync).

Workflow: React captures user voice via Web Speech API $\rightarrow$ A backend LLM parses the intent $\rightarrow$ Maps to a JSON API command (e.g., "Show me angry customers" $\rightarrow$ {"action": "filter", "status": "angry"}) $\rightarrow$ The UI updates instantly via Redux $\rightarrow$ The Avatar responds with generated TTS audio.

Channel Integrations & Graph Expansions:

Channel Admin UI (UI-04): Manage OAuth and Webhooks for third-party platforms.

AG-01 (Full Mode): Webhooks are opened for Email, WhatsApp, Slack, and MS Teams. Uses Redis rapid-hashing to instantly deduplicate users spamming multiple channels at once.

AG-07 (Full Mode): Dynamically alters outgoing response formatting (e.g., Markdown for Slack, HTML for Email) while strictly maintaining the corporate tone and syncing updates across all users attached to a Master Ticket.