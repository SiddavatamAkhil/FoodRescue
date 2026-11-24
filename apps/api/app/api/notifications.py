import asyncio
from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import get_db
from app.db.models import User, Notification
from app.api.deps import get_current_user

router = APIRouter()

# Simple In-Memory PubSub queue dictionary for SSE streaming
sse_queues = {}

async def register_sse_client(user_id: str):
    if user_id not in sse_queues:
        sse_queues[user_id] = asyncio.Queue()
    return sse_queues[user_id]

def unregister_sse_client(user_id: str):
    if user_id in sse_queues:
        del sse_queues[user_id]

async def send_realtime_notification(user_id: str, title: str, message: str, event_type: str = "notification"):
    if user_id in sse_queues:
        await sse_queues[user_id].put({
            "event": event_type,
            "data": f"{title}: {message}"
        })

@router.get("/stream")
async def stream_notifications(
    current_user: User = Depends(get_current_user)
):
    """
    Server-Sent Events (SSE) streaming endpoint for real-time notification updates.
    """
    queue = await register_sse_client(current_user.id)
    
    async def sse_generator():
        try:
            while True:
                # Wait for any incoming real-time notification
                item = await queue.get()
                yield f"event: {item['event']}\ndata: {item['data']}\n\n"
                queue.task_done()
        except asyncio.CancelledError:
            unregister_sse_client(current_user.id)
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@router.post("/test-trigger")
async def trigger_mock_notification(
    title: str,
    message: str,
    current_user: User = Depends(get_current_user)
):
    await send_realtime_notification(current_user.id, title, message)
    return {"status": "sent"}


@router.get("/")
async def list_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Notification).filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc()).limit(50)
    )
    return [
        {"id": n.id, "type": n.type, "title": n.title, "message": n.message, "is_read": n.is_read,
         "created_at": n.created_at}
        for n in res.scalars().all()
    ]


@router.post("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
    )
    for n in res.scalars().all():
        n.is_read = True
    await db.commit()
    return {"status": "ok"}
