"""Uploaded media must not be manageable by another member."""

import asyncio
from unittest.mock import AsyncMock

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.routes import uploads


@pytest.mark.parametrize("role", [None, "Member", "Content Manager", "Admin"])
def test_upload_scope_is_owner_only_without_explicit_super_admin(role):
    assert uploads._ownership_scope({"_id": "owner", "role": role}) == {"uploaded_by": "owner"}


def test_explicit_super_admin_can_manage_library():
    assert uploads._ownership_scope({"_id": "admin", "role": "Super Admin"}) == {}


def test_deletion_looks_up_ownership_before_touching_files(monkeypatch):
    collection = AsyncMock()
    collection.find_one.return_value = None
    monkeypatch.setattr(uploads, "_uploads", lambda: collection)
    upload_id = ObjectId()
    with pytest.raises(HTTPException) as error:
        asyncio.run(uploads.delete_upload(str(upload_id), {"_id": "member", "role": "Member"}))
    assert error.value.status_code == 404
    collection.find_one.assert_awaited_once_with({"_id": upload_id, "uploaded_by": "member"})
    collection.delete_one.assert_not_awaited()


@pytest.mark.parametrize("field", ["store.logo", "store.cover", "store.gallery"])
def test_store_pictures_cannot_be_deleted_while_in_use(monkeypatch, field):
    from types import SimpleNamespace

    upload_id = ObjectId()
    url = "media/cover/store-photo.webp"
    collection = AsyncMock()
    collection.find_one.return_value = {"_id": upload_id, "url": url}
    monkeypatch.setattr(uploads, "_uploads", lambda: collection)

    class Database:
        def __getitem__(self, name):
            async def count(query, **_):
                return int(name == "users" and query == {field: url})
            return SimpleNamespace(count_documents=count)

    monkeypatch.setattr(uploads, "get_database", lambda: Database())
    with pytest.raises(HTTPException) as error:
        asyncio.run(uploads.delete_upload(str(upload_id), {"_id": "member", "role": "Member"}))
    assert error.value.status_code == 409
    collection.delete_one.assert_not_awaited()
