"""Backend restart endpoint for FL UI Addons.

Registers POST /fl_ui_addons/restart. On a same-origin request, schedules a
short-delay detached respawn of the current ComfyUI process, then exits the
parent. The HTTP response flushes before the process dies so the client can
poll /system_stats to know when the new server is up.
"""

import logging
import os
import subprocess
import sys
import threading
import time

from aiohttp import web
from server import PromptServer


_logger = logging.getLogger("fl_ui_addons")


def _is_same_origin(request) -> bool:
    """Only honor restart requests that came from the same origin serving the page.

    Plain heuristic: the request's Referer must contain the Host the request
    was sent to. Stops a random external page from triggering reboots if the
    user has exposed their ComfyUI port without auth.
    """
    referer = request.headers.get("Referer", "")
    host = request.headers.get("Host", "")
    if not referer or not host:
        return False
    return host in referer


def _spawn_and_exit() -> None:
    """Detach a new ComfyUI child process, then exit this one."""
    time.sleep(0.5)
    cwd = os.getcwd()
    args = [sys.executable] + sys.argv
    try:
        if sys.platform == "win32":
            flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
            subprocess.Popen(args, cwd=cwd, creationflags=flags, close_fds=True)
        else:
            subprocess.Popen(args, cwd=cwd, start_new_session=True, close_fds=True)
    except Exception:
        _logger.exception("[FL UI Addons] Failed to spawn restart child process")
        return
    _logger.info("[FL UI Addons] Restart: detached child spawned, exiting parent.")
    os._exit(0)


@PromptServer.instance.routes.post("/fl_ui_addons/restart")
async def fl_ui_addons_restart(request: web.Request) -> web.Response:
    if not _is_same_origin(request):
        return web.json_response({"ok": False, "error": "forbidden"}, status=403)
    threading.Thread(target=_spawn_and_exit, daemon=True).start()
    return web.json_response({"ok": True, "message": "Restarting ComfyUI..."})
