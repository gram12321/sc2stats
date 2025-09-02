from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from .lpdb_client import LpdbClient, LpdbQuery
from .config import load_liquipedia_config


EVENT_SLUG = "UThermal_2v2_Circuit/Main_Event"
OUTPUT_DIR = Path("output/raw/")


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_all(event_slug: str = EVENT_SLUG) -> Dict[str, List[Dict[str, Any]]]:
    cfg = load_liquipedia_config()
    client = LpdbClient(user_agent=cfg.user_agent, username=cfg.username, api_key=cfg.api_key)

    match2 = client.paged_lpdb(
        LpdbQuery(
            table="match2",
            conditions=f"[[pagename::{event_slug}]]",
            limit=500,
        )
    )

    match2opponent = client.paged_lpdb(
        LpdbQuery(
            table="match2opponent",
            conditions=f"[[pagename::{event_slug}]]",
            order="matchid asc",
            limit=500,
        )
    )

    match2game = client.paged_lpdb(
        LpdbQuery(
            table="match2game",
            conditions=f"[[pagename::{event_slug}]]",
            order="matchid, game asc",
            limit=500,
        )
    )

    return {
        "match2": match2,
        "match2opponent": match2opponent,
        "match2game": match2game,
    }


def write_raw(data: Dict[str, List[Dict[str, Any]]]) -> None:
    ensure_output_dir()
    for key, rows in data.items():
        path = OUTPUT_DIR / f"{key}.json"
        with path.open("w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)


def main() -> None:
    data = fetch_all(EVENT_SLUG)
    write_raw(data)


if __name__ == "__main__":
    main()

