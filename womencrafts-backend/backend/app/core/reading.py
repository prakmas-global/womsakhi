"""Stable lesson identities and content revisions for private reading bookmarks."""
import hashlib


def lesson_key(lesson: dict) -> str:
    return lesson.get('id') or hashlib.sha256((lesson.get('title','')+'\n'+lesson.get('body','')).encode()).hexdigest()[:32]


def content_revision(lesson: dict) -> str:
    return hashlib.sha256(lesson.get('body','').encode()).hexdigest()
