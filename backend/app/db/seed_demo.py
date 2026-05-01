"""
Demo / fake-data seeder.

Populates SQLite with realistic-looking records so every dashboard has
meaningful values out of the box: users across all roles, multiple projects,
~70 tickets spread across statuses / priorities / sentiments / past 14 days
(some breaching SLA, some VIP, some recurring, some with parent-children),
KB articles in mixed states, a handful of notifications, and the default
SLA configs.

Idempotent: skips records whose unique key already exists, so it can be
safely re-run after `reset_db.py` (which is the intended trigger).
"""

import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models import (
    KBArticle, Notification, Project, Role, SLAConfig, Ticket, User,
)
from app.models.kb_article import KBArticleStatus
from app.models.notification import NotificationStatus
from app.models.ticket import Priority, SentimentLabel, TicketStatus

logger = get_logger(__name__)

# Deterministic so screenshots / demos are reproducible
random.seed(42)


# ── Reference data ──────────────────────────────────────────────────────────

USERS_TO_SEED = [
    # email,                       full_name,           role,                  is_vip
    ("manager@csagent.ai",         "Maya Patel",        "Manager",             False),
    ("vp@csagent.ai",              "Victor Reyes",      "VP Customer Success", False),
    ("legal@csagent.ai",           "Lara Okafor",       "Legal",               False),
    ("agent.alex@csagent.ai",      "Alex Chen",         "Support Agent",       False),
    ("agent.priya@csagent.ai",     "Priya Iyer",        "Support Agent",       False),
    ("agent.kenji@csagent.ai",     "Kenji Tanaka",      "Support Agent",       False),
]
DEFAULT_USER_PASSWORD = "Demo@1234!"

PROJECTS_TO_SEED = [
    ("Acme Corp",          "acme",          "Enterprise SaaS — primary tenant"),
    ("BetaCo Cloud",       "betaco",        "Mid-market customer with VIP plan"),
    ("Northwind Internal", "northwind",     "Internal IT support workspace"),
]

CATEGORIES = [
    "Billing", "Login", "Outage", "Refund", "Bug Report",
    "Account", "API", "Performance", "Integration", "Feature Request",
    "Security", "Documentation",
]
RECURRING_CATEGORIES = ["Billing", "Login", "API"]  # cluster recurring on these

ROUTING_TARGETS = [
    "L1-Support", "L2-Support", "Billing-Team",
    "DevOps-Team", "SRE-Team", "Engineering-Team",
    "Legal-Team", "Account-Mgmt",
]

SUBJECT_TEMPLATES = {
    "Billing":           ["Duplicate charge on invoice {n}", "Refund for cancelled plan", "Wrong tax applied", "Annual renewal failed"],
    "Login":             ["MFA code never arrives", "Password reset link expired", "Locked out after SSO change", "OAuth redirect loop"],
    "Outage":            ["Region us-east-1 unreachable", "Webhooks failing intermittently", "Dashboard 502 since 09:00", "Edge node returns 503"],
    "Refund":            ["Refund not received in {n} days", "Partial refund for downgrade", "Refund stuck in pending"],
    "Bug Report":        ["Export CSV truncates at {n} rows", "Date filter off-by-one", "UI flickers on Safari", "PDF receipts garbled"],
    "Account":           ["Need to merge two accounts", "Transfer ownership to new admin", "Delete inactive sub-accounts"],
    "API":               ["429 rate-limit on /v2/search", "Pagination cursor returns null", "Webhook signature mismatch", "API key rotation breaks job"],
    "Performance":       ["Reports take {n}s to load", "Search timing out under load", "Slow query on /metrics endpoint"],
    "Integration":       ["Slack notifications stopped", "Zapier connector throws 500", "Salesforce sync gaps"],
    "Feature Request":   ["Add bulk-edit for tags", "CSV import for bookmarks", "Dark mode for mobile"],
    "Security":          ["Suspicious login from {n} IPs", "Audit log gap detected", "API token leaked in logs"],
    "Documentation":     ["Docs example for {n} endpoint missing", "OpenAPI schema mismatch", "Migration guide unclear"],
}

