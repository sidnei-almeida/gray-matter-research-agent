"""Re-export API app from api/ module for import compatibility."""
from api.index import app

__all__ = ["app"]
