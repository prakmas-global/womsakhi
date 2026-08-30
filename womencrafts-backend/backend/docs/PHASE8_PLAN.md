# Phase 8 — Backend Blueprint (auto-generated plan)

Maps every remaining UI module to backend entities, endpoints, and seed data.
Build order below. **Done:** Users (members + roles + segments).

| # | Module | Aggregate? | Collections | Seed | # Endpoints |
|---|--------|-----------|-------------|------|-------------|
| 1 | dashboard | yes | system_overview | 1 | 7 |
| 2 | appointments | no | appointments | 18 | 6 |
| 3 | services | no | services, service_types | 10 | 12 |
| 4 | programs | no | programs | 5 | 10 |
| 5 | calendar | no | calendar_events | 5 | 7 |
| 6 | messages | no | conversations, conversations.messages (embedded array, not its own collection), message_stats (single seeded summary document; feeds stat cards, donut overview, and top contacts) | 28 | 11 |
| 7 | analytics | yes | analytics_summary, analytics_traffic, analytics_devices, analytics_sources, analytics_engagement, analytics_top_pages, analytics_referrers | 38 | 10 |
| 8 | reports | no | reports, reports_overview | 7 | 11 |
| 9 | content | no | content_items, content_activities, content_stats | 13 | 11 |
| 10 | feedback | no | feedback, feedback_themes, feedback_program_ratings | 14 | 10 |
| 11 | ai | no | ai_priorities, ai_health_metrics, ai_tasks, ai_agents, ai_insights, ai_actions, ai_activities, ai_memory_stats, ai_prompts | 49 | 15 |
| 12 | notifications | no | notifications, notification_channels | 16 | 8 |
| 13 | settings-billing | no | billing_account, plans, invoices | 9 | 13 |
| 14 | settings-sessions-logs | no | sessions, system_logs | 17 | 12 |
| 15 | settings-integrations-roles | no | integrations, roles, permission_groups, integration_requests, webhook_config | 27 | 21 |

---

## dashboard  _(aggregate)_
- **SystemOverview** → `system_overview` (seed 1)
  - fields: storage_used_gb:float, storage_total_gb:float, storage_percent:float, active_sessions:int, system_status:str, status_label:str, last_backup_at:datetime, last_backup_type:str
  - endpoints:
    - `GET /dashboard/overview (single bundle: kpi_stats + appointment_trend + appointment_tiles + users_by_role + recent_users + recent_appointments + system_overview — one call to hydrate whole screen)`
    - `GET /dashboard/stats (4 KPI cards, each {key,label,value,delta,tone,href}: total_users=1,248 +12.5%; appointments=856 +8.3%; revenue=$24,568 +15.7%; programs=32 +6.2%)`
    - `GET /dashboard/appointments/trend?range=this_month (AreaTrend: 12 points [{label,value}] + status tiles {total:856,completed:642,scheduled:156,cancelled:58}; range dropdown default 'This Month')`
    - `GET /dashboard/users/by-role (DonutChart segments [{name,value,color}] for 5 roles + legend with 'N (pct%)' strings + center_value='1,248', center_label='Total')`
    - `GET /dashboard/users/recent?limit=5 (newest registrations, each {name,email,date,status='Active'}, sorted by created_at desc)`
    - `GET /dashboard/appointments/recent?limit=5 (newest appointments, each {title,who,date,time,status}, sorted by scheduled_at desc)`
    - `GET /dashboard/system-overview (storage usage %, GB used/total, active sessions count, system_status, last backup timestamp+type)`

