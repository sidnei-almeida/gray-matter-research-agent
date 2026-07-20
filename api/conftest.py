"""Pytest configuration for api tests - ensures parent directory is in sys.path."""
import sys
from pathlib import Path

# Add parent directory to sys.path so imports work from api/
parent_dir = str(Path(__file__).parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
