"""
Лагодить профілі розповсюдження, коли Xcode не може зробити це сам.

КОЛИ ЦЕ ПОТРІБНО. Щойно в застосунку з'являється нова можливість
(Time Sensitive Notifications, App Groups, будь-що інше), Apple позначає
наявний профіль як INVALID, і експорт падає:

    error: exportArchive Provisioning profile "…" doesn't include the … capability
    error: exportArchive No profiles for 'app.dzvinka.schedule.watchkitapp' were found

Зазвичай це лагодить сам Xcode — але для цього потрібен ключ App Store
Connect із роллю Admin. У нашого роль App Manager: читати й керувати
профілями він може, а «хмарний підпис» — ні, і експорт зупиняється на
«Cloud signing permission error».

ЩО РОБИТЬ. Ходить в App Store Connect API прямо: знаходить зіпсовані
профілі, перевипускає їх і кладе у теку, звідки їх бере Xcode. Наявні
робочі профілі просто скачує — інколи їх просто немає локально.

ЯК ЗАПУСКАТИ. Потрібні pyjwt і cryptography, тож через uv, без
встановлення чогось у систему:

    ASC_KEY_ID=T8J5L874ZN \\
    ASC_ISSUER_ID=<uuid з адреси App Store Connect> \\
    uv run --with pyjwt --with cryptography python scripts/fix-profiles.py

Ключ .p8 шукається в ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8.
"""

import base64
import json
import os
import plistlib
import subprocess
import sys
import time
import urllib.error
import urllib.request

import jwt

KEY_ID = os.environ.get("ASC_KEY_ID") or sys.exit("Немає ASC_KEY_ID")
ISSUER = os.environ.get("ASC_ISSUER_ID") or sys.exit("Немає ASC_ISSUER_ID")
KEY_PATH = os.environ.get(
    "ASC_KEY_PATH", os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KEY_ID}.p8")
)

# Куди Xcode дивиться по профілі. Тека саме ця, а не стара
# ~/Library/MobileDevice/Provisioning Profiles — з Xcode 16 він читає її.
DEST = os.path.expanduser("~/Library/Developer/Xcode/UserData/Provisioning Profiles")

# Що має бути. Назви — ті самі, що в ios/ExportOptions.plist: підпис
# ручний, і розійтись їм не можна.
WANT = {
    "app.dzvinka.schedule": "Dzvinka App Store",
    "app.dzvinka.schedule.widget": "Dzvinka Widget App Store",
    "app.dzvinka.schedule.watchkitapp": "Dzvinka Watch App Store",
}

_token = jwt.encode(
    {
        "iss": ISSUER,
        "iat": int(time.time()),
        "exp": int(time.time()) + 1200,
        "aud": "appstoreconnect-v1",
    },
    open(KEY_PATH).read(),
    algorithm="ES256",
    headers={"kid": KEY_ID, "typ": "JWT"},
)


def api(path, method="GET", body=None):
    request = urllib.request.Request(
        "https://api.appstoreconnect.apple.com" + path,
        method=method,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {_token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, json.loads(response.read() or b"{}")
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read() or b"{}")


def install(profile):
    """Кладе профіль туди, звідки його бере Xcode. Ім'я файла — UUID."""
    status, full = api(f"/v1/profiles/{profile['id']}")
    raw = base64.b64decode(full["data"]["attributes"]["profileContent"])
    plist = subprocess.run(
        ["security", "cms", "-D", "-i", "/dev/stdin"], input=raw, capture_output=True
    ).stdout
    uuid = plistlib.loads(plist)["UUID"]
    os.makedirs(DEST, exist_ok=True)
    with open(os.path.join(DEST, f"{uuid}.mobileprovision"), "wb") as file:
        file.write(raw)
    return uuid


def main():
    status, certs = api("/v1/certificates?limit=200")
    dist = [
        c
        for c in certs.get("data", [])
        if c["attributes"]["certificateType"] in ("DISTRIBUTION", "IOS_DISTRIBUTION")
    ]
    if not dist:
        sys.exit("Немає сертифіката розповсюдження — його Xcode має створити сам.")
    cert_id = dist[0]["id"]

    status, bundles = api("/v1/bundleIds?limit=200")
    bundle_id = {b["attributes"]["identifier"]: b["id"] for b in bundles.get("data", [])}

    status, profiles = api("/v1/profiles?limit=200&include=bundleId")
    names = {
        x["id"]: x["attributes"]["identifier"]
        for x in profiles.get("included", [])
        if x["type"] == "bundleIds"
    }
    have = {}
    for profile in profiles.get("data", []):
        link = profile.get("relationships", {}).get("bundleId", {}).get("data", {}).get("id")
        ident = names.get(link, "")
        if ident in WANT and profile["attributes"]["profileType"] == "IOS_APP_STORE":
            have.setdefault(ident, []).append(profile)

    for ident, name in WANT.items():
        rows = have.get(ident, [])
        good = [p for p in rows if p["attributes"]["profileState"] == "ACTIVE"]

        if not good:
            for profile in rows:
                code, _ = api(f"/v1/profiles/{profile['id']}", method="DELETE")
                print(f"  прибрав зіпсований {profile['attributes']['name']} ({code})")
            if ident not in bundle_id:
                print(f"  ✗ {ident}: такого App ID немає в портала")
                continue
            code, made = api(
                "/v1/profiles",
                method="POST",
                body={
                    "data": {
                        "type": "profiles",
                        "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
                        "relationships": {
                            "bundleId": {"data": {"id": bundle_id[ident], "type": "bundleIds"}},
                            "certificates": {"data": [{"id": cert_id, "type": "certificates"}]},
                        },
                    }
                },
            )
            if code >= 300:
                print(f"  ✗ {name}: {code} {json.dumps(made)[:300]}")
                continue
            print(f"  створив {name}")
            good = [made["data"]]

        print(f"  ✓ {ident} → {good[0]['attributes']['name']} ({install(good[0])})")


if __name__ == "__main__":
    main()