## appointments
- **Appointment** → `appointments` (seed 18)
  - fields: id:str, name:str, service:str, day:str, date:str, time:str, status:str, category:str, color:str, bg:str, duration:str|null, notes:str|null
  - endpoints:
    - `GET /appointments?status=&service=&day=&date=&quick=&q=&page=&page_size= (list; drives Calendar/Board/List views. status in Upcoming|Completed|Cancelled|Rescheduled; service in 10 service enum; quick in All|Today|Tomorrow|This Week|This Month where Today=>date 'May 20', Tomorrow=>date 'May 21', This Week/This Month/All=>all; q searches name)`
    - `GET /appointments/{id} (single appointment for the detail modal)`
    - `POST /appointments (create from New Appointment modal: name[required], service, date, time, duration, status, notes; server derives day/date labels, category, color, bg via presetFor(service))`
    - `PATCH /appointments/{id} (update status only — powers Cancel Appointment / Reschedule / Mark Complete buttons; body {status})`
    - `DELETE /appointments/{id} (optional, remove an appointment)`
    - `GET /appointments/stats (single payload feeding all analytics widgets: 5 stat cards with value+delta+deltaDir, quick-filter counts, status donut breakdown, by-service donut, upcoming reminders, cancellation-prediction gauge, avg booking lead time + 12-point trend — see filtersTabsStats for exact values)`

## services
- **Service** → `services` (seed 5)
  - fields: name:str, type:str, tone:str, duration:str, price:str, status:str, bookings:int, rating:str, description:str, created_at:datetime
- **ServiceType** → `service_types` (seed 5)
  - fields: name:str, desc:str, services:int, status:str, pop:int, color:str, created_at:datetime
  - endpoints:
    - `GET /services?status=&type=&q=&page=&page_size= (list services; status=All Services|Active|Inactive, type=Fashion|Beauty|Photography|Digital|Wellness, q=name search, pagination 'Showing 1 to N of 156')`
    - `GET /services/{id} (single service for detail modal)`
    - `POST /services (Add New Service; body name,type,duration,price,status,description; server derives tone/icon from type, sets bookings=0, rating='0.0')`
    - `PUT /services/{id} (Edit Service; name,type,duration,price,status,description; re-derives tone from type, keeps existing price if blank)`
    - `PATCH /services/{id}/status (toggle Active<->Inactive for Activate/Deactivate action)`
    - `DELETE /services/{id} (delete service)`
    - `GET /services/stats?range= (stat cards + overview donut + popular list; range=Today|This Week|This Month|This Year)`
    - `GET /service-types?page=&page_size= (list categories; pagination 'Showing 1 to N of 12')`
    - `POST /service-types (Add New Type; body name,desc,status,pop; server derives color/icon from name, services=0)`
    - `PUT /service-types/{id} (Edit Type; name,desc,status,pop clamped 0-100)`
    - `DELETE /service-types/{id} (delete category)`
    - `GET /services/types (distinct types present in services, feeds the Filters dropdown 'availableTypes')`

## programs
- **Program** → `programs` (seed 5)
  - fields: name:str, desc:str, category:str, catTone:str, mode:str, duration:str, dates:str, days:str, enrolled:int, cap:int, pct:int, status:str, note:str, bar:str
  - endpoints:
    - `GET /programs?q=&status=&category=&mode=&tab=&sort=&page=&page_size= (list with search over name+desc, status/category/mode/tab filters, sort, pagination; returns items + total)`
    - `GET /programs/stats (5 stat cards: totalPrograms=32, activePrograms=24, upcomingPrograms=5, totalEnrollments=1248, completionRate=78)`
    - `GET /programs/overview?range=This%20Week|This%20Month|This%20Quarter|This%20Year (area-trend series W1..W8 + summary newPrograms=3, enrollments=+142, completions=+68)`
    - `GET /programs/categories (Top Categories rail: list of {name, value(0-100), color})`
    - `POST /programs (create; body: name*, desc, category, mode, duration, cap, startDate, days, status)`
    - `GET /programs/{id} (detail modal)`
    - `PATCH /programs/{id} (edit — recomputes pct from enrolled/cap, catTone & bar from category)`
    - `DELETE /programs/{id} (delete)`
    - `POST /programs/{id}/complete (mark completed -> status=Completed, note=Completed, pct=100)`
    - `POST /programs/{id}/archive (archive -> status=Archived, note=Archived)`

