from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.core.deps import get_current_user
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.ai import (
    AiActionModel,
    AiActivityModel,
    AiAgentModel,
    AiHealthMetricModel,
    AiInsightModel,
    AiMemoryStatModel,
    AiPriorityModel,
    AiPromptModel,
    AiTaskModel,
)
from app.schemas.ai import (
    AiActionResponse,
    AiActivityResponse,
    AiAgentResponse,
    AiChatRequest,
    AiChatResponse,
    AiHealthMetricResponse,
    AiHealthStatsResponse,
    AiInsightResponse,
    AiMemoryStatResponse,
    AiPriorityResponse,
    AiPromptResponse,
    AiTaskResponse,
    AiTaskStatsResponse,
    AiTaskUpdate,
)

router = APIRouter(prefix="/ai", tags=["AI Command Center"])


# --- collection handles -------------------------------------------------------
def _priorities():
    return get_database()[AiPriorityModel.collection_name]


def _health():
    return get_database()[AiHealthMetricModel.collection_name]


def _tasks():
    return get_database()[AiTaskModel.collection_name]


def _agents():
    return get_database()[AiAgentModel.collection_name]


def _insights():
    return get_database()[AiInsightModel.collection_name]


def _actions():
    return get_database()[AiActionModel.collection_name]


def _activities():
    return get_database()[AiActivityModel.collection_name]


def _memory():
    return get_database()[AiMemoryStatModel.collection_name]


def _prompts():
    return get_database()[AiPromptModel.collection_name]


# --- greeting priorities ------------------------------------------------------
@router.get("/priorities", response_model=list[AiPriorityResponse], summary="Today's key priorities")
async def list_priorities(_: dict = Depends(get_current_user)):
    return [AiPriorityModel.to_response(d) async for d in _priorities().find({}).sort("order", 1)]


# --- business health ----------------------------------------------------------
@router.get("/health/metrics", response_model=list[AiHealthMetricResponse], summary="Business Health Score components")
async def list_health_metrics(_: dict = Depends(get_current_user)):
    return [AiHealthMetricModel.to_response(d) async for d in _health().find({}).sort("order", 1)]


@router.get("/health/stats", response_model=AiHealthStatsResponse, summary="Overall Business Health gauge")
async def health_stats(_: dict = Depends(get_current_user)):
    values = [d.get("value", 0) async for d in _health().find({}, {"value": 1})]
    # Overall gauge is the rounded mean of the component scores (round(91.6) = 92).
    overall = round(sum(values) / len(values)) if values else 0

    if overall >= 90:
        rating, color = "Excellent", "#22c55e"
    elif overall >= 75:
        rating, color = "Good", "#22c55e"
    elif overall >= 50:
        rating, color = "Fair", "#f59e0b"
    else:
        rating, color = "Needs Attention", "#ef4444"

    return AiHealthStatsResponse(
        overall=overall,
        rating=rating,
        color=color,
        center_label="/100",
        note="Your platform is performing excellent! Keep up the great work.",
    )


