from app.routes.auth import router as auth_router
from app.routes.issues import router as issues_router
from app.routes.users import router as users_router

__all__ = ["auth_router", "issues_router", "users_router"]
