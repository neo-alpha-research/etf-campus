#!/usr/bin/env python3
"""Compatibility entry point for issuer-notice distribution candidate normalization.

The implementation lives in build_distribution_candidates.py.  This file keeps
future operational commands under the planned normalize_distribution_events.py
name while preserving the candidate/evidence/TR safety boundary.
"""

from build_distribution_candidates import main


if __name__ == "__main__":
    raise SystemExit(main())
