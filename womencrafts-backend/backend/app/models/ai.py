"""
Models for the AI Command Center screen.

The AI page is an AGGREGATE dashboard: every widget reads from its own small
collection that simply mirrors the numbers/labels the page shows today. Nothing
here comes from a live LLM — the documents are the seeded mock data. Nine
collections, one Model class each:

    ai_priorities      — 4 "today's key priorities" chips in the greeting card
    ai_health_metrics  — 5 Business Health Score components
    ai_tasks           — 7 AI Tasks Center tasks (High + Medium)
    ai_agents          — 4 AI Workforce agents
    ai_insights        — 4 AI Insights rows
    ai_actions         — 6 One Click AI Actions tiles
    ai_activities      — 5 AI Command Timeline events
    ai_memory_stats    — 4 AI Memory & Knowledge stat tiles
    ai_prompts         — 6 Ask-AI suggestion chips + 4 Voice-assistant chips
"""


class AiPriorityModel:
    """One 'today's priorities' chip in the AI greeting card."""

    collection_name = "ai_priorities"

    @staticmethod
    def create_document(text: str, icon: str, tone: str, order: int = 0) -> dict:
        return {"text": text, "icon": icon, "tone": tone, "order": order}

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "text": doc.get("text", ""),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "order": doc.get("order", 0),
        }


class AiHealthMetricModel:
    """One component of the Business Health Score list."""

    collection_name = "ai_health_metrics"

    @staticmethod
    def create_document(
        label: str, value: int, icon: str, tone: str, trend: str = "up", order: int = 0
    ) -> dict:
        return {
            "label": label,
            "value": value,
            "icon": icon,
            "tone": tone,
            "trend": trend,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "label": doc.get("label", ""),
            "value": doc.get("value", 0),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "trend": doc.get("trend", "up"),
            "order": doc.get("order", 0),
        }


class AiTaskModel:
    """One task in the AI Tasks Center (High or Medium priority)."""

    collection_name = "ai_tasks"

    PRIORITIES = ["high", "medium"]

    @staticmethod
    def create_document(
        title: str, due: str, priority: str, icon: str, done: bool = False, order: int = 0
    ) -> dict:
        return {
            "title": title,
            "due": due,
            "priority": priority,
            "icon": icon,
            "done": done,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "due": doc.get("due", ""),
            "priority": doc.get("priority", "medium"),
            "icon": doc.get("icon", ""),
            "done": doc.get("done", False),
            "order": doc.get("order", 0),
        }


class AiAgentModel:
    """One agent card in the AI Workforce grid."""

    collection_name = "ai_agents"

    @staticmethod
    def create_document(
        name: str,
        icon: str,
        tone: str,
        metric: str,
        label: str,
        rate: str,
        last_active: str,
        status: str = "Online",
        order: int = 0,
    ) -> dict:
        return {
            "name": name,
            "icon": icon,
            "tone": tone,
            "metric": metric,   # display string, e.g. "2,451"
            "label": label,
            "rate": rate,        # display string, e.g. "98%"
            "last_active": last_active,
            "status": status,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "name": doc.get("name", ""),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "metric": doc.get("metric", ""),
            "label": doc.get("label", ""),
            "rate": doc.get("rate", ""),
            "last_active": doc.get("last_active", ""),
            "status": doc.get("status", "Online"),
            "order": doc.get("order", 0),
        }


class AiInsightModel:
    """One row in the AI Insights list, each with its own action label."""

    collection_name = "ai_insights"

    @staticmethod
    def create_document(
        title: str, description: str, action: str, icon: str, tone: str, order: int = 0
    ) -> dict:
        return {
            "title": title,
            "description": description,
            "action": action,
            "icon": icon,
            "tone": tone,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "description": doc.get("description", ""),
            "action": doc.get("action", ""),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "order": doc.get("order", 0),
        }


class AiActionModel:
    """One tile in the One Click AI Actions grid."""

    collection_name = "ai_actions"

    @staticmethod
    def create_document(
        title: str, description: str, icon: str, tone: str, order: int = 0
    ) -> dict:
        return {
            "title": title,
            "description": description,
            "icon": icon,
            "tone": tone,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "title": doc.get("title", ""),
            "description": doc.get("description", ""),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "order": doc.get("order", 0),
        }


class AiActivityModel:
    """One event in the AI Command Timeline."""

    collection_name = "ai_activities"

    STATUSES = ["Success", "Alert"]

    @staticmethod
    def create_document(
        time: str, text: str, status: str, icon: str, tone: str, order: int = 0
    ) -> dict:
        return {
            "time": time,
            "text": text,
            "status": status,
            "icon": icon,
            "tone": tone,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "time": doc.get("time", ""),
            "text": doc.get("text", ""),
            "status": doc.get("status", "Success"),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "order": doc.get("order", 0),
        }


class AiMemoryStatModel:
    """One stat tile in the AI Memory & Knowledge card."""

    collection_name = "ai_memory_stats"

    @staticmethod
    def create_document(
        label: str, value: str, sub: str, icon: str, tone: str, order: int = 0
    ) -> dict:
        return {
            "label": label,
            "value": value,   # display string, e.g. "12,458"
            "sub": sub,
            "icon": icon,
            "tone": tone,
            "order": order,
        }

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "label": doc.get("label", ""),
            "value": doc.get("value", ""),
            "sub": doc.get("sub", ""),
            "icon": doc.get("icon", ""),
            "tone": doc.get("tone", ""),
            "order": doc.get("order", 0),
        }


class AiPromptModel:
    """One canned prompt chip — either an Ask-AI suggestion or a voice chip."""

    collection_name = "ai_prompts"

    KINDS = ["suggestion", "voice"]

    @staticmethod
    def create_document(text: str, kind: str, order: int = 0) -> dict:
        return {"text": text, "kind": kind, "order": order}

    @staticmethod
    def to_response(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "text": doc.get("text", ""),
            "kind": doc.get("kind", "suggestion"),
            "order": doc.get("order", 0),
        }
