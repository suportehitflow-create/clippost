import os
import stripe
from supabase import create_client
from services.db_utils import maybe_one

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

_SUPABASE_URL = (
    os.environ.get("SUPABASE_URL")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    or "https://alntulecjshpbrhesaoo.supabase.co"
)
_SUPABASE_KEY = (
    os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
)
try:
    _supabase = create_client(_SUPABASE_URL, _SUPABASE_KEY)
except Exception:
    _supabase = None

PRO_PRICE_ID = os.environ.get("STRIPE_PRO_PRICE_ID", "")
WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://clippost-three.vercel.app")


def create_checkout_session(user_id: str, email: str) -> str:
    session = stripe.checkout.Session.create(
        customer_email=email,
        line_items=[{"price": PRO_PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}/billing?success=1",
        cancel_url=f"{FRONTEND_URL}/billing?canceled=1",
        metadata={"user_id": user_id},
        subscription_data={"metadata": {"user_id": user_id}},
    )
    return session.url


def get_billing_portal_url(user_id: str) -> str | None:
    plan = maybe_one(_supabase.table("user_plans").select("stripe_customer_id").eq("user_id", user_id))
    if not plan.data or not plan.data.get("stripe_customer_id"):
        return None
    session = stripe.billing_portal.Session.create(
        customer=plan.data["stripe_customer_id"],
        return_url=f"{FRONTEND_URL}/billing",
    )
    return session.url


def handle_webhook(payload: bytes, sig_header: str) -> None:
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session["metadata"].get("user_id")
        customer_id = session["customer"]
        subscription_id = session["subscription"]
        if user_id:
            _upsert_plan(user_id, "pro", customer_id, subscription_id)

    elif event["type"] in ("customer.subscription.deleted", "customer.subscription.paused"):
        sub = event["data"]["object"]
        customer_id = sub["customer"]
        plan = maybe_one(_supabase.table("user_plans").select("user_id").eq("stripe_customer_id", customer_id))
        if plan.data:
            _upsert_plan(plan.data["user_id"], "free", customer_id, None)

    elif event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = sub["customer"]
        status = sub["status"]
        plan_row = maybe_one(_supabase.table("user_plans").select("user_id").eq("stripe_customer_id", customer_id))
        if plan_row.data:
            new_plan = "pro" if status == "active" else "free"
            _upsert_plan(plan_row.data["user_id"], new_plan, customer_id, sub["id"])


def _upsert_plan(user_id: str, plan: str, customer_id: str, subscription_id: str | None) -> None:
    existing = maybe_one(_supabase.table("user_plans").select("user_id").eq("user_id", user_id))
    data = {
        "user_id": user_id,
        "plan": plan,
        "stripe_customer_id": customer_id,
        "stripe_subscription_id": subscription_id,
        "updated_at": "now()",
    }
    if existing.data:
        _supabase.table("user_plans").update(data).eq("user_id", user_id).execute()
    else:
        _supabase.table("user_plans").insert(data).execute()


def get_plan_status(user_id: str) -> dict:
    plan = maybe_one(_supabase.table("user_plans").select("*").eq("user_id", user_id))
    if not plan.data:
        try:
            _supabase.table("user_plans").insert({"user_id": user_id}).execute()
        except Exception:
            pass  # FK violation ou user inexistente — continua como free
        return {"plan": "free", "clips_used": 0, "clips_limit": 3, "period_reset": None}
    d = plan.data
    limit = 999999 if d["plan"] == "pro" else 3
    return {
        "plan": d["plan"],
        "clips_used": d["clips_used_this_month"],
        "clips_limit": limit,
        "period_reset": d["period_reset"],
        "stripe_customer_id": d.get("stripe_customer_id"),
    }


def increment_clips_used(user_id: str) -> None:
    _supabase.rpc("increment_clips_used", {"p_user_id": user_id}).execute()


def check_clip_limit(user_id: str) -> None:
    status = get_plan_status(user_id)
    if status["plan"] == "free" and status["clips_used"] >= status["clips_limit"]:
        raise Exception("Limite de 3 clipes gratuitos atingido este mês. Faça upgrade para Pro.")
