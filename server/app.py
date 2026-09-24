# AxHub Sync Server - Cloud Prototype Receiver & Gateway
# Python FastAPI / Uvicorn

import os
import shutil
import zipfile
import re
import json
import secrets
from pathlib import Path
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Request
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

# China Standard Time (UTC+8)
CHINA_TZ = timezone(timedelta(hours=8))

app = FastAPI(title="AxHub Sync Receiver", version="1.0.1")

# Allow CORS for all origins (local Axure previews, file://, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Enable high-performance HTTP compression (gzip) for all assets > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Base storage directories
BASE_DIR = Path(os.getenv("PROTOTYPES_DIR", "/srv/prototypes"))
BASE_DIR.mkdir(parents=True, exist_ok=True)

AUTH_TOKEN = os.getenv("AUTH_TOKEN", "admin-token-secret")
TOKENS_FILE = BASE_DIR / "tokens.json"


def sanitize_project_name(name: str) -> str:
    """Sanitize project name to be URL-safe and directory-safe."""
    name = name.strip()
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    return name or "Unnamed_Project"


def load_tokens_data():
    """Load persistent token store or initialize default structure."""
    if TOKENS_FILE.exists():
        try:
            with open(TOKENS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "tokens" in data:
                    return data
        except Exception as e:
            print("[AxHub] Error reading tokens.json:", e)
    
    # Initialize default state with Default Key
    default_data = {
        "require_auth": True,
        "tokens": [
            {
                "id": "tok_default",
                "name": "Default Key",
                "token": AUTH_TOKEN or "admin-token-secret",
                "created_at": "2026-09-17 12:00:00",
                "enabled": True
            }
        ]
    }
    save_tokens_data(default_data)
    return default_data


def save_tokens_data(data: dict):
    """Save persistent token store."""
    try:
        with open(TOKENS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("[AxHub] Error saving tokens.json:", e)


def verify_auth(authorization: str = None, token_param: str = None, is_admin: bool = False):
    """
    Verify bearer token or query param against active multi-token pool.
    is_admin=True: Used by dashboard token management. Allows master AUTH_TOKEN even if toggled off in pool.
    is_admin=False: Used by client prototype operations and verify endpoint. Strictly respects enabled status.
    """
    data = load_tokens_data()
    if not is_admin and not data.get("require_auth", True):
        return True  # Client auth enforcement globally turned off

    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif token_param:
        token = token_param.strip()

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized: Missing Access Token")

    all_tokens = data.get("tokens", [])
    matched_entry = next((t for t in all_tokens if t.get("token") == token), None)

    # Master server admin key check for dashboard management
    if is_admin and AUTH_TOKEN and token == AUTH_TOKEN:
        return True

    if matched_entry is not None:
        if not matched_entry.get("enabled", True):
            raise HTTPException(
                status_code=401,
                detail=f"Unauthorized: 密钥 '{matched_entry.get('name', 'Token')}' 已在后台被禁用"
            )
        return True

    # Fallback only when tokens list is empty during bootstrap
    if not all_tokens and AUTH_TOKEN and token == AUTH_TOKEN:
        return True

    raise HTTPException(status_code=401, detail="Unauthorized: Invalid Token")


@app.api_route("/api/health", methods=["GET", "HEAD"])
def health_check():
    """Health check endpoint for extension latency ping."""
    project_count = len([p for p in BASE_DIR.iterdir() if p.is_dir()]) if BASE_DIR.exists() else 0
    return {
        "status": "ok",
        "service": "axhub-sync-receiver",
        "timestamp": datetime.now(CHINA_TZ).strftime("%Y-%m-%d %H:%M:%S"),
        "timezone": "Asia/Shanghai (UTC+8)",
        "projects_hosted": project_count
    }


@app.post("/api/upload")
async def upload_prototype(
    request: Request,
    file: UploadFile = File(...),
    project: str = Form(...),
    authorization: str = Header(None)
):
    """
    Receive uploaded Axure prototype ZIP bundle, unpack with full UTF-8 support, and host.
    """
    query_token = request.query_params.get("token")
    verify_auth(authorization, query_token, is_admin=False)

    safe_name = sanitize_project_name(project)
    target_dir = (BASE_DIR / safe_name).resolve()
    temp_zip = BASE_DIR / f"_temp_{safe_name}.zip"

    try:
        # Save incoming zip file
        with open(temp_zip, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Ensure target directory exists and is clean
        if target_dir.exists():
            shutil.rmtree(target_dir)
        target_dir.mkdir(parents=True, exist_ok=True)

        # Extract ZIP safely with UTF-8 filename decoding
        file_count = 0
        with zipfile.ZipFile(temp_zip, "r") as zip_ref:
            for info in zip_ref.infolist():
                filename = info.filename
                # If UTF-8 bit is not set, attempt decoding from CP437
                if info.flag_bits & 0x800 == 0:
                    try:
                        filename = filename.encode('cp437').decode('utf-8')
                    except Exception:
                        pass

                # Prevent Zip Slip vulnerability
                target_file = (target_dir / filename).resolve()
                if not str(target_file).startswith(str(target_dir)):
                    continue

                if info.is_dir() or filename.endswith('/'):
                    target_file.mkdir(parents=True, exist_ok=True)
                else:
                    target_file.parent.mkdir(parents=True, exist_ok=True)
                    with zip_ref.open(info) as src, open(target_file, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    file_count += 1

        # Compute size and save fast metadata cache
        total_size = sum(f.stat().st_size for f in target_dir.rglob("*") if f.is_file() and f.name != ".meta.json")
        size_mb = round(total_size / (1024 * 1024), 2)
        has_start_html = (target_dir / "start.html").exists() or (target_dir / "index.html").exists()

        meta = {
            "mtime": target_dir.stat().st_mtime,
            "file_count": file_count,
            "size_mb": size_mb,
            "has_html": has_start_html,
            "is_empty": (file_count == 0),
            "updated_at": datetime.now(CHINA_TZ).strftime("%Y-%m-%d %H:%M:%S")
        }
        try:
            with open(target_dir / ".meta.json", "w", encoding="utf-8") as mf:
                json.dump(meta, mf)
        except Exception:
            pass

        # Clean up temporary zip
        if temp_zip.exists():
            temp_zip.unlink()

        # Build public preview URL
        public_url = f"/p/{safe_name}/start.html"

        return JSONResponse({
            "code": 0,
            "status": "ok",
            "message": f"Successfully synced project '{safe_name}' ({file_count} files)",
            "project": safe_name,
            "url": public_url,
            "fileCount": file_count
        })

    except Exception as e:
        if temp_zip.exists():
            temp_zip.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to extract prototype: {str(e)}")


def get_project_metrics(project_dir: Path) -> dict:
    """Retrieve project metrics with persistent .meta.json cache to eliminate slow disk scans."""
    meta_file = project_dir / ".meta.json"
    stat = project_dir.stat()
    dir_mtime = stat.st_mtime
    is_empty_marker = (project_dir / ".empty").exists()

    if is_empty_marker:
        return {
            "file_count": 0,
            "size_mb": 0.0,
            "has_html": False,
            "is_empty": True,
            "updated_at": datetime.fromtimestamp(dir_mtime, tz=CHINA_TZ).strftime("%Y-%m-%d %H:%M:%S")
        }

    # Fast path: cached .meta.json exists and is fresh
    if meta_file.exists():
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                cached = json.load(f)
                if abs(cached.get("mtime", 0) - dir_mtime) < 2 and "file_count" in cached:
                    return cached
        except Exception:
            pass

    # Slow path (first run only): scan once and save
    total_bytes = 0
    file_count = 0
    has_start_html = (project_dir / "start.html").exists() or (project_dir / "index.html").exists()

    for f in project_dir.rglob("*"):
        if f.is_file() and f.name not in (".empty", ".meta.json"):
            try:
                total_bytes += f.stat().st_size
                file_count += 1
            except Exception:
                pass

    size_mb = round(total_bytes / (1024 * 1024), 2)
    is_empty = (file_count == 0)

    meta = {
        "mtime": dir_mtime,
        "file_count": file_count,
        "size_mb": size_mb,
        "has_html": has_start_html,
        "is_empty": is_empty,
        "updated_at": datetime.fromtimestamp(dir_mtime, tz=CHINA_TZ).strftime("%Y-%m-%d %H:%M:%S")
    }

    try:
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump(meta, f)
    except Exception:
        pass

    return meta


# Serve AxureHub Web Dashboard
DASHBOARD_FILE = Path(__file__).parent / "axurehub.html"

@app.api_route("/", methods=["GET", "HEAD"])
@app.api_route("/dashboard", methods=["GET", "HEAD"])
def get_dashboard():
    """Serve the AxureHub frontend management console with zero-cache revalidation."""
    if DASHBOARD_FILE.exists():
        return FileResponse(
            DASHBOARD_FILE, 
            media_type="text/html; charset=utf-8",
            headers={"Cache-Control": "no-cache, must-revalidate"}
        )
    return {"status": "ok", "service": "AxureHub Server", "message": "Dashboard HTML not found"}


@app.get("/api/projects")
def list_projects(authorization: str = Header(None)):
    """List all hosted prototype projects instantly using cached metrics."""
    projects = []
    if BASE_DIR.exists():
        for p in BASE_DIR.iterdir():
            if p.is_dir() and not p.name.startswith("_temp"):
                m = get_project_metrics(p)
                projects.append({
                    "name": p.name,
                    "url": f"/p/{p.name}/start.html#g=1",
                    "updated_at": m["updated_at"],
                    "file_count": m["file_count"],
                    "size_mb": m["size_mb"],
                    "has_html": m["has_html"],
                    "is_empty": m["is_empty"]
                })
    return {"code": 0, "projects": sorted(projects, key=lambda x: x["updated_at"], reverse=True)}


@app.post("/api/projects/{project_name}/clear")
def clear_project_html(project_name: str, authorization: str = Header(None)):
    """Clear all HTML/JS/CSS and asset files of a project while retaining project entry."""
    verify_auth(authorization)
    safe_name = sanitize_project_name(project_name)
    target = BASE_DIR / safe_name
    if target.exists() and target.is_dir():
        for item in target.iterdir():
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        (target / ".empty").touch()
        # Persist empty metrics
        meta = {
            "mtime": target.stat().st_mtime,
            "file_count": 0,
            "size_mb": 0.0,
            "has_html": False,
            "is_empty": True,
            "updated_at": datetime.now(CHINA_TZ).strftime("%Y-%m-%d %H:%M:%S")
        }
        try:
            with open(target / ".meta.json", "w", encoding="utf-8") as mf:
                json.dump(meta, mf)
        except Exception:
            pass
        return {"code": 0, "message": f"Successfully cleared HTML assets for project '{safe_name}'", "project": safe_name}
    raise HTTPException(status_code=404, detail="Project not found")


@app.delete("/api/projects/{project_name}")
def delete_project(project_name: str, authorization: str = Header(None)):
    """Delete a prototype project entirely."""
    verify_auth(authorization)
    safe_name = sanitize_project_name(project_name)
    target = BASE_DIR / safe_name
    if target.exists() and target.is_dir():
        shutil.rmtree(target)
        return {"code": 0, "message": f"Deleted project {safe_name}"}
    raise HTTPException(status_code=404, detail="Project not found")


# Static file serving for prototypes at /p/{project_name}/{filepath}
@app.get("/p/{project_name}")
@app.get("/p/{project_name}/")
def redirect_to_start(project_name: str):
    """Redirect root project URL to start.html."""
    return RedirectResponse(url=f"/p/{project_name}/start.html")


@app.api_route("/p/{project_name}/{file_path:path}", methods=["GET", "HEAD"])
def serve_prototype_file(project_name: str, file_path: str):
    """Serve prototype static assets with intelligent HTTP caching and compression headers."""
    safe_name = sanitize_project_name(project_name)
    target_path = (BASE_DIR / safe_name / file_path).resolve()

    # Safety check: prevent directory traversal
    if not str(target_path).startswith(str((BASE_DIR / safe_name).resolve())):
        raise HTTPException(status_code=403, detail="Forbidden")

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    # Proper mime types and aggressive caching for CDN / browser disk cache
    media_type = None
    headers = {}
    lower_path = file_path.lower()
    if lower_path.endswith(".html"):
        media_type = "text/html; charset=utf-8"
        headers["Cache-Control"] = "no-cache, must-revalidate"
    elif lower_path.endswith(".js"):
        media_type = "application/javascript; charset=utf-8"
        headers["Cache-Control"] = "public, max-age=604800, immutable"
    elif lower_path.endswith(".css"):
        media_type = "text/css; charset=utf-8"
        headers["Cache-Control"] = "public, max-age=604800, immutable"
    elif lower_path.endswith(".json"):
        media_type = "application/json; charset=utf-8"
        headers["Cache-Control"] = "public, max-age=604800, immutable"
    elif lower_path.endswith(".png"):
        media_type = "image/png"
        headers["Cache-Control"] = "public, max-age=2592000, immutable"
    elif lower_path.endswith((".jpg", ".jpeg")):
        media_type = "image/jpeg"
        headers["Cache-Control"] = "public, max-age=2592000, immutable"
    elif lower_path.endswith(".svg"):
        media_type = "image/svg+xml"
        headers["Cache-Control"] = "public, max-age=2592000, immutable"
    elif lower_path.endswith(".gif"):
        media_type = "image/gif"
        headers["Cache-Control"] = "public, max-age=2592000, immutable"
    elif lower_path.endswith(".webp"):
        media_type = "image/webp"
        headers["Cache-Control"] = "public, max-age=2592000, immutable"
    elif lower_path.endswith(".ico"):
        media_type = "image/x-icon"
        headers["Cache-Control"] = "public, max-age=2592000, immutable"
    elif lower_path.endswith(".woff2"):
        media_type = "font/woff2"
        headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif lower_path.endswith(".woff"):
        media_type = "font/woff"
        headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        headers["Cache-Control"] = "public, max-age=86400"

    return FileResponse(target_path, media_type=media_type, headers=headers)


# ========================================================
# Token Management Endpoints (9Router Style)
# ========================================================

@app.get("/api/tokens")
def list_tokens(authorization: str = Header(None)):
    """List all API tokens and global requirement switch."""
    verify_auth(authorization, is_admin=True)
    data = load_tokens_data()
    return {
        "code": 0,
        "require_auth": data.get("require_auth", True),
        "tokens": data.get("tokens", [])
    }


@app.post("/api/tokens")
async def create_token(request: Request, authorization: str = Header(None)):
    """Create a new API token with remark name and auto-generated or custom key."""
    verify_auth(authorization, is_admin=True)
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        pass

    name = str(payload.get("name", "")).strip() or "New Token"
    custom_token = str(payload.get("token", "")).strip()

    if not custom_token:
        # Generate clean, standard token: sk-axh-xxxxxxxxxxxx...
        custom_token = f"sk-axh-{secrets.token_hex(16)}"

    data = load_tokens_data()
    tokens = data.setdefault("tokens", [])

    # Check if token value is unique
    if any(t.get("token") == custom_token for t in tokens):
        raise HTTPException(status_code=400, detail="该 Token 密钥已存在，请使用其他密钥")

    new_token_item = {
        "id": f"tok_{secrets.token_hex(6)}",
        "name": name,
        "token": custom_token,
        "created_at": datetime.now(CHINA_TZ).strftime("%Y/%m/%d"),
        "enabled": True
    }
    tokens.append(new_token_item)
    save_tokens_data(data)

    return {
        "code": 0,
        "message": f"成功创建 API 密钥 '{name}'",
        "token": new_token_item
    }


@app.patch("/api/tokens/{token_id}/toggle")
def toggle_token_status(token_id: str, authorization: str = Header(None)):
    """Toggle enabled status of an API token."""
    verify_auth(authorization, is_admin=True)
    data = load_tokens_data()
    tokens = data.get("tokens", [])
    for t in tokens:
        if t.get("id") == token_id:
            new_status = not t.get("enabled", True)
            t["enabled"] = new_status
            save_tokens_data(data)
            return {
                "code": 0,
                "message": f"密钥 '{t.get('name')}' 已{'启用' if new_status else '禁用'}",
                "enabled": new_status
            }
    raise HTTPException(status_code=404, detail="未找到该密钥")


@app.delete("/api/tokens/{token_id}")
def delete_token(token_id: str, authorization: str = Header(None)):
    """Delete an API token."""
    verify_auth(authorization, is_admin=True)
    data = load_tokens_data()
    tokens = data.get("tokens", [])
    initial_count = len(tokens)
    tokens = [t for t in tokens if t.get("id") != token_id]
    if len(tokens) == initial_count:
        raise HTTPException(status_code=404, detail="未找到该密钥")

    data["tokens"] = tokens
    save_tokens_data(data)
    return {"code": 0, "message": "密钥已成功删除"}


@app.post("/api/tokens/settings")
async def update_token_settings(request: Request, authorization: str = Header(None)):
    """Update global API key requirement toggle (require_auth)."""
    verify_auth(authorization, is_admin=True)
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        pass

    data = load_tokens_data()
    if "require_auth" in payload:
        data["require_auth"] = bool(payload["require_auth"])
        save_tokens_data(data)
        return {
            "code": 0,
            "message": f"已{'启用' if data['require_auth'] else '停用'} API 密钥强制鉴权",
            "require_auth": data["require_auth"]
        }
    return {"code": 0, "require_auth": data.get("require_auth", True)}


@app.api_route("/api/tokens/verify", methods=["GET", "POST"])
def verify_token_endpoint(request: Request, authorization: str = Header(None)):
    """Fast token verification endpoint for extension and content scripts."""
    query_token = request.query_params.get("token")
    verify_auth(authorization, query_token, is_admin=False)

    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()
    elif query_token:
        token = query_token.strip()

    data = load_tokens_data()
    matched_name = "Default Key"
    for t in data.get("tokens", []):
        if t.get("token") == token:
            matched_name = t.get("name", "Custom Key")
            break

    return {
        "code": 0,
        "status": "ok",
        "valid": True,
        "name": matched_name,
        "require_auth": data.get("require_auth", True)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8088)