## calendar
- **CalendarEvent** → `calendar_events` (seed 5)
  - fields: id:int, title:str, category:str, date:datetime/date, time:str|null, attendee:str|null, notes:str|null, color:str
  - endpoints:
    - `GET /calendar/events?category=&start=&end=&q=&page=&page_size= (list events; category filters by legend selection; start/end are ISO dates bounding the visible Day/Week/Month window; q optional search over title/attendee; pagination optional since dataset is small)`
    - `GET /calendar/events/upcoming?after=2024-05-20&limit=4 (upcoming list for sidebar: events on/after 'today' 2024-05-20, sorted by date then time, default limit 4)`
    - `GET /calendar/events/{id} (event detail modal)`
    - `POST /calendar/events (New Event modal: title, category, date, time?, attendee?, notes?)`
    - `PATCH /calendar/events/{id} (Edit Event modal; save changes / move date)`
    - `DELETE /calendar/events/{id} (delete from detail modal)`
    - `GET /calendar/events/stats (optional: per-category counts to support legend badges/aggregation)`

## messages
- **Conversation** → `conversations` (seed 7)
  - fields: id:str, name:str, preview:str, time:str, unread:int, starred:bool, active:bool, messages:list[dict]
- **Message** → `conversations.messages (embedded array, not its own collection)` (seed 20)
  - fields: dir:str, text:str, file:dict, time:str
- **MessageStats** → `message_stats (single seeded summary document; feeds stat cards, donut overview, and top contacts)` (seed 1)
  - fields: totalConversations:int, messagesSent:int, messagesReceived:int, avgResponseTime:str, resolvedConversations:int, overviewTotal:int, overview:list[dict], topContacts:list[dict]
  - endpoints:
    - `GET /messages/conversations?q=&filter=&page=&page_size= (list conversations for the left pane; q searches name+preview, filter in [all,unread,starred,attachments]; returns items + total=248 for the 'Showing 1 to N of 248' footer)`
    - `GET /messages/conversations/{id} (single conversation incl. full messages thread for the center chat pane)`
    - `POST /messages/conversations (New Message modal: {recipient/name, body?} -> creates convo with optional first outbound message; preview defaults to body or 'New conversation')`
    - `POST /messages/conversations/{id}/messages (composer Send and Paperclip attach: {dir:'out', text?} or {dir:'out', file:{name,size}}; appends bubble, updates preview+time)`
    - `PATCH /messages/conversations/{id} (flag updates: toggle starred, mark unread (unread=1), archive (unread=0, starred=false), or select/read (unread=0))`
    - `DELETE /messages/conversations/{id} (Delete conversation menu action)`
    - `POST /messages/broadcast (Broadcast modal: {recipients enum, body} -> send to a group; recipients in [All users, Active users, Workshop enrollees, Starred contacts])`
    - `GET /messages/stats?range=This Month (feeds 5 stat cards + donut overview + top contacts; range in [This Week, This Month, This Quarter, This Year] — currently static)`
    - `GET /messages/contacts (recipient dropdown options for New Message = the 7 seed conversation names)`
    - `GET /messages/templates (Message Templates modal list: Welcome message, Program brochure, Appointment confirmation, Workshop reminder)`
    - `GET /messages/automations (Automated Messages modal list: Auto-reply when away, New enrollment notification, Appointment reminder, Weekly digest)`

## analytics  _(aggregate)_
- **AnalyticsSummary** → `analytics_summary` (seed 1)
  - fields: total_visitors:int, total_visitors_delta:float, total_visitors_dir:str, page_views:int, page_views_delta:float, page_views_dir:str, avg_session:str, avg_session_delta:float, avg_session_dir:str, bounce_rate:float, bounce_rate_delta:float, bounce_rate_dir:str, conversions:int, conversions_delta:float, conversions_dir:str, realtime_active:int, realtime_change:int, realtime_change_dir:str
- **AnalyticsTrafficPoint** → `analytics_traffic` (seed 12)
  - fields: order:int, label:str, value:int
- **AnalyticsDevice** → `analytics_devices` (seed 3)
  - fields: name:str, value:int, color:str
- **AnalyticsSource** → `analytics_sources` (seed 5)
  - fields: label:str, value:int, color:str
