from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.db.mongodb import get_database
from app.models.user import UserModel
from app.schemas.auth import ChangePasswordRequest, UpdateProfileRequest, UserResponse

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

    if payload.full_name is not None:
        update_fields["full_name"] = payload.full_name

    if payload.locale is not None:
        update_fields["locale"] = payload.locale

    updated = await db[UserModel.collection_name].find_one_and_update(
        {"_id": current_user["_id"]},
        {"$set": update_fields},
        return_document=True,
    )
    return UserResponse(**UserModel.to_response(updated))


@router.put("/me/change-password", status_code=status.HTTP_200_OK)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password",
        )

    db = get_database()
    await db[UserModel.collection_name].update_one(
        {"_id": current_user["_id"]},
        {"$set": {
            "hashed_password": hash_password(payload.new_password),
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return {"message": "Password updated successfully"}