# --- tasks --------------------------------------------------------------------
@router.get("/tasks", response_model=list[AiTaskResponse], summary="AI Tasks Center tasks")
async def list_tasks(
    priority: Optional[Literal["high", "medium"]] = Query(None, description="Filter by priority tab"),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if priority:
        query["priority"] = priority
    return [AiTaskModel.to_response(d) async for d in _tasks().find(query).sort("order", 1)]


@router.get("/tasks/stats", response_model=AiTaskStatsResponse, summary="Task tab-badge counts")
async def task_stats(_: dict = Depends(get_current_user)):
    high = await _tasks().count_documents({"priority": "high"})
    medium = await _tasks().count_documents({"priority": "medium"})
    return AiTaskStatsResponse(high=high, medium=medium, total=high + medium)


@router.patch("/tasks/{task_id}", response_model=AiTaskResponse, summary="Toggle a task's done state")
async def update_task(task_id: str, payload: AiTaskUpdate, _: dict = Depends(get_current_user)):
    oid = to_object_id(task_id)
    doc = await _tasks().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")

    # If 'done' is omitted, flip the current value; otherwise set it explicitly.
    new_done = (not doc.get("done", False)) if payload.done is None else payload.done
    await _tasks().update_one(
        {"_id": oid},
        {"$set": {"done": new_done, "updated_at": datetime.now(timezone.utc)}},
    )
    doc["done"] = new_done
    return AiTaskResponse(**AiTaskModel.to_response(doc))


# --- agents -------------------------------------------------------------------
@router.get("/agents", response_model=list[AiAgentResponse], summary="AI Workforce agents")
async def list_agents(_: dict = Depends(get_current_user)):
    return [AiAgentModel.to_response(d) async for d in _agents().find({}).sort("order", 1)]


@router.get("/agents/{agent_id}", response_model=AiAgentResponse, summary="Single agent detail")
async def get_agent(agent_id: str, _: dict = Depends(get_current_user)):
    doc = await _agents().find_one({"_id": to_object_id(agent_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agent not found")
    return AiAgentResponse(**AiAgentModel.to_response(doc))


# --- insights -----------------------------------------------------------------
@router.get("/insights", response_model=list[AiInsightResponse], summary="AI Insights")
async def list_insights(_: dict = Depends(get_current_user)):
    return [AiInsightModel.to_response(d) async for d in _insights().find({}).sort("order", 1)]


# --- one-click actions --------------------------------------------------------
@router.get("/actions", response_model=list[AiActionResponse], summary="One Click AI Actions")
async def list_actions(_: dict = Depends(get_current_user)):
    return [AiActionModel.to_response(d) async for d in _actions().find({}).sort("order", 1)]


# --- command timeline ---------------------------------------------------------
@router.get("/activities", response_model=list[AiActivityResponse], summary="AI Command Timeline events")
async def list_activities(
    status_filter: Optional[Literal["Success", "Alert"]] = Query(
        None, alias="status", description="Filter by event status"
    ),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    # Newest first is the seeded 'order' (10:03 AM before 08:50 AM).
    return [AiActivityModel.to_response(d) async for d in _activities().find(query).sort("order", 1)]


# --- memory & knowledge -------------------------------------------------------
@router.get("/memory/stats", response_model=list[AiMemoryStatResponse], summary="AI Memory & Knowledge tiles")
async def list_memory_stats(_: dict = Depends(get_current_user)):
    return [AiMemoryStatModel.to_response(d) async for d in _memory().find({}).sort("order", 1)]


# --- prompt chips -------------------------------------------------------------
@router.get("/prompts", response_model=list[AiPromptResponse], summary="Ask-AI suggestions & voice chips")
async def list_prompts(
    kind: Optional[Literal["suggestion", "voice"]] = Query(None, description="Filter by chip kind"),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if kind:
        query["kind"] = kind
    return [AiPromptModel.to_response(d) async for d in _prompts().find(query).sort("order", 1)]


# --- chat (client-side simulation, no persistence) ----------------------------
@router.post("/chat", response_model=AiChatResponse, summary="Ask the AI executive (canned reply)")
async def ai_chat(payload: AiChatRequest, _: dict = Depends(get_current_user)):
    q = payload.question.strip()
    reply = (
        f'Here\'s what I found for "{q}": I analyzed your latest platform data and '
        "prepared a concise summary with recommended next actions. Ask me to dig "
        "deeper into any metric, agent, or region."
    )
    return AiChatResponse(reply=reply)


# --- report CSV export --------------------------------------------------------
@router.get("/report", summary="Download the AI business-health report (CSV)")
async def ai_report(_: dict = Depends(get_current_user)):
    rows = [["Metric", "Value"]]
    async for d in _health().find({}).sort("order", 1):
        rows.append([d.get("label", ""), f"{d.get('value', 0)}%"])

    def cell(value: str) -> str:
        return '"' + str(value).replace('"', '""') + '"'

    csv = "\n".join(",".join(cell(c) for c in row) for row in rows)
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="ai-business-report.csv"'},
    )


# --- seed ---------------------------------------------------------------------
# Exact mock data transcribed from the AI Command Center page. Each collection
# is filled only when empty, so real data is never overwritten.

_PRIORITIES = [
    dict(icon="ClipboardList", text="18 new listings need your approval", tone="violet", order=1),
    dict(icon="UserCheck", text="7 supervisors have pending reviews", tone="sky", order=2),
    dict(icon="TrendingDown", text="Appointment conversion dropped by 6%", tone="rose", order=3),
    dict(icon="Target", text="3 high-value leads require follow-up", tone="amber", order=4),
]

_HEALTH = [
    dict(icon="ClipboardList", label="Listings Quality", value=94, tone="violet", trend="up", order=1),
    dict(icon="MessageSquare", label="Customer Response", value=91, tone="sky", trend="up", order=2),
    dict(icon="CalendarX", label="Appointment Success", value=88, tone="amber", trend="up", order=3),
    dict(icon="UserCheck", label="Supervisor Activity", value=95, tone="emerald", trend="up", order=4),
    dict(icon="LineChart", label="Platform Growth", value=90, tone="brand", trend="up", order=5),
]

_TASKS = [
    # High priority (4)
    dict(icon="ClipboardCheck", title="Approve 18 Pending Listings", due="Due in 2h", priority="high", order=1),
    dict(icon="Target", title="Follow Up 3 High Value Leads", due="Due in 3h", priority="high", order=2),
    dict(icon="Flag", title="Review Flagged Feedback", due="Due in 5h", priority="high", order=3),
    dict(icon="CalendarX", title="Resolve 2 Disputed Appointments", due="Due in 6h", priority="high", order=4),
    # Medium priority (3)
    dict(icon="FileBarChart", title="Generate Weekly Business Insights", due="Due today", priority="medium", order=5),
    dict(icon="UserPlus", title="Verify 12 New Supervisors", due="Due today", priority="medium", order=6),
    dict(icon="UsersRound", title="Analyze Inactive Users", due="Due in 24h", priority="medium", order=7),
]

_AGENTS = [
    dict(name="Supervisor Agent", icon="Bot", tone="violet", metric="124", label="Tasks Completed", rate="98%", last_active="2 min ago", status="Online", order=1),
    dict(name="Lead Agent", icon="Target", tone="emerald", metric="340", label="Leads Qualified", rate="96%", last_active="Just now", status="Online", order=2),
    dict(name="WhatsApp Agent", icon="MessageCircle", tone="emerald", metric="2,451", label="Messages Sent", rate="97%", last_active="1 min ago", status="Online", order=3),
    dict(name="Content Agent", icon="FileText", tone="amber", metric="67", label="Listings Generated", rate="95%", last_active="3 min ago", status="Online", order=4),
]

_INSIGHTS = [
    dict(icon="BarChart3", tone="violet", title="Women's Tailoring is booming", description="Listings increased 24% in last 7 days in Texas.", action="Take Action", order=1),
    dict(icon="TrendingDown", tone="rose", title="Appointment conversion dropped", description="6% this week compared to last week.", action="Investigate", order=2),
    dict(icon="MapPin", tone="emerald", title="High demand in California", description="More supervisors needed in Los Angeles & San Diego.", action="Explore", order=3),
    dict(icon="UserMinus", tone="amber", title="127 inactive users", description="May be interested in your programs. Recommend re-engagement.", action="Run Campaign", order=4),
]

_ACTIONS = [
    dict(icon="FileText", tone="violet", title="Generate Report", description="Create any report in seconds", order=1),
    dict(icon="Megaphone", tone="rose", title="Create Campaign", description="AI will create & schedule marketing campaign", order=2),
    dict(icon="Smile", tone="sky", title="Analyze Feedback", description="Understand customer sentiment", order=3),
    dict(icon="Wand2", tone="amber", title="Optimize Listings", description="AI will optimize listings for better reach", order=4),
    dict(icon="LineChart", tone="emerald", title="Predict Growth", description="Get predictions & opportunities", order=5),
    dict(icon="Lightbulb", tone="brand", title="Smart Decisions", description="AI recommends best next actions", order=6),
]

_ACTIVITIES = [
    dict(time="10:03 AM", icon="CheckCircle2", text="AI approved 12 new listings", status="Success", tone="emerald", order=1),
    dict(time="09:45 AM", icon="CheckCircle2", text="AI qualified 7 new leads", status="Success", tone="emerald", order=2),
    dict(time="09:32 AM", icon="CheckCircle2", text="AI sent follow-up messages to 23 leads", status="Success", tone="emerald", order=3),
    dict(time="09:12 AM", icon="AlertTriangle", text="AI detected appointment drop in Texas", status="Alert", tone="amber", order=4),
    dict(time="08:50 AM", icon="CheckCircle2", text="AI generated weekly business report", status="Success", tone="emerald", order=5),
]

_MEMORY = [
    dict(icon="Database", tone="emerald", label="Knowledge Base Status", value="Healthy", sub="", order=1),
    dict(icon="FileStack", tone="violet", label="Documents Indexed", value="12,458", sub="+220 this week", order=2),
    dict(icon="Network", tone="sky", label="RAG Sources", value="28", sub="Connected", order=3),
    dict(icon="RefreshCw", tone="amber", label="Memory Updates", value="1,245", sub="Today", order=4),
]

_PROMPTS = [
    # Ask-AI suggestion chips (6)
    dict(text="What happened yesterday?", kind="suggestion", order=1),
    dict(text="Show inactive supervisors", kind="suggestion", order=2),
    dict(text="Generate weekly report", kind="suggestion", order=3),
    dict(text="Which category is growing fastest?", kind="suggestion", order=4),
    dict(text="Why did appointment drop?", kind="suggestion", order=5),
    dict(text="Create marketing campaign", kind="suggestion", order=6),
    # Voice-assistant chips (4)
    dict(text="How many new listings today?", kind="voice", order=7),
    dict(text="Which supervisor is best?", kind="voice", order=8),
    dict(text="Give me growth plan", kind="voice", order=9),
    dict(text="What should I focus today?", kind="voice", order=10),
]


async def seed() -> None:
    """Seed each AI Command Center collection only when it is currently empty."""
    db = get_database()

    if await db[AiPriorityModel.collection_name].count_documents({}) == 0:
        docs = [AiPriorityModel.create_document(**p) for p in _PRIORITIES]
        await db[AiPriorityModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai priorities")

    if await db[AiHealthMetricModel.collection_name].count_documents({}) == 0:
        docs = [AiHealthMetricModel.create_document(**h) for h in _HEALTH]
        await db[AiHealthMetricModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai health metrics")

    if await db[AiTaskModel.collection_name].count_documents({}) == 0:
        docs = [AiTaskModel.create_document(**t) for t in _TASKS]
        await db[AiTaskModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai tasks")

    if await db[AiAgentModel.collection_name].count_documents({}) == 0:
        docs = [AiAgentModel.create_document(**a) for a in _AGENTS]
        await db[AiAgentModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai agents")

    if await db[AiInsightModel.collection_name].count_documents({}) == 0:
        docs = [AiInsightModel.create_document(**i) for i in _INSIGHTS]
        await db[AiInsightModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai insights")

    if await db[AiActionModel.collection_name].count_documents({}) == 0:
        docs = [AiActionModel.create_document(**a) for a in _ACTIONS]
        await db[AiActionModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai actions")

    if await db[AiActivityModel.collection_name].count_documents({}) == 0:
        docs = [AiActivityModel.create_document(**a) for a in _ACTIVITIES]
        await db[AiActivityModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai activities")

    if await db[AiMemoryStatModel.collection_name].count_documents({}) == 0:
        docs = [AiMemoryStatModel.create_document(**m) for m in _MEMORY]
        await db[AiMemoryStatModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai memory stats")

    if await db[AiPromptModel.collection_name].count_documents({}) == 0:
        docs = [AiPromptModel.create_document(**p) for p in _PROMPTS]
        await db[AiPromptModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} ai prompts")