- **AnalyticsEngagementPoint** → `analytics_engagement` (seed 6)
  - fields: order:int, label:str, sessions:int, users:int
- **AnalyticsTopPage** → `analytics_top_pages` (seed 6)
  - fields: page:str, views:int, unique:int, bounce:int, time:str, tone:str
- **AnalyticsReferrer** → `analytics_referrers` (seed 5)
  - fields: name:str, visits:int, pct:int, color:str
  - endpoints:
    - `GET /analytics/overview?range=Last%2030%20Days&period=This%20Month (single aggregate payload: summary + realtime + all chart datasets in one call — matches how the page loads everything at once)`
    - `GET /analytics/summary?range=Last%2030%20Days (5 stat cards + realtime block)`
    - `GET /analytics/traffic?period=This%20Month (12 monthly traffic points for the area chart, sorted by order)`
    - `GET /analytics/devices (3 device-share slices for donut chart)`
    - `GET /analytics/sources (5 traffic-source shares for bar chart)`
    - `GET /analytics/engagement (6 sessions-vs-users points for multiline chart, sorted by order)`
    - `GET /analytics/top-pages (6 top pages for the table; feeds the client-side CSV export and the row-detail modal)`
    - `GET /analytics/referrers (5 top referrers for progress-bar list)`
    - `GET /analytics/realtime (live active-user count + change vs an hour ago)`
    - `GET /analytics/stats (alias for summary stat cards if overview is not used)`

## reports
- **Report** → `reports` (seed 6)
  - fields: id:str, name:str, description:str, category:str, tone:str, icon:str, type:str, schedule:str, schedule_detail:str, last_generated:str, created_by:str, scheduled:bool
