"""Seed synthetic geographic enrichment for every account in transactions.

This simulates a KYC enrichment database. In production, this data would
come from a real KYC service or IP geolocation. The assignment is
deterministic (hash-based) so the same account always gets the same
country, making the demo stable across reseeds.

The country distribution is weighted toward real fraud-relevant geographies.
US accounts also get a US state assignment for the US choropleth view.

Idempotent: skips accounts already enriched.

Usage:
    uv run python -m scripts.seed_geo
"""

from __future__ import annotations

import hashlib
import logging
import random

from sqlalchemy.orm import Session

from api.db.database import SessionLocal
from api.db.models import AccountGeo, Tenant, Transaction

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEMO_TENANT_SLUG = "demo-bank-01"

# Weighted country list (weight, ISO3, name, capital lat/lon for jitter base)
# Tuned to look like a real global bank's customer base + fraud-relevant geos.
COUNTRIES: list[tuple[int, str, str, float, float]] = [
    (40, "USA", "United States", 39.8, -98.6),
    (12, "GBR", "United Kingdom", 54.0, -2.0),
    (10, "IND", "India", 20.6, 78.96),
    (8, "BRA", "Brazil", -14.2, -51.9),
    (6, "DEU", "Germany", 51.2, 10.4),
    (5, "NGA", "Nigeria", 9.1, 8.7),
    (4, "MEX", "Mexico", 23.6, -102.5),
    (4, "FRA", "France", 46.2, 2.2),
    (3, "ZAF", "South Africa", -30.6, 22.9),
    (3, "CAN", "Canada", 56.1, -106.3),
    (2, "JPN", "Japan", 36.2, 138.2),
    (2, "AUS", "Australia", -25.3, 133.8),
    (2, "RUS", "Russia", 61.5, 105.3),
    (2, "CHN", "China", 35.9, 104.2),
    (2, "IDN", "Indonesia", -0.8, 113.9),
    (2, "TUR", "Turkey", 38.9, 35.2),
    (1, "ARG", "Argentina", -38.4, -63.6),
    (1, "ESP", "Spain", 40.5, -3.7),
    (1, "ITA", "Italy", 41.9, 12.6),
    (1, "PHL", "Philippines", 12.9, 121.8),
    (1, "VNM", "Vietnam", 14.1, 108.3),
    (1, "POL", "Poland", 51.9, 19.1),
    (1, "EGY", "Egypt", 26.8, 30.8),
    (1, "KEN", "Kenya", -0.0, 37.9),
    (1, "KOR", "South Korea", 35.9, 127.8),
]

US_STATES: list[tuple[str, str, float, float]] = [
    ("CA", "California", 36.78, -119.42),
    ("TX", "Texas", 31.97, -99.90),
    ("FL", "Florida", 27.66, -81.52),
    ("NY", "New York", 40.71, -74.01),
    ("PA", "Pennsylvania", 41.20, -77.19),
    ("IL", "Illinois", 40.63, -89.40),
    ("OH", "Ohio", 40.42, -82.91),
    ("GA", "Georgia", 32.16, -82.91),
    ("NC", "North Carolina", 35.76, -79.02),
    ("MI", "Michigan", 44.31, -85.60),
    ("NJ", "New Jersey", 40.06, -74.41),
    ("VA", "Virginia", 37.43, -78.66),
    ("WA", "Washington", 47.75, -120.74),
    ("AZ", "Arizona", 34.05, -111.09),
    ("MA", "Massachusetts", 42.41, -71.38),
    ("TN", "Tennessee", 35.52, -86.58),
    ("IN", "Indiana", 40.27, -86.13),
    ("MO", "Missouri", 37.96, -91.83),
    ("MD", "Maryland", 39.05, -76.64),
    ("WI", "Wisconsin", 43.78, -88.79),
    ("CO", "Colorado", 39.55, -105.78),
    ("MN", "Minnesota", 46.39, -94.64),
    ("SC", "South Carolina", 33.84, -81.16),
    ("AL", "Alabama", 32.32, -86.90),
    ("LA", "Louisiana", 30.98, -91.96),
    ("KY", "Kentucky", 37.84, -84.27),
    ("OR", "Oregon", 43.80, -120.55),
    ("OK", "Oklahoma", 35.46, -97.51),
    ("CT", "Connecticut", 41.60, -73.09),
    ("UT", "Utah", 39.32, -111.09),
    ("NV", "Nevada", 38.80, -116.42),
    ("AR", "Arkansas", 34.97, -92.37),
    ("MS", "Mississippi", 32.74, -89.67),
    ("KS", "Kansas", 39.01, -98.48),
    ("NM", "New Mexico", 34.52, -105.87),
    ("NE", "Nebraska", 41.49, -99.90),
    ("WV", "West Virginia", 38.60, -80.45),
    ("ID", "Idaho", 44.07, -114.74),
    ("HI", "Hawaii", 20.79, -156.33),
    ("NH", "New Hampshire", 43.19, -71.57),
    ("ME", "Maine", 45.25, -69.44),
    ("MT", "Montana", 46.88, -110.36),
    ("RI", "Rhode Island", 41.58, -71.47),
    ("DE", "Delaware", 38.91, -75.52),
    ("SD", "South Dakota", 43.97, -99.90),
    ("ND", "North Dakota", 47.55, -101.00),
    ("AK", "Alaska", 64.20, -149.49),
    ("VT", "Vermont", 44.06, -72.71),
    ("WY", "Wyoming", 43.07, -107.29),
]