KB_TITLES = [
    ("Resolving Duplicate Invoice Charges",     "Billing"),
    ("MFA Code Delivery Troubleshooting",       "Login"),
    ("Handling Region us-east-1 Outages",       "Outage"),
    ("Refund Processing Timeline (3-5 days)",   "Refund"),
    ("CSV Export Row-Limit Workaround",         "Bug Report"),
    ("Merging Customer Accounts Safely",        "Account"),
    ("API Rate-Limit Headers Reference",        "API"),
    ("Optimising Slow Reports Queries",         "Performance"),
    ("Slack Integration Reconnection Steps",    "Integration"),
    ("Tag Bulk-Edit — Roadmap Update",          "Feature Request"),
    ("Detecting Suspicious Login Activity",     "Security"),
    ("Migrating from v1 to v2 API",             "Documentation"),
]


# SLA targets in minutes — must match _DEFAULTS in app/api/v1/routes/sla.py
SLA_RESOLUTION_MIN = {"P1": 15, "P2": 60, "P3": 240, "P4": 480, "UNASSIGNED": 480}


# ── Per-table seeders ────────────────────────────────────────────────────────

async def _seed_users(db: AsyncSession) -> list[User]:
    role_rows = (await db.execute(select(Role))).scalars().all()
    role_by_name = {r.name: r for r in role_rows}

    seeded: list[User] = []
    for email, name, role_name, is_vip in USERS_TO_SEED:
        existing = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if existing:
            seeded.append(existing)
            continue
        role = role_by_name.get(role_name)
        u = User(
            email=email,
            full_name=name,
            hashed_password=hash_password(DEFAULT_USER_PASSWORD),
            role_id=role.id if role else None,
            is_active=True,
            is_vip=is_vip,
        )
        db.add(u)
        seeded.append(u)
    await db.flush()
    logger.info(f"Seeded {len(seeded)} demo users (password: {DEFAULT_USER_PASSWORD})")
    return seeded


async def _seed_projects(db: AsyncSession) -> list[Project]:
    seeded: list[Project] = []
    for name, slug, desc in PROJECTS_TO_SEED:
        existing = (await db.execute(select(Project).where(Project.slug == slug))).scalar_one_or_none()
        if existing:
            seeded.append(existing)
            continue
        p = Project(name=name, slug=slug, description=desc)
        db.add(p)
        seeded.append(p)
    await db.flush()
    logger.info(f"Seeded {len(seeded)} demo projects")
    return seeded


async def _seed_sla_configs(db: AsyncSession) -> None:
    defaults = [
        {"priority": "P1", "response_time_minutes": 5,   "resolution_time_minutes": 15,  "approved_by_admin": True},
        {"priority": "P2", "response_time_minutes": 15,  "resolution_time_minutes": 60,  "approved_by_admin": True},
        {"priority": "P3", "response_time_minutes": 30,  "resolution_time_minutes": 240, "approved_by_admin": True},
        {"priority": "P4", "response_time_minutes": 120, "resolution_time_minutes": 480, "approved_by_admin": True},
    ]
    added = 0
    for d in defaults:
        existing = (await db.execute(select(SLAConfig).where(SLAConfig.priority == d["priority"]))).scalar_one_or_none()
        if existing:
            continue
        db.add(SLAConfig(**d))
        added += 1
    await db.flush()
    if added:
        logger.info(f"Seeded {added} SLA configs (P1-P4)")


def _make_subject(category: str, n: int) -> str:
    template = random.choice(SUBJECT_TEMPLATES.get(category, ["Issue with {n}"]))
    return template.format(n=n)


