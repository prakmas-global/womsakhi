from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core import mongosafe
from app.core.deps import get_current_user
from app.core.permissions import (
    CATALOGUE,
    modules_from_permissions,
    normalise,
    permissions_for_modules,
    summarise,
    total_count,
)
from app.core.rbac import ALL_MODULES, SUPER_ADMIN, require_super_admin
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.role import RoleModel
from app.schemas.role import (
    PermissionGroup,
    RoleCreate,
    RoleListResponse,
    RoleModulesUpdate,
    RolePermissions,
    RolePermissionsUpdate,
    RoleResponse,
    RoleUpdate,
)

router = APIRouter(prefix="/roles", tags=["Users"])


def _roles():
    return get_database()[RoleModel.collection_name]


@router.get("", response_model=RoleListResponse, summary="List roles")
async def list_roles(
    q: Optional[str] = Query(None, description="Search by role name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    _: dict = Depends(get_current_user),
):
    query: dict = {}
    if status and status not in ("all", "All"):
        query["status"] = status
    if q and q.strip():
        query["name"] = mongosafe.contains(q)

    # _id ascending preserves creation order (matches the UI ordering).
    items = [RoleModel.to_response(doc) async for doc in _roles().find(query).sort("_id", 1)]
    return RoleListResponse(items=items, total=len(items))


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED, summary="Create a role")
async def create_role(payload: RoleCreate, _: dict = Depends(require_super_admin)):
    if await _roles().find_one({"name": payload.name.strip()}):
        raise HTTPException(status.HTTP_409_CONFLICT, "A role with this name already exists")
    doc = RoleModel.create_document(**payload.model_dump())
    result = await _roles().insert_one(doc)
    doc["_id"] = result.inserted_id
    return RoleResponse(**RoleModel.to_response(doc))


@router.get("/{role_id}", response_model=RoleResponse, summary="Get a role")
async def get_role(role_id: str, _: dict = Depends(get_current_user)):
    doc = await _roles().find_one({"_id": to_object_id(role_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return RoleResponse(**RoleModel.to_response(doc))


@router.put("/{role_id}/modules", response_model=RoleResponse, summary="Set a role's module access (Super Admin only)")
async def set_role_modules(
    role_id: str,
    payload: RoleModulesUpdate,
    _: dict = Depends(require_super_admin),
):
    oid = to_object_id(role_id)
    modules = [m for m in payload.modules if m in ALL_MODULES]
    if "dashboard" not in modules:
        modules = ["dashboard"] + modules
    doc = await _roles().find_one_and_update(
        {"_id": oid},
        {"$set": {"modules": modules, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return RoleResponse(**RoleModel.to_response(doc))


@router.patch("/{role_id}", response_model=RoleResponse, summary="Update a role")
async def update_role(role_id: str, payload: RoleUpdate, _: dict = Depends(require_super_admin)):
    oid = to_object_id(role_id)
    updates = payload.model_dump(exclude_unset=True)
    updates["updated_at"] = datetime.now(timezone.utc)
    doc = await _roles().find_one_and_update(
        {"_id": oid},
        {"$set": updates},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return RoleResponse(**RoleModel.to_response(doc))


@router.delete("/{role_id}", summary="Delete a role")
async def delete_role(role_id: str, _: dict = Depends(require_super_admin)):
    result = await _roles().delete_one({"_id": to_object_id(role_id)})
    if result.deleted_count == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return {"message": "Role deleted"}


# --- granular permissions ----------------------------------------------------

def _stored_permissions(doc: dict) -> list[str]:
    """
    A role's permission list, or a sensible set derived from its module access
    for roles created before granular permissions existed.
    """
    if doc.get("name") == SUPER_ADMIN:
        from app.core.permissions import all_permissions

        return all_permissions()
    stored = doc.get("permissions")
    if isinstance(stored, list) and stored:
        return normalise(stored)
    return permissions_for_modules(doc.get("modules") or [])


@router.get("/catalogue/all", summary="Every permission the platform defines")
async def permission_catalogue(_: dict = Depends(get_current_user)):
    return {
        "modules": [
            {"module": mod, "label": label, "actions": actions}
            for mod, (label, actions) in CATALOGUE.items()
        ],
        "total": total_count(),
    }


@router.get("/me/permissions", summary="What the signed-in account may do")
async def my_permissions(me: dict = Depends(get_current_user)):
    from app.core.permissions import user_permissions

    held = await user_permissions(me)
    return {"permissions": held, "granted": len(held), "total": total_count()}


@router.get(
    "/{role_id}/permissions",
    response_model=RolePermissions,
    summary="A role's granular permissions",
)
async def get_role_permissions(role_id: str, _: dict = Depends(get_current_user)):
    doc = await _roles().find_one({"_id": to_object_id(role_id)})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")

    held = _stored_permissions(doc)
    return RolePermissions(
        role_id=str(doc["_id"]),
        role_name=doc.get("name", ""),
        is_super_admin=doc.get("name") == SUPER_ADMIN,
        granted=len(held),
        total=total_count(),
        groups=[PermissionGroup(**g) for g in summarise(held)],
    )


@router.put(
    "/{role_id}/permissions",
    response_model=RolePermissions,
    summary="Set a role's granular permissions (Super Admin only)",
)
async def set_role_permissions(
    role_id: str,
    payload: RolePermissionsUpdate,
    _: dict = Depends(require_super_admin),
):
    oid = to_object_id(role_id)
    doc = await _roles().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    if doc.get("name") == SUPER_ADMIN:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Super Admin always has every permission — it cannot be reduced.",
        )

    # normalise() drops unknown keys and adds the implied view permissions, so
    # what lands in the database is always a shape the checks can rely on.
    granted = normalise(payload.permissions)
    modules = modules_from_permissions(granted)

    fresh = await _roles().find_one_and_update(
        {"_id": oid},
        {
            "$set": {
                "permissions": granted,
                # kept in step deliberately: module access is derived from the
                # permissions, so the two can never contradict each other
                "modules": modules,
                "perms": len(granted),
                "updated_at": datetime.now(timezone.utc),
            }
        },
        return_document=True,
    )
    held = _stored_permissions(fresh)
    return RolePermissions(
        role_id=str(fresh["_id"]),
        role_name=fresh.get("name", ""),
        is_super_admin=False,
        granted=len(held),
        total=total_count(),
        groups=[PermissionGroup(**g) for g in summarise(held)],
    )