def _hash_int(s: str, salt: str = "") -> int:
    """Deterministic positive int hash from a string."""
    return int(hashlib.sha256((s + salt).encode()).hexdigest(), 16)


def _pick_country(account_id: str) -> tuple[str, str, float, float]:
    """Hash account ID, then pick a country by weight."""
    weights = [c[0] for c in COUNTRIES]
    total = sum(weights)
    seed = _hash_int(account_id, "country") % total
    cumulative = 0
    for weight, iso3, name, lat, lon in COUNTRIES:
        cumulative += weight
        if seed < cumulative:
            return iso3, name, lat, lon
    fallback = COUNTRIES[-1]
    return fallback[1], fallback[2], fallback[3], fallback[4]


def _pick_us_state(account_id: str) -> tuple[str, float, float]:
    weights = [50 - i for i in range(len(US_STATES))]  # Cali ranked higher
    total = sum(weights)
    seed = _hash_int(account_id, "state") % total
    cumulative = 0
    for i, weight in enumerate(weights):
        cumulative += weight
        if seed < cumulative:
            abbr, _name, lat, lon = US_STATES[i]
            return abbr, lat, lon
    abbr, _name, lat, lon = US_STATES[0]
    return abbr, lat, lon


def _jitter(account_id: str, lat: float, lon: float) -> tuple[float, float]:
    """Add small deterministic jitter so points don't all stack on capitals."""
    rng = random.Random(_hash_int(account_id, "jitter"))
    return lat + rng.uniform(-3.0, 3.0), lon + rng.uniform(-3.0, 3.0)


def seed(db: Session) -> None:
    tenant = db.query(Tenant).filter(Tenant.slug == DEMO_TENANT_SLUG).one_or_none()
    if tenant is None:
        raise RuntimeError("Demo tenant not found. Run 'make seed' first.")

    # Collect every unique account_id used as sender or receiver
    sender_ids = {r[0] for r in db.query(Transaction.name_orig).filter(Transaction.tenant_id == tenant.id).distinct()}
    receiver_ids = {r[0] for r in db.query(Transaction.name_dest).filter(Transaction.tenant_id == tenant.id).distinct()}
    all_ids = sender_ids | receiver_ids
    log.info("Found %d unique accounts across senders + receivers", len(all_ids))

    # Skip ones we already have
    existing = {r[0] for r in db.query(AccountGeo.account_id).filter(AccountGeo.tenant_id == tenant.id)}
    to_enrich = all_ids - existing
    log.info("Enriching %d new accounts (%d already exist)", len(to_enrich), len(existing))

    for i, account_id in enumerate(sorted(to_enrich), 1):
        iso3, country_name, base_lat, base_lon = _pick_country(account_id)
        region: str | None = None
        if iso3 == "USA":
            region, base_lat, base_lon = _pick_us_state(account_id)
        lat, lon = _jitter(account_id, base_lat, base_lon)

        db.add(
            AccountGeo(
                tenant_id=tenant.id,
                account_id=account_id,
                country=iso3,
                country_name=country_name,
                region=region,
                city=None,
                latitude=lat,
                longitude=lon,
            )
        )

        if i % 500 == 0:
            db.flush()
            log.info("  %d / %d enriched", i, len(to_enrich))

    db.commit()
    log.info("Geo enrichment complete: %d accounts enriched", len(to_enrich))


def main() -> None:
    db = SessionLocal()
    try:
        seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()