async def _seed_tickets(db: AsyncSession, agents: list[User], projects: list[Project]) -> list[Ticket]:
    """
    Build ~70 tickets distributed across the past 14 days. Distribution targets
    (by design — not strict):
      • ~25% resolved, ~10% closed, ~10% escalated, ~10% pending_hil,
        ~25% in_progress, ~15% triaged, ~5% new
      • ~5% P1, ~15% P2, ~40% P3, ~40% P4
      • ~10% angry sentiment, ~20% negative, ~50% neutral, ~20% positive
      • ~12 tickets with breached SLA (sla_deadline in the past, not resolved)
      • ~12 tickets flagged recurring on Billing/Login/API
      • A few VIP tickets, a few SDLC-gate tickets routed to engineering teams
      • 2 parent-child splits to populate the AG-11 split view
    """
    existing_count = (await db.execute(select(Ticket))).scalars().first()
    if existing_count:
        logger.info("Tickets already exist — skipping ticket seed (idempotent).")
        return list((await db.execute(select(Ticket))).scalars().all())

    now = datetime.now(timezone.utc)
    customers = [
        ("Sarah Johnson",   "sarah.j@acme.com"),
        ("Liam O'Connor",   "liam@betaco.io"),
        ("Aisha Rahman",    "aisha.r@northwind.test"),
        ("Diego Martinez",  "diego.m@acme.com"),
        ("Yuki Sato",       "yuki@betaco.io"),
        ("Olamide Adeyemi", "ola@globex.example"),
        ("Hannah Becker",   "hannah.b@initech.test"),
        ("Ravi Kapoor",     "ravi.k@umbrella.example"),
        ("Elena Volkov",    "elena.v@acme.com"),
        ("Marcus Lee",      "marcus.l@betaco.io"),
        ("Fatima Zahra",    "fatima@globex.example"),
        ("Tomás Silva",     "tomas@northwind.test"),
    ]
    vip_customers = {"sarah.j@acme.com", "ravi.k@umbrella.example"}

    target_total = 70
    tickets: list[Ticket] = []

    # Skewed pickers to hit the distribution targets
    status_pool = (
        [TicketStatus.RESOLVED]    * 18 +
        [TicketStatus.CLOSED]      * 7  +
        [TicketStatus.IN_PROGRESS] * 18 +
        [TicketStatus.TRIAGED]     * 10 +
        [TicketStatus.NEW]         * 4  +
        [TicketStatus.ESCALATED]   * 7  +
        [TicketStatus.PENDING_HIL] * 6
    )
    priority_pool = (
        [Priority.P1] * 4 +
        [Priority.P2] * 11 +
        [Priority.P3] * 28 +
        [Priority.P4] * 27
    )
    sentiment_pool = (
        [SentimentLabel.POSITIVE] * 14 +
        [SentimentLabel.NEUTRAL]  * 35 +
        [SentimentLabel.NEGATIVE] * 14 +
        [SentimentLabel.ANGRY]    * 7
    )

    breached_remaining   = 12
    recurring_remaining  = 12
    sdlc_remaining       = 6   # tickets routed to engineering for SDLC gate
    p1_remaining         = priority_pool.count(Priority.P1)

    for i in range(target_total):
        status    = random.choice(status_pool)
        priority  = random.choice(priority_pool)
        sentiment = random.choice(sentiment_pool)
        category  = random.choice(CATEGORIES)
        cust      = random.choice(customers)
        project   = random.choice(projects)

        # Spread creation over the past 14 days (heavier in last 7 to feed the heatmap)
        days_back  = random.choices(range(0, 14), weights=[10, 10, 9, 9, 9, 8, 8, 5, 5, 4, 4, 3, 3, 3])[0]
        hours_back = random.randint(0, 23)
        mins_back  = random.randint(0, 59)
        created_at = now - timedelta(days=days_back, hours=hours_back, minutes=mins_back)

        # Compute SLA deadline relative to created_at
        resolution_min = SLA_RESOLUTION_MIN.get(priority.value, 240)
        sla_deadline   = created_at + timedelta(minutes=resolution_min)

        # Force some unresolved tickets into a breached state by aging the deadline past
        force_breach = (
            breached_remaining > 0
            and status not in (TicketStatus.RESOLVED, TicketStatus.CLOSED)
            and (now - created_at) >= timedelta(minutes=30)
        )
        if force_breach:
            sla_deadline = now - timedelta(minutes=random.randint(10, 240))
            breached_remaining -= 1

        resolved_at = None
        if status in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
            # Resolved between 5min after creation and just before now
            res_after = max(5, int((now - created_at).total_seconds() / 60) - 5)
            resolved_at = created_at + timedelta(minutes=random.randint(5, max(6, res_after)))

        # Routing — for in-progress / escalated tickets pick a target
        routing_target = None
        sdlc_devops_ok = False
        sdlc_qa_ok = False
        if status not in (TicketStatus.NEW, TicketStatus.TRIAGED):
            if sdlc_remaining > 0 and category in {"Bug Report", "Outage", "API", "Performance"}:
                routing_target = random.choice(["DevOps-Team", "SRE-Team", "Engineering-Team"])
                # Mix of partial / full gate confirmations to populate SDLCTracker
                sdlc_devops_ok = random.random() < 0.7
                sdlc_qa_ok     = random.random() < 0.55
                sdlc_remaining -= 1
            else:
                routing_target = random.choice(ROUTING_TARGETS)

        recurring_flag = False
        if recurring_remaining > 0 and category in RECURRING_CATEGORIES and random.random() < 0.65:
            recurring_flag = True
            recurring_remaining -= 1

        # P1 tickets force angry/negative sentiment more often (realism)
        if priority == Priority.P1 and random.random() < 0.6:
            sentiment = random.choice([SentimentLabel.ANGRY, SentimentLabel.NEGATIVE])

        is_vip = cust[1] in vip_customers
        ticket_ref = f"TCK-{1000 + i:04d}"

        ticket = Ticket(
            ticket_ref=ticket_ref,
            customer_name=cust[0],
            customer_email=cust[1],
            subject=_make_subject(category, random.randint(2, 99)),
            description=(
                f"Customer reports: {category.lower()} issue affecting their workflow. "
                f"Severity perceived as {priority.value}. Initial sentiment: {sentiment.value}. "
                f"Submitted from project {project.slug}."
            ),
            category=category,
            priority=priority,
            status=status,
            sentiment=sentiment,
            ai_disclosure_accepted=True,
            project_id=project.id,
            is_vip_customer=is_vip,
            recurring_issue=recurring_flag,
            routing_target=routing_target,
            sdlc_devops_ok=sdlc_devops_ok,
            sdlc_qa_ok=sdlc_qa_ok,
            loop_count=random.choices([0, 1, 2], weights=[80, 15, 5])[0],
            assigned_to_id=random.choice(agents).id if agents and status not in (TicketStatus.NEW,) else None,
            sla_deadline=sla_deadline,
            resolved_at=resolved_at,
            created_at=created_at,
            updated_at=resolved_at or created_at,
        )
        db.add(ticket)
        tickets.append(ticket)

        if priority == Priority.P1:
            p1_remaining -= 1

    await db.flush()

    # ── Parent / child splits (AG-11) — pick 2 parents and attach 2 children each ──
    parents = random.sample(tickets, k=2)
    for parent in parents:
        for j in range(2):
            child_idx = len(tickets)
            child_ref = f"TCK-{1000 + child_idx:04d}"
            child = Ticket(
                ticket_ref=child_ref,
                customer_name=parent.customer_name,
                customer_email=parent.customer_email,
                subject=f"[Split] {parent.subject} — part {j + 1}",
                description=f"Sub-issue {j + 1} extracted from parent {parent.ticket_ref}.",
                category=parent.category,
                priority=parent.priority,
                status=TicketStatus.IN_PROGRESS,
                sentiment=parent.sentiment,
                project_id=parent.project_id,
                parent_id=parent.id,
                routing_target=parent.routing_target,
                sla_deadline=parent.sla_deadline,
                created_at=parent.created_at + timedelta(minutes=15 * (j + 1)),
                updated_at=parent.created_at + timedelta(minutes=20 * (j + 1)),
            )
            db.add(child)
            tickets.append(child)

    await db.flush()

    breached = sum(1 for t in tickets if t.sla_deadline and t.sla_deadline < now and t.status not in (TicketStatus.RESOLVED, TicketStatus.CLOSED))
    p1_open  = sum(1 for t in tickets if t.priority == Priority.P1 and t.status not in (TicketStatus.RESOLVED, TicketStatus.CLOSED))
    angry    = sum(1 for t in tickets if t.sentiment == SentimentLabel.ANGRY)
    logger.info(
        f"Seeded {len(tickets)} demo tickets "
        f"(breached={breached}, P1 open={p1_open}, angry={angry})"
    )
    return tickets


