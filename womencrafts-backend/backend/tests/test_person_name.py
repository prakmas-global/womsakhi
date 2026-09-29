"""Her name, in any script — letters with spaces, dots, apostrophes and hyphens."""
import pytest

from app.routes.auth import clean_person_name


@pytest.mark.parametrize("raw,clean", [
    ("  lakshmi   devi ", "lakshmi devi"),
    ("లక్ష్మి దేవి", "లక్ష్మి దేవి"),
    ("प्रिया शर्मा", "प्रिया शर्मा"),
    ("D'Souza-Rao", "D'Souza-Rao"),
    ("Dr. K. Rao", "Dr. K. Rao"),
])
def test_real_names_pass(raw, clean):
    assert clean_person_name(raw) == clean


@pytest.mark.parametrize("raw", ["", "A", "Priya123", "http://x.com", "<script>", "-Priya", "x" * 81])
def test_anything_else_is_refused(raw):
    with pytest.raises(ValueError):
        clean_person_name(raw)