- **ReportsOverview** → `reports_overview` (seed 1)
  - fields: total_reports:int, scheduled_reports:int, reports_generated:int, reports_generated_delta:float, avg_generation_time:str, data_points_analyzed:str, data_points_delta:float, generated_trend:list[dict{label:str,value:int}], data_points_trend:list[float], top_categories:list[dict{name:str,value:int(percent),color:str
  - endpoints:
    - `GET /reports?q=&category=&type=&page=&page_size=6 (list All Reports table; q searches name/description/category; category in [All Categories|User Activity|Appointments|Program & Services|Financial|Marketing|Others]; type in [All Types|Summary|Detailed|Custom]; returns items + total=42 + page meta)`
    - `GET /reports/stats (feeds 5 stat cards + Reports Overview widgets: reports_generated area trend, data_points bar trend, top_categories donut; returns the ReportsOverview singleton)`
    - `GET /reports/recent?limit=4 (Recent Reports panel; reports sorted by last_generated desc, returns name + last_generated)`
    - `GET /reports/scheduled (Scheduled Reports panel; reports where scheduled=true, returns name + schedule_detail + 'Active' status)`
    - `GET /reports/templates (Manage Templates modal; one entry per category -> '{category} Template', 'Reusable layout for {category} reports', Active)`
    - `GET /reports/{id} (report detail modal: category, type, schedule, last_generated, created_by)`
    - `POST /reports (Create Report modal; body name*, category, type, schedule, description; defaults type=Summary, schedule=On Demand, created_by='Admin User', last_generated='May 21, 2024 10:00 AM'; tone+icon derived from category)`
    - `PUT /reports/{id} (Edit Report modal; updates name, description, category(->tone/icon), type, schedule)`
    - `DELETE /reports/{id} (row menu Delete + detail modal Delete)`
    - `POST /reports/{id}/run (row menu 'Run now' / detail 'Download' — regenerates + returns report)`
    - `GET /reports/export?q=&category=&type= (Export button — CSV of filtered rows: Report Name, Description, Category, Type, Schedule, Last Generated, Created By; UI currently builds CSV client-side, endpoint optional)`

## content
- **ContentItem** → `content_items` (seed 8)
  - fields: id:str, title:str, slug:str, type:str, status:str, author:str, description:str, last_updated:str, tone:str, s_tone:str, icon:str
- **ContentActivity** → `content_activities` (seed 4)
  - fields: id:str, icon:str, tone:str, text:str, meta:str
- **ContentStats** → `content_stats` (seed 1)
  - fields: total_content:int, published:int, published_pct:float, draft:int, draft_pct:float, scheduled:int, scheduled_pct:float, trash:int, trash_pct:float, overview:list[dict{name:str,, categories:list[dict{name:str,, storage_used_gb:float, storage_total_gb:float, storage_percent:float
  - endpoints:
    - `GET /content?tab=&type=&status=&author=&q=&published_only=&page=1&page_size=8 (list content_items; tab in [All Content,Pages,Blog Posts,Media,Testimonials,FAQs,Banners] maps to type; type in [All Types,Page,Blog Post,Media,Banner,FAQ,Program]; status in [All Status,Published,Draft,Scheduled]; author in [All Authors,+4 names]; q searches title+slug case-insensitive; published_only=true forces status=Published; returns {items, total, showing_from, showing_to, page, total_pages})`
    - `GET /content/{id} (single item for the detail modal)`
    - `POST /content (create; body: title(required), type, status, author, slug(auto-generated '/'+kebab(title) if blank), description; server derives tone/s_tone/icon and sets last_updated)`
    - `PUT /content/{id} (edit form: title, type, status, author, slug, description; refreshes last_updated)`
    - `PATCH /content/{id}/status (body: status; used by Publish / Move to Draft / detail-modal Publish-Unpublish toggle)`
    - `DELETE /content/{id} (single 'Move to Trash' / Delete)`
    - `POST /content/bulk (body: {ids:[], action: publish|draft|trash} for Bulk Actions menu)`
    - `GET /content/stats (feeds 5 stat cards + Content Overview donut + Content Categories bars + Storage Usage; returns the ContentStats singleton — fixed seeded snapshot, NOT computed from the 8 rows)`
    - `GET /content/activity?limit=4 (Recent Activity feed from content_activities)`
    - `GET /content/authors (distinct author list for the Author filter dropdown: Neha Verma, Priya Sharma, Ritika Singh, Anjali Mehta)`
    - `GET /content/export?type=&status=&author=&q= (CSV export of filtered rows; columns: Title,Slug,Type,Status,Author,Last Updated — currently done client-side, optional server support)`

## feedback
- **Feedback** → `feedback` (seed 5)
  - fields: id:int, text:str, user_name:str, user_email:str, type:str, program:str, rating:int, sentiment:str, date:datetime, status:str
- **FeedbackTheme** → `feedback_themes` (seed 4)
  - fields: id:int, label:str, icon:str, tone:str, mentions:int, delta:int/float, up:bool
- **ProgramRating** → `feedback_program_ratings` (seed 5)
  - fields: id:int, name:str, rating:float
  - endpoints:
    - `GET /feedback?q=&type=&program=&rating=&date_range=&tab=&sort=&page=&page_size= (paginated list; filters below)`
    - `GET /feedback/{id} (detail modal)`
    - `PATCH /feedback/{id}/status (body: {status: 'Resolved'|'In Review'|'Open'} — Mark Resolved / Mark In Review)`
    - `DELETE /feedback/{id} (delete row)`
    - `POST /feedback/requests (Request Feedback modal; body: {recipient, program, message} -> returns success message; no seed/persistence required)`
    - `GET /feedback/stats (5 stat cards: total_feedback=1248, average_rating=4.6, positive_percentage=92 w/ +8% delta, responses_this_month=156 w/ +15% delta, feedback_users=842)`
    - `GET /feedback/overview?date_range= (donut 'Feedback Overview': Positive 92(59%), Suggestion 34(22%), Neutral 18(12%), Negative 12(7%), center total=156)`
    - `GET /feedback/top-programs (Top Programs by Feedback — ProgramRating list, sorted by rating desc)`
    - `GET /feedback/themes (What are people saying — FeedbackTheme list)`
    - `GET /feedback/export?<same filters> (CSV export: User,Email,Type,Program,Rating,Date,Status,Feedback)`

## ai
- **AiPriority** → `ai_priorities` (seed 4)
  - fields: text:str, icon:str, tone:str, order:int
- **AiHealthMetric** → `ai_health_metrics` (seed 5)
  - fields: label:str, value:int, icon:str, tone:str, trend:str, order:int
- **AiTask** → `ai_tasks` (seed 7)
  - fields: title:str, due:str, priority:str, icon:str, done:bool, order:int
- **AiAgent** → `ai_agents` (seed 4)
  - fields: name:str, icon:str, tone:str, metric:str, label:str, rate:str, last_active:str, status:str, order:int
- **AiInsight** → `ai_insights` (seed 4)
  - fields: title:str, description:str, action:str, icon:str, tone:str, order:int
- **AiAction** → `ai_actions` (seed 6)
  - fields: title:str, description:str, icon:str, tone:str, order:int
- **AiActivity** → `ai_activities` (seed 5)
  - fields: time:str, text:str, status:str, icon:str, tone:str, order:int
- **AiMemoryStat** → `ai_memory_stats` (seed 4)
  - fields: label:str, value:str, sub:str, icon:str, tone:str, order:int
- **AiPrompt** → `ai_prompts` (seed 10)
  - fields: text:str, kind:str, order:int
  - endpoints:
    - `GET /ai/priorities (list, 4 greeting 'today's priorities', ordered by `order`)`
    - `GET /ai/health/metrics (list, 5 Business Health Score components, ordered)`
    - `GET /ai/health/stats (overall gauge -> {overall:92, rating:'Excellent', color:'#22c55e', center_label:'/100', note:'Your platform is performing excellent! Keep up the great work.'}; overall computed as rounded mean of the 5 metric values = round(91.6) = 92)`
    - `GET /ai/tasks?priority=high|medium (list, 7 AI Tasks Center tasks; filter feeds the High/Medium tabs)`
    - `GET /ai/tasks/stats (tab-badge counts -> {high:4, medium:3, total:7})`
    - `PATCH /ai/tasks/{id} (toggle done -> {done:true}; UI strikes through completed tasks)`
    - `GET /ai/agents (list, 4 AI Workforce agents, ordered)`
    - `GET /ai/agents/{id} (single agent for the agent-detail modal: metric, rate, last_active, status)`
    - `GET /ai/insights (list, 4 AI Insights with per-item action label)`
    - `GET /ai/actions (list, 6 One Click AI Actions tiles)`
    - `GET /ai/activities?status=Success|Alert (list, 5 AI Command Timeline events, newest first / by order)`
    - `GET /ai/memory/stats (list, 4 AI Memory & Knowledge stat tiles)`
    - `GET /ai/prompts?kind=suggestion|voice (list, 6 Ask-AI suggestion chips + 4 Voice-assistant chips)`
    - `POST /ai/chat ({question} -> {reply}) OPTIONAL — returns the canned reply ('Here's what I found for "<q>"...'); chat is currently a pure client-side simulation with no persistence`
    - `GET /ai/report (CSV export) OPTIONAL — 'Generate Report' one-click currently builds a CSV of health metrics ([label, value%]) client-side named ai-business-report.csv`

## notifications
- **Notification** → `notifications` (seed 12)
  - fields: id:str, type:str, title:str, desc:str, time:str, group:str, unread:bool
- **NotificationChannel** → `notification_channels` (seed 4)
  - fields: label:str, icon:str, on:bool
  - endpoints:
    - `GET /notifications?tab=&type=&group=&q=&unread=&page=&page_size= (list feed; tab in [all,unread,appointment,message,system]; system tab = type in [system,alert]; q searches title+desc; returns rows still grouped-orderable by group)`
    - `GET /notifications/grouped?tab=&q= (optional convenience: returns rows already bucketed into Today/Yesterday/Earlier sections, empty sections omitted, in GROUP_ORDER)`
    - `GET /notifications/stats (returns the 5 stat cards + By-Category donut: total=1284, unread=live count, today=12, mentions=8, alerts=2, categories=[{name,value,color}])`
    - `PATCH /notifications/{id}/read (mark single notification as read -> unread=false)`
    - `POST /notifications/read-all (mark every notification read; returns updated_count)`
    - `DELETE /notifications/{id} (dismiss/remove one notification)`
    - `DELETE /notifications (clear all -> empty feed)`
    - `GET /notifications/channels (delivery-channel toggles for the right rail: Email/Push/SMS/In-App on/off)`

## settings-billing
- **BillingAccount** → `billing_account` (seed 1)
  - fields: _id:str, plan:str, plan_price:str, plan_description:str, status:str, billing_cycle:str, next_billing_date:str, usage_reset_date:str, auto_pay:bool, card:dict, card.brand:str, card.last4:str, card.expiry:str, card.is_primary:bool, billing_info:dict, billing_info.company:str, billing_info.email:str, billing_info.gstin:str, billing_info.address:str, features:list[dict, usage:list[dict, usage[].label:str, usage[].value:str, usage[].pct:int
- **Plan** → `plans` (seed 3)
  - fields: name:str, price:str, description:str, billing_cycle:str, order:int
- **Invoice** → `invoices` (seed 5)
  - fields: invoice_number:str, date:str, period:str, description:str, plan:str, amount:str, status:str
  - endpoints:
    - `GET /billing/account (returns the singleton BillingAccount: current plan, status, next_billing_date, card, auto_pay, billing_info, features, usage, summary)`
    - `PUT /billing/account/plan (change plan; body {plan_name}; sets plan/plan_price/plan_description from Plan catalog, status back to Active)`
    - `POST /billing/account/cancel (cancel subscription; sets status=Cancelled and auto_pay=false)`
    - `PUT /billing/account/payment (update/add card; body {name?, number, expiry, cvc?, brand}; stores brand + last4 of number + expiry)`
    - `PATCH /billing/account/autopay (toggle auto-pay; body {auto_pay:bool})`
    - `GET /billing/account/billing-info (billing information for modal)`
    - `PUT /billing/account/billing-info (update billing info; body {company(req), email(req), gstin, address})`
    - `GET /billing/account/usage (usage overview list + usage_reset_date for the Usage card / Plan Details modal)`
    - `GET /billing/account/summary (Billing Summary: plan, billing_cycle, subtotal, tax_percent, taxes, total, currency)`
    - `GET /billing/plans (list 3 available plans for Change Plan modal; each with name, price, description, current flag)`
    - `GET /billing/invoices?page=&page_size= (Billing History table + 'View All Invoices' pagination, newest first)`
    - `GET /billing/invoices/{invoice_number} (single invoice detail for View)`
    - `GET /billing/invoices/{invoice_number}/download (download invoice as CSV: Invoice, Date, Description, Plan Period, Amount, Status)`

## settings-sessions-logs
- **Session** → `sessions` (seed 7)
  - fields: device_type:str, device:str, details:str, location:str, ip:str, status:str, is_current:bool, tag:str|null, location_note:str|null, last_active:str|null, last_active_at:str|null, login_time:str|null, logout_time:str|null
- **SystemLog** → `system_logs` (seed 10)
  - fields: time:str, level:str, source:str, message:str, user:str, ip:str
  - endpoints:
    - `GET /sessions/active?q= (list active sessions; q searches device, details, location, ip)`
    - `GET /sessions/history?q=&range= (list signed_out sessions; q searches device/details/location/ip; range=Last 7 Days|Last 30 Days|Last 90 Days|All Time, default Last 30 Days)`
    - `GET /sessions/stats (Active Sessions count, Trusted Devices count, Last Active label+timestamp from current session, Security Status='Secure')`
    - `POST /sessions/{id}/signout (sign out a single non-current active session; 400/403 if is_current)`
    - `POST /sessions/revoke-all (revoke all active sessions where is_current=false; returns revoked count)`
    - `POST /sessions/secure-account (body: new_password; revokes all other active sessions then confirms — returns 'Account secured')`
    - `GET /sessions/history/export (CSV: Device, Details, Location, IP Address, Login Time, Logout Time, Status)`
    - `GET /logs?q=&level=&source=&range=&page=&page_size= (filter+search+paginate; level=All Levels|Info|Success|Warning|Error; source=All Sources|<distinct>; range=Last 7 Days|Last 24 Hours|Last 30 Days|All Time, default Last 7 Days)`
    - `GET /logs/sources (distinct source list, prefixed with 'All Sources' for the dropdown)`
    - `GET /logs/stats (Total Logs=18,492; Errors=42; Warnings=128; Info=3,204; level_distribution donut [Info 82, Success 12, Warning 5, Error 1] + center Total 18,492; recent_errors list)`
    - `GET /logs/{id} (single log detail for the modal)`
    - `GET /logs/export?q=&level=&source=&range= (CSV: Timestamp, Level, Source, Message, User, IP)`

## settings-integrations-roles
- **Integration** → `integrations` (seed 8)
  - fields: name:str, icon:str, tone:str, category:str, catTone:str, desc:str, status:str, synced:str, notifications:bool, autoSync:bool, connectedAt:str|null
- **Role** → `roles` (seed 8)
  - fields: id:int, icon:str, name:str, desc:str, users:int, type:str, perms:int, status:str, createdAt:str
- **PermissionGroup** → `permission_groups` (seed 10)
  - fields: name:str, count:str, total:int, order:int
- **IntegrationRequest** → `integration_requests` (seed 0)
  - fields: service:str, category:str, details:str, createdAt:datetime
- **WebhookConfig** → `webhook_config` (seed 1)
  - fields: url:str, signingSecret:str
  - endpoints:
    - `GET /integrations?tab=&status=&category=&q=&page= — list; tab in [All Integrations|Active(=Connected)|Inactive|Available(=Not Connected)], status in [All Status|Connected|Inactive|Not Connected], category filter, q searches name/desc/category`
    - `GET /integrations/stats — { totalIntegrations, activeIntegrations (Connected count), availableIntegrations: 32 (static), syncStatus: 'All Good', lastChecked: '5 mins ago' }`
    - `GET /integrations/overview — donut data: [{name:'Connected',value,color:'#22c55e',pct},{name:'Inactive',value,color:'#f59e0b',pct},{name:'Not Connected',value,color:'#cbd5e1',pct}] + total`
    - `GET /integrations/categories — distinct category values for the category filter menu (prepend 'All Categories')`
    - `GET /integrations/recent?limit=3 — 'Recently Connected' list (integrations with connectedAt, newest first: name, icon, tone, when)`
    - `POST /integrations/{name}/connect — set status=Connected, synced='Last synced: just now'`
    - `POST /integrations/{name}/disconnect — Connected→Inactive; Inactive→Not Connected; clears notifications/autoSync when not Connected`
    - `POST /integrations/{name}/sync — set synced='Last synced: just now'`
    - `PATCH /integrations/{name} — update notifications, autoSync (Manage modal toggles)`
    - `DELETE /integrations/{name} — remove an Inactive integration`
    - `GET /integrations/webhook — { url, signingSecret }`
    - `PUT /integrations/webhook — update url (required)`
    - `POST /integration-requests — body { service (required), category, details }`
    - `GET /roles?type=&q=&page= — list; type in [All Types|System|Custom], q searches name/desc; UI paginates (showing 1..N of N)`
    - `GET /roles/stats — { totalRoles, activeRoles (status=Active count), usersAssigned (sum users), permissions: 126 (static), customRoles (type=Custom count), newThisMonth: 2 }`
    - `GET /roles/{id} — role details + permission groups for the detail panel`
    - `POST /roles — create; body { name (required), desc, type (default Custom), status (default Active) }; server sets icon=ShieldCheck, users=0, perms=0`
    - `PATCH /roles/{id} — edit name/desc/type/status`
    - `POST /roles/{id}/duplicate — clone as '{name} (Copy)', type=Custom, users=0`
    - `DELETE /roles/{id} — delete role (confirm shows assigned-user count)`
    - `GET /permission-groups — the 10 permission groups (name + count) for the Role Details permissions list`
