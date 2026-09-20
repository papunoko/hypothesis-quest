"""Verify every card with a fresh CPython cache; no third-party dependencies."""
import functools
import json
import platform

cases = [
    ("L1", [((1,), {}), ((1,), {})], False, "remembered"),
    ("L2", [((1,), {}), ((1, 0), {})], False, "computed"),
    ("L3", [((1,), {}), ((), {"x": 1})], False, "computed"),
    ("L4", [((), {"x": 5, "y": 6}), ((), {"y": 6, "x": 5})], False, "computed"),
    ("L5", [((1,), {}), ((1.0,), {})], False, "computed"),
    ("L6", [((1, 2), {}), ((1.0, 2), {})], False, "remembered"),
    ("L7", [((1, 2), {}), ((1.0, 2), {})], True, "computed"),
    ("L8", [(([1],), {})], False, "error"),
    ("H1", [((1.0,), {}), ((True,), {})], False, "remembered"),
]

results = []
for case_id, seq, typed, expected in cases:
    calls = []

    @functools.lru_cache(maxsize=None, typed=typed)
    def f(x, y=0):
        calls.append((x, y))
        return x + y

    for args, kwargs in seq:
        before = len(calls)
        try:
            f(*args, **kwargs)
            outcome = "computed" if len(calls) > before else "remembered"
        except TypeError:
            outcome = "error"
    assert outcome == expected, (case_id, outcome, expected)
    results.append({"id": case_id, "outcome": outcome, "bodyCalls": len(calls)})

print(json.dumps({"python": platform.python_version(), "results": results}, ensure_ascii=False))