async def _seed_kb_articles(db: AsyncSession, admin_id: int | None) -> None:
    existing = (await db.execute(select(KBArticle))).scalars().first()
    if existing:
        logger.info("KB articles already exist — skipping KB seed.")
        return

    now = datetime.now(timezone.utc)
    # Mix: 8 published (across the last 7 days), 3 drafts, 1 rejected
    states = (
        [(KBArticleStatus.PUBLISHED, i) for i in range(8)] +
        [(KBArticleStatus.DRAFT,     None) for _ in range(3)] +
        [(KBArticleStatus.REJECTED,  None)]
    )
    random.shuffle(states)

    for (title, category), (status, days_back) in zip(KB_TITLES, states):
        created_at = now - timedelta(days=random.randint(2, 12), hours=random.randint(0, 23))
        published_at = None
        published_by_id = None
        if status == KBArticleStatus.PUBLISHED:
            offset = days_back if days_back is not None else random.randint(0, 6)
            published_at = now - timedelta(days=offset, hours=random.randint(0, 23))
            published_by_id = admin_id
        article = KBArticle(
            title=title,
            content=(
                f"## {title}\n\n"
                f"This article addresses recurring {category} issues. "
                f"Recommended workflow:\n"
                f"1. Confirm the symptom matches the description.\n"
                f"2. Apply the documented fix.\n"
                f"3. Verify resolution with the customer.\n\n"
                f"_Auto-drafted by AG-10 from a resolved ticket._"
            ),
            source_ticket_ref=f"TCK-{random.randint(1000, 1069):04d}",
            status=status,
            published_by_id=published_by_id,
            published_at=published_at,
            created_at=created_at,
            updated_at=published_at or created_at,
        )
        db.add(article)
    await db.flush()
    logger.info(f"Seeded {len(KB_TITLES)} KB articles (mixed published/draft/rejected)")


