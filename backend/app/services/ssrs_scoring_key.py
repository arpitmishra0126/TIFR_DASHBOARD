"""SSRS domain scoring key - PENDING.

The three SSRS REDCap forms (Parent/Child/Teacher) have no `calc` fields
and the Data Dictionary defines no item-to-domain mapping anywhere - there
is no REDCap-side scoring formula to read. Computing real domain scores
("Social Cooperation", "Self-Control", etc. - whatever domains the SSRS
instrument actually defines) requires the study team to supply:

  1. which items belong to which domain, and
  2. which items (if any) are reverse-scored before summing.

This file is the single place that mapping goes, once supplied, so the
"Domain scores and respondent agreement" panel on the /ssrs dashboard tab
activates automatically - no other file needs to change. Do NOT guess a
mapping or invent domain names; leave this empty until the real key is
confirmed.

Format, once populated:

    SSRS_DOMAIN_SCORING_KEY = {
        "parent": {
            "Social Cooperation": {"items": ["p1", "p4", ...], "reverse": ["p50"]},
            ...
        },
        "child": {...},
        "teacher": {...},
    }

`items` are item keys (e.g. "p1", matching `item_key` on the dashboard
API's item-response objects, i.e. the field name with its `_freq`/`_imp`
suffix stripped). `reverse` lists any of those same item keys whose coded
value should be inverted (e.g. 0<->2 on the 0-2 frequency scale) before
averaging into the domain total.
"""

SSRS_DOMAIN_SCORING_KEY: dict[str, dict[str, dict[str, list[str]]]] = {}
