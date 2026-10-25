from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.core.usernames import name_locked
from app.db.mongodb import get_database
from app.models.user import UserModel
from app.schemas.auth import UpdateProfileRequest, UserResponse

router = APIRouter(prefix="/users", tags=["Account"])


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**UserModel.to_response(current_user))


@router.put("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_database()
    update_fields: dict = {"updated_at": datetime.now(timezone.utc)}

    if payload.full_name is not None and payload.full_name != (current_user.get("full_name") or ""):
        # Same lock as PATCH /me/profile: a verified member's name is the one on her ID.
        if name_locked(current_user):
            raise HTTPException(status.HTTP_409_CONFLICT, {
                "code": "name_locked",
                "message": "Your verified name can only be changed by WomSakhi. You can change your username instead.",
            })
        update_fields["full_name"] = payload.full_name

    if payload.locale is not None:
        update_fields["locale"] = payload.locale

    updated = await db[UserModel.collection_name].find_one_and_update(
        {"_id": current_user["_id"]},
        {"$set": update_fields},
        return_document=True,
    )
    return UserResponse(**UserModel.to_response(updated))


# There is no password to change: every sign-in is a one-time code (see
# routes/auth.py). `/users/me/change-password` was removed with passwords.