async def _seed_notifications(db: AsyncSession, tickets: list[Ticket]) -> None:
    existing = (await db.execute(select(Notification))).scalars().first()
    if existing:
        logger.info("Notifications already exist — skipping notification seed.")
        return

    parent_links = [t for t in tickets if t.parent_id is not None][:5]
    if not parent_links:
        return

    now = datetime.now(timezone.utc)
    for child in parent_links:
        master_ref = next((t.ticket_ref for t in tickets if t.id == child.parent_id), child.ticket_ref)
        sent_status = random.choices(
            [NotificationStatus.SENT, NotificationStatus.PENDING, NotificationStatus.FAILED],
            weights=[70, 25, 5]
        )[0]
        sent_at = now - timedelta(minutes=random.randint(5, 240)) if sent_status == NotificationStatus.SENT else None
        db.add(Notification(
            master_ticket_ref=master_ref,
            child_ticket_ref=child.ticket_ref,
            customer_email=child.customer_email,
            message=(
                f"Your issue has been split into multiple sub-tickets for faster resolution. "
                f"Track the master at {master_ref}."
            ),
            status=sent_status,
            created_at=child.created_at,
            sent_at=sent_at,
        ))
    await db.flush()
    logger.info(f"Seeded {len(parent_links)} notifications")


# ── Public entrypoint ────────────────────────────────────────────────────────

async def seed_demo_data() -> None:
    """Populate the DB with a complete demo dataset. Idempotent."""
    async with AsyncSessionLocal() as db:
        await _seed_sla_configs(db)
        users     = await _seed_users(db)
        projects  = await _seed_projects(db)

        # Build a role_id → name map up front so we don't trigger a lazy-load
        # on `user.role.name` outside the async greenlet context.
        role_rows = (await db.execute(select(Role))).scalars().all()
        role_name_by_id = {r.id: r.name for r in role_rows}

        admin = (await db.execute(select(User).where(User.email == "admin@csagent.ai"))).scalar_one_or_none()
        agents = [
            u for u in users
            if role_name_by_id.get(u.role_id) in ("Support Agent", "Manager")
        ]
        if admin and admin not in agents:
            agents.append(admin)

        tickets = await _seed_tickets(db, agents=agents, projects=projects)
        await _seed_kb_articles(db, admin_id=admin.id if admin else None)
        await _seed_notifications(db, tickets=tickets)
        await db.commit()

    logger.info("✅ Demo data seed complete.")
