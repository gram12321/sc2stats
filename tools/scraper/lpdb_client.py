from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


LIQUIPEDIA_API_URL = "https://liquipedia.net/starcraft2/api.php"


class LiquipediaApiError(Exception):
    pass


@dataclass
class LpdbQuery:
    table: str
    conditions: str
    order: Optional[str] = None
    limit: int = 500
    offset: int = 0


class LpdbClient:
    def __init__(self, user_agent: str, username: str | None = None, api_key: str | None = None) -> None:
        self.session = requests.Session()
        # Liquipedia requires a descriptive user agent
        self.session.headers.update({"User-Agent": user_agent})
        # If provided, set LP API authentication headers (recommended)
        if username and api_key:
            self.session.headers.update({
                "X-Liquipedia-Username": username,
                "X-Liquipedia-Api-Key": api_key,
            })

    @retry(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((requests.RequestException, LiquipediaApiError)),
    )
    def lpdb(self, query: LpdbQuery) -> Dict[str, Any]:
        params: Dict[str, Any] = {
            "action": "lpdb",
            "format": "json",
            "table": query.table,
            "conditions": query.conditions,
            "limit": query.limit,
            "offset": query.offset,
        }
        if query.order:
            params["order"] = query.order

        response = self.session.get(LIQUIPEDIA_API_URL, params=params, timeout=30)
        if response.status_code == 429:
            # Back off more if rate limited
            time.sleep(5)
            raise LiquipediaApiError("Rate limited by Liquipedia (429)")

        response.raise_for_status()
        data = response.json()
        if "error" in data:
            raise LiquipediaApiError(str(data["error"]))
        return data

    def paged_lpdb(self, base: LpdbQuery) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        offset = base.offset
        while True:
            page = self.lpdb(LpdbQuery(
                table=base.table,
                conditions=base.conditions,
                order=base.order,
                limit=base.limit,
                offset=offset,
            ))
            rows = page.get("result", [])
            if not rows:
                break
            results.extend(rows)
            if len(rows) < base.limit:
                break
            offset += base.limit
        return results

